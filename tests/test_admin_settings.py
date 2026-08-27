"""Tests for website settings and maintenance mode behavior."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.db.database import init_db
from app.db.supabase import db_manager
from app.main import app


@pytest.mark.asyncio
async def test_settings_and_maintenance_mode():
    """Verify admin site settings updates and maintenance mode blocking."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        resp_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        assert resp_login.status_code == 200
        admin_token = resp_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Fetch settings
        settings_resp = await client.get("/api/admin/settings", headers=admin_headers)
        assert settings_resp.status_code == 200
        current = settings_resp.json()
        assert current["site_name"] == "Rahami — رهامي"

        # 2. Turn ON maintenance mode
        current["maintenance_mode"] = True
        current["maintenance_message"] = "الموقع تحت الصيانة للتحديث."
        put_resp = await client.put("/api/admin/settings", headers=admin_headers, json=current)
        assert put_resp.status_code == 200
        assert put_resp.json()["maintenance_mode"] is True

        # 3. Normal user logs in
        login_u = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": "Rahami2026!"}
        )
        assert login_u.status_code == 200
        user_token = login_u.json()["access_token"]
        user_headers = {"Authorization": f"Bearer {user_token}"}

        # 4. Normal user download request blocked by 503 Maintenance
        dl_resp = await client.post(
            "/api/download/start",
            headers=user_headers,
            json={"url": "https://youtube.com/watch?v=test", "format_id": "best"}
        )
        assert dl_resp.status_code == 503
        assert "الموقع تحت الصيانة" in dl_resp.json()["detail"]

        # 5. Admin can still access endpoints normally
        admin_check = await client.get("/api/admin/dashboard/stats", headers=admin_headers)
        assert admin_check.status_code == 200

        # 6. Turn OFF maintenance mode
        current["maintenance_mode"] = False
        disable_resp = await client.put("/api/admin/settings", headers=admin_headers, json=current)
        assert disable_resp.status_code == 200
        assert disable_resp.json()["maintenance_mode"] is False
