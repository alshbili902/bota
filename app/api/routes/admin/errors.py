"""Admin Error Center routes."""

from __future__ import annotations

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminProfileResponse, ErrorLogItem, ErrorStatusUpdate
from app.db.supabase import db_manager
from app.services.admin_service import admin_service

logger = logging.getLogger("rahami.api.admin_errors")

router = APIRouter(prefix="/api/admin/errors", tags=["admin_errors"])


@router.get("", response_model=List[ErrorLogItem])
async def list_error_center_items(
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> List[ErrorLogItem]:
    """Retrieve grouped error logs and occurrences."""
    return await admin_service.list_errors()


@router.put("/{error_id}")
async def update_error_status(
    error_id: str,
    payload: ErrorStatusUpdate,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Mark an error as resolved, ignored, or active."""
    client_ip = request.client.host if request.client else "unknown"
    success = await admin_service.update_error_status(error_id, payload.status)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تعذر تحديث حالة الخطأ."
        )

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="ERROR_STATUS_CHANGE",
        target=f"Error {error_id}",
        details={"new_status": payload.status},
        ip_address=client_ip
    )

    return {"message": f"تم تحديث حالة الخطأ إلى: {payload.status}"}
