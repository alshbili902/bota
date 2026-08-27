"""Tests for download management, filename sanitization, and security."""

from pathlib import Path
import pytest
from app.core.config import settings
from app.db.database import init_db
from app.services.download_manager import download_manager
from app.services.downloader import sanitize_filename


def test_filename_sanitization():
    """Verify filename sanitization prevents path traversal and unsafe characters."""
    assert sanitize_filename("../../../etc/passwd") == "etcpasswd"
    assert sanitize_filename("..\\..\\windows\\system32") == "windowssystem32"
    assert sanitize_filename('test:video/with*bad?chars"and<pipes>|') == "testvideowithbadcharsandpipes"
    assert sanitize_filename("   hello world   ") == "hello world"
    assert sanitize_filename("") == "media_download"


@pytest.mark.asyncio
async def test_task_creation_and_cancellation():
    """Verify creating and cancelling a download task updates state cleanly."""
    await init_db()

    task = await download_manager.create_task(
        user_id="rahma",
        url="https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        format_id="best",
        format_type="video",
        title="Rick Astley - Never Gonna Give You Up",
        source="YouTube"
    )

    assert task.id is not None
    assert task.status in ("queued", "downloading")
    assert task.title == "Rick Astley - Never Gonna Give You Up"

    # Fetch task status
    fetched = await download_manager.get_task(task.id, "rahma")
    assert fetched is not None
    assert fetched.id == task.id

    # User isolation: user 'maha' cannot see user 'rahma's task
    isolated = await download_manager.get_task(task.id, "maha")
    assert isolated is None

    # Cancel task
    cancelled = await download_manager.cancel_task(task.id, "rahma")
    assert cancelled is True

    # Verify task status is cancelled
    after_cancel = await download_manager.get_task(task.id, "rahma")
    assert after_cancel.status == "cancelled"
