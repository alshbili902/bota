"""Admin dashboard metrics and overview routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminDashboardStats, AdminProfileResponse
from app.services.admin_service import admin_service

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin_dashboard"])


@router.get("/stats", response_model=AdminDashboardStats)
async def get_dashboard_statistics(
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> AdminDashboardStats:
    """Retrieve real aggregated statistics for the administrative dashboard."""
    return await admin_service.get_dashboard_stats()
