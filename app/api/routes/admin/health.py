"""Admin live system health and resource telemetry routes."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminProfileResponse, SystemHealthDetail
from app.services.system_monitor import get_deep_system_telemetry

router = APIRouter(prefix="/api/admin/health", tags=["admin_health"])


@router.get("", response_model=SystemHealthDetail)
async def get_system_health_telemetry(
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> SystemHealthDetail:
    """Retrieve comprehensive system telemetry (CPU, RAM, Disk, yt-dlp, FFmpeg, Supabase)."""
    return get_deep_system_telemetry()
