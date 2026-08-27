"""Download operations and history routes for Rahami."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.db.database import get_db
from app.db.models import (
    AnalyzeRequest,
    DownloadTaskResponse,
    HistoryItemResponse,
    MediaMetadata,
    StartDownloadRequest,
    UserProfile
)
from app.services.analyzer import analyze_url
from app.services.cleanup import is_storage_full
from app.services.download_manager import download_manager

logger = logging.getLogger("rahami.api.download")

router = APIRouter(prefix="/api/download", tags=["download"])


@router.post("/analyze", response_model=MediaMetadata)
@limiter.limit("30/minute")
async def analyze_media_url(
    request: Request,
    payload: AnalyzeRequest,
    current_user: UserProfile = Depends(get_current_user)
) -> MediaMetadata:
    """Analyze media URL and return verified metadata and formats."""
    try:
        metadata = await analyze_url(payload.url)
        return metadata
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Analysis failure for {payload.url}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="تعذر تحليل الرابط، يرجى التأكد من الرابط والمحاولة مجددًا."
        )


@router.post("/start", response_model=DownloadTaskResponse)
@limiter.limit("20/minute")
async def start_download(
    request: Request,
    payload: StartDownloadRequest,
    current_user: UserProfile = Depends(get_current_user)
) -> DownloadTaskResponse:
    """Queue and initiate a media download task."""
    if is_storage_full():
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail="مساحة التخزين ممتلئة حاليًا، يرجى الانتظار لحين اكتمال التنظيف التلقائي."
        )

    task = await download_manager.create_task(
        user_id=current_user.username,
        url=payload.url,
        format_id=payload.format_id,
        format_type=payload.format_type,
        title=payload.title or "media",
        thumbnail=payload.thumbnail,
        source=payload.source
    )
    return task


@router.get("/{task_id}", response_model=DownloadTaskResponse)
async def get_download_status(
    task_id: str,
    current_user: UserProfile = Depends(get_current_user)
) -> DownloadTaskResponse:
    """Get status of an active or completed download task."""
    task = await download_manager.get_task(task_id, current_user.username)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="لم يتم العثور على مهمة التحميل."
        )
    return task


@router.post("/{task_id}/cancel")
async def cancel_download(
    task_id: str,
    current_user: UserProfile = Depends(get_current_user)
) -> dict:
    """Cancel an ongoing download task."""
    success = await download_manager.cancel_task(task_id, current_user.username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تعذر إلغاء التحميل."
        )
    return {"message": "تم إلغاء التحميل بنجاح."}


@router.get("/{task_id}/file")
async def download_completed_file(
    task_id: str,
    current_user: UserProfile = Depends(get_current_user)
):
    """Stream completed download file to the client with strict isolation and path security."""
    db = await get_db()
    file_path_str = None
    filename = None
    try:
        async with db.execute(
            """
            SELECT file_path, filename, status
            FROM download_tasks
            WHERE id = ? AND user_id = ?
            """,
            (task_id, current_user.username)
        ) as cursor:
            row = await cursor.fetchone()
            if not row or row["status"] != "completed":
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="الملف غير متاح للتحميل أو لم يكتمل بعد."
                )
            file_path_str = row["file_path"]
            filename = row["filename"]
    finally:
        await db.close()

    if not file_path_str:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="مسار الملف غير مسجل.")

    file_path = Path(file_path_str).resolve()
    base_downloads = settings.DOWNLOADS_DIR.resolve()

    # Strict Path Traversal Prevention: Ensure target is within DOWNLOADS_DIR
    try:
        file_path.relative_to(base_downloads)
    except ValueError:
        logger.error(f"Path traversal attempt detected: {file_path_str}")
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="الوصول إلى هذا المسار غير مسموح.")

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="الملف غير موجود على القرص.")

    # Return streamed file response with proper media type
    media_type = "application/octet-stream"
    ext = file_path.suffix.lower()
    if ext == ".mp4":
        media_type = "video/mp4"
    elif ext == ".mp3":
        media_type = "audio/mpeg"
    elif ext == ".m4a":
        media_type = "audio/mp4"
    elif ext in (".jpg", ".jpeg"):
        media_type = "image/jpeg"
    elif ext == ".png":
        media_type = "image/png"
    elif ext == ".webp":
        media_type = "image/webp"
    elif ext == ".gif":
        media_type = "image/gif"
    elif ext == ".zip":
        media_type = "application/zip"

    return FileResponse(
        path=str(file_path),
        filename=filename or file_path.name,
        media_type=media_type,
        content_disposition_type="attachment"
    )


@router.get("/user/history", response_model=List[HistoryItemResponse])
async def get_download_history(
    current_user: UserProfile = Depends(get_current_user)
) -> List[HistoryItemResponse]:
    """Retrieve isolated personal download history for current user."""
    db = await get_db()
    items: List[HistoryItemResponse] = []
    try:
        async with db.execute(
            """
            SELECT id, task_id, title, source, format, file_size, filename, completed_at
            FROM download_history
            WHERE user_id = ? AND is_deleted = 0
            ORDER BY completed_at DESC
            LIMIT 50
            """,
            (current_user.username,)
        ) as cursor:
            rows = await cursor.fetchall()
            for r in rows:
                size_mb = round(r["file_size"] / (1024 * 1024), 2) if r["file_size"] else 0.0
                items.append(HistoryItemResponse(
                    id=r["id"],
                    task_id=r["task_id"],
                    title=r["title"],
                    source=r["source"] or "Direct",
                    format=r["format"] or "",
                    file_size_mb=size_mb,
                    filename=r["filename"] or "",
                    download_url=f"/api/download/{r['task_id']}/file",
                    completed_at=str(r["completed_at"])
                ))
    finally:
        await db.close()

    return items


@router.delete("/history/{history_id}")
async def delete_history_item(
    history_id: str,
    current_user: UserProfile = Depends(get_current_user)
) -> dict:
    """Soft delete history record for current user."""
    db = await get_db()
    try:
        await db.execute(
            """
            UPDATE download_history
            SET is_deleted = 1
            WHERE id = ? AND user_id = ?
            """,
            (history_id, current_user.username)
        )
        await db.commit()
    finally:
        await db.close()

    return {"message": "تم حذف السجل بنجاح."}
