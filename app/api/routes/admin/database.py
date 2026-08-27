"""Admin database overview routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminProfileResponse, DatabaseOverviewResponse
from app.services.admin_service import admin_service

router = APIRouter(prefix="/api/admin/database", tags=["admin_database"])


@router.get("/overview", response_model=DatabaseOverviewResponse)
async def get_database_overview(
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> DatabaseOverviewResponse:
    """Retrieve safe database overview, connectivity status, and table record counts."""
    return await admin_service.get_database_overview()
