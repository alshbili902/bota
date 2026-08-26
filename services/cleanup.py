"""Temporary file and task directory cleanup service."""

from __future__ import annotations

from pathlib import Path
import shutil
from config import Config
from utils.logging import logger


def create_temp_task_dir(task_id: str) -> Path:
    """Create an isolated temporary folder for a single download task."""
    task_dir = Config.TEMP_DIR / task_id
    task_dir.mkdir(parents=True, exist_ok=True)
    return task_dir


def clean_task_dir(task_dir: Path | str) -> None:
    """Safely delete an isolated task directory and all its contents."""
    try:
        path = Path(task_dir)
        if path.exists() and path.is_dir():
            shutil.rmtree(path, ignore_errors=True)
            logger.debug("Cleaned task directory: %s", path)
    except Exception as err:
        logger.warning("Failed to clean task directory %s: %s", task_dir, err)


def clean_orphaned_temp_dirs() -> None:
    """Clean all existing directories in temp/ on startup or shutdown."""
    if not Config.TEMP_DIR.exists():
        Config.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        return

    purged_count = 0
    for child in Config.TEMP_DIR.iterdir():
        try:
            if child.is_dir():
                shutil.rmtree(child, ignore_errors=True)
                purged_count += 1
            elif child.is_file():
                child.unlink(missing_ok=True)
                purged_count += 1
        except Exception as err:
            logger.warning("Failed to purge orphaned file %s: %s", child, err)

    if purged_count > 0:
        logger.info("Startup temp cleanup: purged %d orphaned items.", purged_count)
