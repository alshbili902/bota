"""System hardware and service telemetry monitoring service."""

from __future__ import annotations

import logging
from pathlib import Path
import shutil
import time
import psutil
from app.core.config import settings
from app.db.admin_models import SystemHealthDetail
from app.db.supabase import db_manager
from app.services.cleanup import get_storage_usage_bytes
from app.services.download_manager import download_manager

logger = logging.getLogger("rahami.monitor")

START_TIME = time.time()


def get_deep_system_telemetry() -> SystemHealthDetail:
    """Gather real live metrics for CPU, Memory, Disk, and external tools."""
    # 1. System binaries
    ytdlp_bin = settings.YTDLP_PATH or shutil.which("yt-dlp")
    ffmpeg_bin = settings.FFMPEG_PATH or shutil.which("ffmpeg")
    ffprobe_bin = settings.FFPROBE_PATH or shutil.which("ffprobe")

    ytdlp_ok = bool(ytdlp_bin and Path(ytdlp_bin).exists())
    ffmpeg_ok = bool(ffmpeg_bin and Path(ffmpeg_bin).exists())
    ffprobe_ok = bool(ffprobe_bin and Path(ffprobe_bin).exists())

    # 2. CPU & Memory
    try:
        cpu_pct = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory()
        mem_used_mb = round((mem.total - mem.available) / (1024 * 1024), 1)
        mem_total_mb = round(mem.total / (1024 * 1024), 1)
        mem_pct = mem.percent
    except Exception:
        cpu_pct = 0.0
        mem_used_mb = 0.0
        mem_total_mb = 0.0
        mem_pct = 0.0

    # 3. Disk space of storage directory
    try:
        disk = psutil.disk_usage(str(settings.STORAGE_DIR))
        disk_used_gb = round(disk.used / (1024 * 1024 * 1024), 2)
        disk_total_gb = round(disk.total / (1024 * 1024 * 1024), 2)
        disk_pct = disk.percent
    except Exception:
        disk_used_gb = 0.0
        disk_total_gb = 0.0
        disk_pct = 0.0

    # 4. Active downloads & queue
    active_count = len(download_manager.active_services)

    # 5. Determine overall health status
    status = "healthy"
    if not (ytdlp_ok and ffmpeg_ok):
        status = "critical"
    elif cpu_pct > 90 or mem_pct > 90 or disk_pct > 95:
        status = "warning"

    uptime = round(time.time() - START_TIME, 1)

    return SystemHealthDetail(
        status=status,
        ytdlp_available=ytdlp_ok,
        ffmpeg_available=ffmpeg_ok,
        ffprobe_available=ffprobe_ok,
        supabase_connected=db_manager.is_supabase_enabled,
        database_engine="Supabase PostgreSQL" if db_manager.is_supabase_enabled else "SQLite (Local Dev)",
        cpu_percent=cpu_pct,
        memory_used_mb=mem_used_mb,
        memory_total_mb=mem_total_mb,
        memory_percent=mem_pct,
        disk_used_gb=disk_used_gb,
        disk_total_gb=disk_total_gb,
        disk_percent=disk_pct,
        active_downloads=active_count,
        queue_length=0,
        uptime_seconds=uptime
    )
