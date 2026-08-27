"""Admin audit activity logs routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminProfileResponse, AuditLogResponse
from app.services.admin_service import admin_service

router = APIRouter(prefix="/api/admin/activity", tags=["admin_activity"])


@router.get("", response_model=AuditLogResponse)
async def list_admin_activity_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> AuditLogResponse:
    """Retrieve paginated immutable audit logs of administrative actions."""
    return await admin_service.list_activity_logs(page=page, page_size=page_size)
