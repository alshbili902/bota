"""Diagnostics and safe auto-recovery service.

Monitors system binaries, disk space, and active workers. Performs safe
non-destructive recovery such as directory recreation and stuck lock cleanup.
"""

from __future__ import annotations

import logging
from pathlib import Path
import shutil
from typing import Any, Dict
from app.core.config import settings
from app.db.database import get_db
from app.db.models import SystemHealthResponse
from app.services.cleanup import cleanup_temporary_files, get_storage_usage_bytes

logger = logging.getLogger("rahami.diagnostics")


async def get_system_health(active_downloads_count: int = 0) -> SystemHealthResponse:
    """Check health of system components and storage."""
    ytdlp_path = settings.YTDLP_PATH or shutil.which("yt-dlp")
    ffmpeg_path = settings.FFMPEG_PATH or shutil.which("ffmpeg")
    ffprobe_path = settings.FFPROBE_PATH or shutil.which("ffprobe")

    ytdlp_ok = bool(ytdlp_path and Path(ytdlp_path).exists())
    ffmpeg_ok = bool(ffmpeg_path and Path(ffmpeg_path).exists())
    ffprobe_ok = bool(ffprobe_path and Path(ffprobe_path).exists())

    used_bytes = get_storage_usage_bytes()
    used_mb = round(used_bytes / (1024 * 1024), 2)
    max_bytes = settings.max_storage_bytes
    free_mb = round(max(0, max_bytes - used_bytes) / (1024 * 1024), 2)

    status = "healthy"
    if not (ytdlp_ok and ffmpeg_ok):
        status = "degraded"
    if used_bytes >= max_bytes:
        status = "degraded"

    return SystemHealthResponse(
        status=status,
        ytdlp_available=ytdlp_ok,
        ffmpeg_available=ffmpeg_ok,
        ffprobe_available=ffprobe_ok,
        storage_used_mb=used_mb,
        storage_free_mb=free_mb,
        max_storage_gb=settings.MAX_STORAGE_GB,
        active_downloads=active_downloads_count,
        environment=settings.ENVIRONMENT
    )


async def perform_safe_auto_recovery() -> Dict[str, Any]:
    """Execute safe auto-recovery tasks without modifying code or credentials."""
    actions_taken = []

    # 1. Recreate missing runtime directories
    for directory in (settings.STORAGE_DIR, settings.TEMP_DIR, settings.DOWNLOADS_DIR):
        if not directory.exists():
            directory.mkdir(parents=True, exist_ok=True)
            actions_taken.append(f"Recreated directory: {directory.name}")

    # 2. Clean abandoned temp files
    cleaned = await cleanup_temporary_files(max_age_seconds=900)
    if cleaned > 0:
        actions_taken.append(f"Cleaned {cleaned} abandoned temporary download folders")

    # 3. Clean stuck 'downloading' tasks that died without updating status
    db = await get_db()
    try:
        # Mark tasks that have been in 'downloading' state for over DOWNLOAD_TIMEOUT as failed
        cutoff = settings.DOWNLOAD_TIMEOUT + 60
        async with db.execute(
            """
            UPDATE download_tasks
            SET status = 'failed',
                error_message = 'توقف التحميل بسبب انقطاع الخادم، يرجى إعادة المحاولة.',
                updated_at = CURRENT_TIMESTAMP
            WHERE status IN ('downloading', 'analyzing', 'processing')
              AND (strftime('%s', 'now') - strftime('%s', updated_at)) > ?
            """,
            (cutoff,)
        ) as cursor:
            if cursor.rowcount > 0:
                actions_taken.append(f"Marked {cursor.rowcount} stalled download tasks as failed")
        await db.commit()
    except Exception as e:
        logger.error(f"Error resetting stalled tasks: {e}")
    finally:
        await db.close()

    return {
        "success": True,
        "actions_taken": actions_taken
    }
