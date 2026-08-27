"""Download task manager with concurrency control and real-time event broadcasting."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
import logging
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional, Set
import uuid
import aiosqlite
from app.core.config import settings
from app.db.database import get_db
from app.db.models import DownloadTaskResponse
from app.db.supabase import db_manager
from app.services.downloader import DownloaderService, sanitize_filename

logger = logging.getLogger("rahami.download_manager")


class DownloadManager:
    """Orchestrates downloads, queueing, concurrency limits, and live events."""

    def __init__(self) -> None:
        self.active_services: Dict[str, DownloaderService] = {}
        self.semaphore = asyncio.Semaphore(settings.MAX_CONCURRENT_DOWNLOADS)
        self.ws_clients: Dict[str, Set[Any]] = {}  # username -> set of WebSocket connections
        self._background_tasks: Set[asyncio.Task] = set()

    def register_ws(self, username: str, ws: Any) -> None:
        """Register a WebSocket client for real-time progress events."""
        if username not in self.ws_clients:
            self.ws_clients[username] = set()
        self.ws_clients[username].add(ws)

    def unregister_ws(self, username: str, ws: Any) -> None:
        """Unregister a WebSocket client on disconnect."""
        if username in self.ws_clients:
            self.ws_clients[username].discard(ws)
            if not self.ws_clients[username]:
                self.ws_clients.pop(username, None)

    async def disconnect_user_ws(self, username: str) -> None:
        """Force-disconnect all active WebSockets for a specific user."""
        clients = list(self.ws_clients.get(username, set()))
        for ws in clients:
            try:
                await ws.close(code=1008, reason="Account deactivated or updated")
            except Exception:
                pass
        self.ws_clients.pop(username, None)

    async def broadcast_user(self, username: str, event_data: Dict[str, Any]) -> None:
        """Send live progress/status JSON payload to all active connections of a user."""
        if username not in self.ws_clients:
            return

        dead_connections = set()
        for ws in list(self.ws_clients[username]):
            try:
                await ws.send_json(event_data)
            except Exception:
                dead_connections.add(ws)

        for dead in dead_connections:
            self.ws_clients[username].discard(dead)

    async def create_task(
        self,
        user_id: str,
        url: str,
        format_id: str,
        format_type: str,
        title: str,
        thumbnail: Optional[str] = None,
        source: Optional[str] = None
    ) -> DownloadTaskResponse:
        """Create and enqueue a new download task."""
        task_id = str(uuid.uuid4())
        safe_title = sanitize_filename(title or "media")
        media_type = "audio" if format_type == "audio" else "video"

        # Database record
        db = await get_db()
        try:
            await db.execute(
                """
                INSERT INTO download_tasks (
                    id, user_id, url, source, title, thumbnail,
                    format_id, format_note, is_audio_only, status, progress, media_type
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', 0.0, ?)
                """,
                (
                    task_id,
                    user_id,
                    url,
                    source or "Direct",
                    safe_title,
                    thumbnail or "",
                    format_id,
                    format_type,
                    1 if format_type == "audio" else 0,
                    media_type
                )
            )
            await db.commit()
        finally:
            await db.close()

        # Sync queued task to Supabase
        await db_manager.sync_download_task({
            "id": task_id,
            "user_id": user_id,
            "url": url,
            "source": source or "Direct",
            "title": safe_title,
            "format": format_id,
            "status": "queued",
            "media_type": media_type
        })

        # Spawn processing in background
        bg_task = asyncio.create_task(
            self._process_task_wrapper(task_id, user_id, url, format_id, format_type, safe_title, source or "Direct")
        )
        self._background_tasks.add(bg_task)
        bg_task.add_done_callback(self._background_tasks.discard)

        return await self.get_task(task_id, user_id)

    async def get_task(self, task_id: str, user_id: str) -> Optional[DownloadTaskResponse]:
        """Fetch task details ensuring user isolation."""
        db = await get_db()
        try:
            async with db.execute(
                "SELECT * FROM download_tasks WHERE id = ? AND user_id = ?",
                (task_id, user_id)
            ) as cursor:
                row = await cursor.fetchone()
                if not row:
                    return None

                download_url = None
                if row["status"] == "completed" and row["filename"]:
                    download_url = f"/api/download/{task_id}/file"

                return DownloadTaskResponse(
                    id=row["id"],
                    url=row["url"],
                    title=row["title"],
                    thumbnail=row["thumbnail"],
                    source=row["source"],
                    format_id=row["format_id"],
                    format_note=row["format_note"],
                    is_audio_only=bool(row["is_audio_only"]),
                    status=row["status"],
                    progress=row["progress"],
                    speed_text=row["speed_text"] or "",
                    eta_text=row["eta_text"] or "",
                    downloaded_bytes=row["downloaded_bytes"] or 0,
                    total_bytes=row["total_bytes"] or 0,
                    filename=row["filename"],
                    download_url=download_url,
                    error_message=row["error_message"],
                    created_at=str(row["created_at"])
                )
        finally:
            await db.close()

    async def cancel_task(self, task_id: str, user_id: str) -> bool:
        """Cancel an active or queued download task."""
        # 1. Stop active downloader service if running
        service = self.active_services.get(task_id)
        if service:
            await service.cancel()
            self.active_services.pop(task_id, None)

        # 2. Update task in database
        db = await get_db()
        try:
            await db.execute(
                """
                UPDATE download_tasks
                SET status = 'cancelled',
                    error_message = 'تم إلغاء التحميل بناءً على طلبك.',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ? AND user_id = ?
                """,
                (task_id, user_id)
            )
            await db.commit()
        finally:
            await db.close()

        # 3. Clean temporary directory
        temp_dir = settings.TEMP_DIR / task_id
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)

        # 4. Broadcast update
        await self.broadcast_user(user_id, {
            "task_id": task_id,
            "status": "cancelled",
            "progress": 0.0,
            "error_message": "تم إلغاء التحميل."
        })

        return True

    async def _process_task_wrapper(
        self,
        task_id: str,
        user_id: str,
        url: str,
        format_id: str,
        format_type: str,
        title: str,
        source: str = "Direct"
    ) -> None:
        """Concurrency controlled execution with retry handling."""
        async with self.semaphore:
            retries = 0
            max_retries = settings.MAX_DOWNLOAD_RETRIES

            while retries <= max_retries:
                try:
                    await self._execute_task(task_id, user_id, url, format_id, format_type, title, source)
                    break  # Success
                except asyncio.CancelledError:
                    logger.info(f"Task {task_id} was cancelled.")
                    break
                except Exception as e:
                    retries += 1
                    err_text = str(e)
                    logger.warning(f"Task {task_id} attempt {retries} failed: {err_text}")

                    # Do not retry on permanent errors
                    if "حجم الملف أكبر" in err_text or "حجم الصورة أكبر" in err_text or "غير مدعوم" in err_text or retries > max_retries:
                        await self._mark_task_failed(task_id, user_id, err_text)
                        break

                    await asyncio.sleep(2 ** retries)  # Exponential backoff

    async def _execute_task(
        self,
        task_id: str,
        user_id: str,
        url: str,
        format_id: str,
        format_type: str,
        title: str,
        source: str = "Direct"
    ) -> None:
        """Inner task execution flow."""
        temp_dir = settings.TEMP_DIR / task_id
        temp_dir.mkdir(parents=True, exist_ok=True)

        # Update status to downloading
        await self._update_task_status(task_id, user_id, "downloading", 0.0, "جاري بدء التحميل...")

        async def on_progress(data: Dict[str, Any]) -> None:
            # Sync to DB and broadcast to user WebSocket
            prog = data.get("progress", 0.0)
            speed = data.get("speed_text", "")
            eta = data.get("eta_text", "")
            status = data.get("status", "downloading")

            db = await get_db()
            try:
                await db.execute(
                    """
                    UPDATE download_tasks
                    SET status = ?, progress = ?, speed_text = ?, eta_text = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (status, prog, speed, eta, task_id)
                )
                await db.commit()
            finally:
                await db.close()

            await self.broadcast_user(user_id, {
                "task_id": task_id,
                "status": status,
                "progress": prog,
                "speed_text": speed,
                "eta_text": eta,
            })

        service = DownloaderService(
            task_id=task_id,
            url=url,
            format_id=format_id,
            format_type=format_type,
            temp_dir=temp_dir,
            on_progress=on_progress
        )
        self.active_services[task_id] = service

        try:
            downloaded_file = await service.execute()

            # Move file to permanent storage directory for user
            user_storage_dir = settings.DOWNLOADS_DIR / user_id / task_id
            user_storage_dir.mkdir(parents=True, exist_ok=True)
            final_dest = user_storage_dir / downloaded_file.name
            shutil.move(str(downloaded_file), str(final_dest))

            file_size = final_dest.stat().st_size
            file_size_mb = round(file_size / (1024 * 1024), 2)
            media_type = "audio" if format_type == "audio" else "video"
            detected_w = None
            detected_h = None
            detected_fmt = final_dest.suffix.replace(".", "").upper() or ("MP3" if format_type == "audio" else "MP4")

            # Mark task completed
            db = await get_db()
            try:
                await db.execute(
                    """
                    UPDATE download_tasks
                    SET status = 'completed',
                        progress = 100.0,
                        file_path = ?,
                        filename = ?,
                        total_bytes = ?,
                        downloaded_bytes = ?,
                        speed_text = '',
                        eta_text = '',
                        media_type = ?,
                        width = ?,
                        height = ?,
                        image_format = ?,
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (
                        str(final_dest),
                        final_dest.name,
                        file_size,
                        file_size,
                        media_type,
                        detected_w,
                        detected_h,
                        detected_fmt,
                        task_id
                    )
                )

                # Add to history
                history_id = str(uuid.uuid4())
                await db.execute(
                    """
                    INSERT INTO download_history (
                        id, user_id, task_id, title, source, format, file_size, filename, media_type, width, height
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        history_id,
                        user_id,
                        task_id,
                        title,
                        source,
                        detected_fmt,
                        file_size,
                        final_dest.name,
                        media_type,
                        detected_w,
                        detected_h
                    )
                )
                await db.commit()
            finally:
                await db.close()

            # Sync completed task to Supabase
            await db_manager.sync_download_task({
                "id": task_id,
                "user_id": user_id,
                "url": url,
                "source": source,
                "title": title,
                "filename": final_dest.name,
                "format": detected_fmt,
                "file_size": file_size,
                "status": "completed",
                "media_type": media_type,
                "width": detected_w,
                "height": detected_h,
                "image_format": detected_fmt
            })

            # Clean temporary dir
            shutil.rmtree(temp_dir, ignore_errors=True)

            # Broadcast completion
            await self.broadcast_user(user_id, {
                "task_id": task_id,
                "status": "completed",
                "progress": 100.0,
                "filename": final_dest.name,
                "file_size_mb": file_size_mb,
                "download_url": f"/api/download/{task_id}/file",
                "media_type": media_type
            })

        finally:
            self.active_services.pop(task_id, None)

    async def _update_task_status(
        self,
        task_id: str,
        user_id: str,
        status: str,
        progress: float,
        speed_text: str
    ) -> None:
        """Helper to update database status and notify clients."""
        db = await get_db()
        try:
            await db.execute(
                """
                UPDATE download_tasks
                SET status = ?, progress = ?, speed_text = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (status, progress, speed_text, task_id)
            )
            await db.commit()
        finally:
            await db.close()

        await self.broadcast_user(user_id, {
            "task_id": task_id,
            "status": status,
            "progress": progress,
            "speed_text": speed_text
        })

    async def _mark_task_failed(self, task_id: str, user_id: str, error_message: str) -> None:
        """Mark a task as failed and clean temporary files."""
        db = await get_db()
        try:
            await db.execute(
                """
                UPDATE download_tasks
                SET status = 'failed',
                    error_message = ?,
                    speed_text = '',
                    eta_text = '',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                (error_message, task_id)
            )
            await db.commit()
        finally:
            await db.close()

        temp_dir = settings.TEMP_DIR / task_id
        if temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)

        # Sync failed task to Supabase
        await db_manager.sync_download_task({
            "id": task_id,
            "user_id": user_id,
            "status": "failed",
            "error_message": error_message
        })

        await self.broadcast_user(user_id, {
            "task_id": task_id,
            "status": "failed",
            "progress": 0.0,
            "error_message": error_message
        })


download_manager = DownloadManager()
