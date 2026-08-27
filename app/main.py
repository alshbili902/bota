"""FastAPI application entrypoint for Rahami — رهامي."""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from app.api.routes import auth, download, health, ws
from app.api.routes.admin import (
    activity as admin_activity,
    auth as admin_auth,
    dashboard as admin_dashboard,
    database as admin_database,
    downloads as admin_downloads,
    errors as admin_errors,
    health as admin_health,
    settings as admin_settings,
    users as admin_users
)
from app.core.config import BASE_DIR, settings
from app.core.logging import setup_logging
from app.core.rate_limit import limiter
from app.db.database import init_db
from app.db.supabase import db_manager
from app.services.cleanup import run_periodic_cleanup_loop
from app.services.diagnostics import perform_safe_auto_recovery

logger = logging.getLogger("rahami.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: initialize databases, recovery, and cleanup background tasks."""
    setup_logging()
    logger.info("Initializing Rahami application...")

    # Validate directories and binaries
    settings.validate_strict_requirements()

    # Initialize databases
    await init_db()
    await db_manager.init_admin_database()

    # Perform safe self-recovery
    recovery_info = await perform_safe_auto_recovery()
    logger.info(f"Self-recovery check complete: {recovery_info}")

    # Launch periodic cleanup task
    cleanup_task = asyncio.create_task(
        run_periodic_cleanup_loop(interval_seconds=settings.HEALTH_CHECK_INTERVAL)
    )

    yield

    # Shutdown
    logger.info("Shutting down Rahami application...")
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Rahami — رهامي",
    description="Private luxury personal media downloader with admin control",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.ENVIRONMENT != "production" else None,
    redoc_url=None
)

# Attach rate limiter
app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "تم تجاوز الحد المسموح من الطلبات. يرجى الانتظار قليلًا."}
    )


# Maintenance Mode Middleware for Public/Normal Users
@app.middleware("http")
async def maintenance_mode_middleware(request: Request, call_next):
    # Bypass maintenance check for admin endpoints, auth, and health check
    path = request.url.path
    if (
        path.startswith("/api/admin")
        or path.startswith("/admin")
        or path.startswith("/api/health")
        or path.startswith("/assets")
    ):
        return await call_next(request)

    # Check maintenance mode from site_settings
    if path.startswith("/api/download/start") or path.startswith("/api/download/analyze"):
        current_settings = await db_manager.get_site_settings()
        if current_settings.get("maintenance_mode", False):
            msg = current_settings.get(
                "maintenance_message",
                "الموقع حاليًا تحت الصيانة الدورية لتحديث الأنظمة، سنعود قريبًا."
            )
            return JSONResponse(
                status_code=503,
                content={"detail": msg}
            )

    return await call_next(request)


# CORS setup (Supports local network IPs like mobile phones)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Public User Routers
app.include_router(auth.router)
app.include_router(download.router)
app.include_router(ws.router)
app.include_router(health.router)

# Include Admin Dashboard Routers
app.include_router(admin_auth.router)
app.include_router(admin_dashboard.router)
app.include_router(admin_users.router)
app.include_router(admin_downloads.router)
app.include_router(admin_settings.router)
app.include_router(admin_health.router)
app.include_router(admin_errors.router)
app.include_router(admin_activity.router)
app.include_router(admin_database.router)

# Mount Admin Dashboard build if present under /admin
admin_dist = BASE_DIR / "admin-dashboard" / "dist"
if admin_dist.exists() and (admin_dist / "index.html").exists():
    app.mount("/admin/assets", StaticFiles(directory=str(admin_dist / "assets")), name="admin_assets")

    @app.get("/admin")
    @app.get("/admin/{full_path:path}")
    async def serve_admin_spa(full_path: str = ""):
        requested_file = admin_dist / full_path
        if full_path and requested_file.exists() and requested_file.is_file():
            return FileResponse(str(requested_file))
        return FileResponse(str(admin_dist / "index.html"))

# Mount Public Frontend build (Production single-port mode)
frontend_dist = BASE_DIR / "frontend" / "dist"
if frontend_dist.exists() and (frontend_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow API routes to be handled by routers
        if full_path.startswith("api/") or full_path.startswith("admin"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        requested_file = frontend_dist / full_path
        if full_path and requested_file.exists() and requested_file.is_file():
            return FileResponse(str(requested_file))
        return FileResponse(str(frontend_dist / "index.html"))
