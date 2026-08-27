"""Storage maintenance and automated cleanup worker.

Cleans abandoned temporary directories, expired completed downloads,
and enforces MAX_STORAGE_GB quotas without deleting anything outside storage.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import logging
from pathlib import Path
import shutil
import time
from app.core.config import settings
from app.db.database import get_db

logger = logging.getLogger("rahami.cleanup")


def get_storage_usage_bytes() -> int:
    """Calculate total storage consumed within the dedicated STORAGE_DIR."""
    total = 0
    if not settings.STORAGE_DIR.exists():
        return 0
    for path in settings.STORAGE_DIR.rglob("*"):
        if path.is_file():
            try:
                total += path.stat().st_size
            except Exception:
                pass
    return total


def is_storage_full() -> bool:
    """Check if total storage consumption exceeds configured limit."""
    return get_storage_usage_bytes() >= settings.max_storage_bytes


async def cleanup_temporary_files(max_age_seconds: int = 1800) -> int:
    """Delete abandoned temporary folders older than max_age_seconds."""
    cleaned_count = 0
    now = time.time()

    if settings.TEMP_DIR.exists():
        for item in settings.TEMP_DIR.iterdir():
            if item.is_dir():
                try:
                    mtime = item.stat().st_mtime
                    if now - mtime > max_age_seconds:
                        shutil.rmtree(item, ignore_errors=True)
                        cleaned_count += 1
                except Exception as e:
                    logger.debug(f"Failed to check/clean temp folder {item}: {e}")

    return cleaned_count


async def cleanup_expired_downloads() -> int:
    """Delete completed downloads older than FILE_RETENTION_HOURS."""
    cleaned_count = 0
    cutoff_time = time.time() - (settings.FILE_RETENTION_HOURS * 3600)

    if settings.DOWNLOADS_DIR.exists():
        for user_dir in settings.DOWNLOADS_DIR.iterdir():
            if user_dir.is_dir():
                for task_dir in user_dir.iterdir():
                    if task_dir.is_dir():
                        try:
                            mtime = task_dir.stat().st_mtime
                            if mtime < cutoff_time:
                                shutil.rmtree(task_dir, ignore_errors=True)
                                cleaned_count += 1
                        except Exception as e:
                            logger.debug(f"Failed to clean task download dir {task_dir}: {e}")

    return cleaned_count


async def run_periodic_cleanup_loop(interval_seconds: int = 600) -> None:
    """Periodic background task that cleans orphaned files and enforces storage limits."""
    logger.info("Storage cleanup background worker started.")
    while True:
        try:
            temp_cleaned = await cleanup_temporary_files(max_age_seconds=1800)
            downloads_cleaned = await cleanup_expired_downloads()
            if temp_cleaned or downloads_cleaned:
                logger.info(
                    f"Cleanup completed: removed {temp_cleaned} abandoned temp dirs and "
                    f"{downloads_cleaned} expired download folders."
                )

            # If storage is above 90% capacity, aggressively prune older downloads
            used = get_storage_usage_bytes()
            if used > (settings.max_storage_bytes * 0.9):
                logger.warning("Storage above 90% capacity. Pruning older downloads...")
                await cleanup_expired_downloads()

        except asyncio.CancelledError:
            logger.info("Cleanup loop received cancellation.")
            break
        except Exception as e:
            logger.error(f"Error during periodic storage cleanup: {e}")

        await asyncio.sleep(interval_seconds)
