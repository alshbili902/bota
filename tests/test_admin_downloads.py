"""Tests for Admin download management, cancellation, and record deletion."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.db.database import get_db, init_db
from app.db.supabase import db_manager
from app.main import app
from tests.test_admin_auth import reset_test_admin


@pytest.mark.asyncio
async def test_admin_downloads_flow():
    """Verify listing paginated downloads, filtering, canceling, and deleting records."""
    await init_db()
    await db_manager.init_admin_database()
    await reset_test_admin()

    # Insert a dummy download task
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT OR REPLACE INTO download_tasks 
            (id, user_id, url, source, title, filename, status, total_bytes, format_id)
            VALUES 
            ('test-task-123', 'rahma', 'https://youtube.com/watch?v=sample', 'YouTube', 'Sample Video', 'sample.mp4', 'downloading', 52428800, '1080p')
            """
        )
        await db.commit()
    finally:
        await db.close()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        resp_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        assert resp_login.status_code == 200
        admin_token = resp_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. List downloads with pagination
        dl_resp = await client.get("/api/admin/downloads?page=1&page_size=10", headers=headers)
        assert dl_resp.status_code == 200
        data = dl_resp.json()
        assert data["total"] >= 1
        assert any(item["id"] == "test-task-123" for item in data["items"])

        # 2. Cancel download as admin
        cancel_resp = await client.post("/api/admin/downloads/test-task-123/cancel", headers=headers)
        assert cancel_resp.status_code == 200

        # Check status updated to cancelled
        db = await get_db()
        try:
            async with db.execute("SELECT status, error_message FROM download_tasks WHERE id = 'test-task-123'") as cur:
                task_row = await cur.fetchone()
                assert task_row["status"] == "cancelled"
                assert "مدير النظام" in task_row["error_message"]
        finally:
            await db.close()

        # 3. Delete download record as admin
        del_resp = await client.delete("/api/admin/downloads/test-task-123", headers=headers)
        assert del_resp.status_code == 200

        # Verify deleted
        db = await get_db()
        try:
            async with db.execute("SELECT COUNT(*) FROM download_tasks WHERE id = 'test-task-123'") as cur:
                count_row = await cur.fetchone()
                assert count_row[0] == 0
        finally:
            await db.close()
