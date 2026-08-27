"""Admin downloads oversight and management routes."""

from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminDownloadsResponse, AdminProfileResponse
from app.db.supabase import db_manager
from app.services.admin_service import admin_service
from app.services.download_manager import download_manager

logger = logging.getLogger("rahami.api.admin_downloads")

router = APIRouter(prefix="/api/admin/downloads", tags=["admin_downloads"])


@router.get("", response_model=AdminDownloadsResponse)
async def list_admin_downloads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> AdminDownloadsResponse:
    """List paginated platform downloads with search and filter capabilities."""
    return await admin_service.list_downloads(
        page=page,
        page_size=page_size,
        status_filter=status,
        user_filter=user_id,
        search=search
    )


@router.post("/{download_id}/cancel")
async def cancel_download_as_admin(
    download_id: str,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Cancel an active or queued download task immediately."""
    client_ip = request.client.host if request.client else "unknown"

    # Find the user of this download task
    service = download_manager.active_services.get(download_id)
    if service:
        await service.cancel()
        download_manager.active_services.pop(download_id, None)

    # Cancel in download manager directly
    db_item = await download_manager.get_task(download_id, "")  # Fetch directly if possible or update status
    from app.db.database import get_db
    db = await get_db()
    try:
        await db.execute(
            """
            UPDATE download_tasks
            SET status = 'cancelled',
                error_message = 'تم إلغاء التحميل من قبل مدير النظام.',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (download_id,)
        )
        await db.commit()
    finally:
        await db.close()

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="DOWNLOAD_CANCEL",
        target=f"Download {download_id}",
        ip_address=client_ip
    )

    return {"message": "تم إلغاء التحميل بنجاح بواسطة المدير."}


@router.delete("/{download_id}")
async def delete_download_record_as_admin(
    download_id: str,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Permanently remove a download metadata record."""
    client_ip = request.client.host if request.client else "unknown"
    success = await admin_service.delete_download_record(download_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تعذر حذف سجل التحميل."
        )

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="DOWNLOAD_DELETE",
        target=f"Download {download_id}",
        ip_address=client_ip
    )

    return {"message": "تم حذف سجل التحميل بنجاح."}
