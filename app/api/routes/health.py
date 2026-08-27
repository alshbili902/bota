"""Health check and safe diagnostics endpoint."""

from __future__ import annotations

import logging
from fastapi import APIRouter
from app.db.models import SystemHealthResponse
from app.services.diagnostics import get_system_health
from app.services.download_manager import download_manager

logger = logging.getLogger("rahami.api.health")

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=SystemHealthResponse)
async def health_check() -> SystemHealthResponse:
    """Return safe health status of application binaries, storage, and queue."""
    active_count = len(download_manager.active_services)
    return await get_system_health(active_downloads_count=active_count)
