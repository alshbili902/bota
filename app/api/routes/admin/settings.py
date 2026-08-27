"""Admin site settings and maintenance mode routes."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, Request
from app.api.admin_deps import get_current_admin
from app.db.admin_models import AdminProfileResponse, SiteSettingsModel
from app.db.supabase import db_manager

logger = logging.getLogger("rahami.api.admin_settings")

router = APIRouter(prefix="/api/admin/settings", tags=["admin_settings"])


@router.get("", response_model=SiteSettingsModel)
async def get_site_settings(
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> SiteSettingsModel:
    """Retrieve full website configuration and maintenance parameters."""
    raw = await db_manager.get_site_settings()
    return SiteSettingsModel(**raw)


@router.put("", response_model=SiteSettingsModel)
async def update_site_settings(
    payload: SiteSettingsModel,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> SiteSettingsModel:
    """Persist updated website configuration, limits, and maintenance mode."""
    client_ip = request.client.host if request.client else "unknown"
    updates = payload.model_dump()
    await db_manager.update_site_settings(updates)

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="SETTING_CHANGE",
        target="Site Settings",
        details={
            "maintenance_mode": payload.maintenance_mode,
            "max_file_size_mb": payload.max_file_size_mb,
            "max_concurrent_downloads": payload.max_concurrent_downloads
        },
        ip_address=client_ip
    )

    return payload
