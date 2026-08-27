"""Tests for Admin authentication, lockout, and credential updates."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.core.security import hash_password
from app.db.database import get_db, init_db
from app.db.supabase import db_manager
from app.main import app


async def reset_test_admin():
    """Reset the admin user in the database to default settings."""
    db = await get_db()
    try:
        await db.execute("DELETE FROM admin_users")
        await db.execute(
            """
            INSERT INTO admin_users (id, username, password_hash)
            VALUES ('admin-test-id', ?, ?)
            """,
            (settings.ADMIN_USERNAME.lower(), hash_password(settings.ADMIN_PASSWORD))
        )
        await db.commit()
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_admin_bootstrap_and_login():
    """Verify initial admin bootstrap from settings and successful login."""
    await init_db()
    await db_manager.init_admin_database()
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request to admin endpoint is rejected (401)
        resp_unauth = await client.get("/api/admin/dashboard/stats")
        assert resp_unauth.status_code == 401

        # 2. Failed login with wrong password
        resp_bad = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": "WrongAdminPassword!"}
        )
        assert resp_bad.status_code == 401
        assert "غير صحيحة" in resp_bad.json()["detail"]

        # 3. Successful admin login with initial bootstrap password
        resp_good = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        assert resp_good.status_code == 200
        admin_data = resp_good.json()
        assert "access_token" in admin_data
        admin_token = admin_data["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 4. Verify /api/admin/auth/me returns admin profile
        me_resp = await client.get("/api/admin/auth/me", headers=headers)
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == settings.ADMIN_USERNAME.lower()
        assert me_resp.json()["is_admin"] is True


@pytest.mark.asyncio
async def test_normal_user_cannot_access_admin():
    """Verify that normal authenticated users are rejected from admin APIs with 403."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Login as normal user rahma
        login_resp = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": "Rahami2026!"}
        )
        assert login_resp.status_code == 200
        user_token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {user_token}"}

        # Try to access admin dashboard stats
        admin_resp = await client.get("/api/admin/dashboard/stats", headers=headers)
        assert admin_resp.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_change_credentials():
    """Verify that administrator can change their username and password."""
    await reset_test_admin()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login with current credentials
        resp_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        assert resp_login.status_code == 200
        token = resp_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Update admin username and password
        update_resp = await client.put(
            "/api/admin/auth/account",
            headers=headers,
            json={
                "current_password": settings.ADMIN_PASSWORD,
                "new_username": "superadmin",
                "new_password": "NewAdminPass2026!",
                "confirm_password": "NewAdminPass2026!"
            }
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["require_login"] is True

        # 3. Old password should now fail
        old_login = await client.post(
            "/api/admin/auth/login",
            json={"username": "superadmin", "password": settings.ADMIN_PASSWORD}
        )
        assert old_login.status_code == 401

        # 4. Login with new credentials succeeds
        new_login = await client.post(
            "/api/admin/auth/login",
            json={"username": "superadmin", "password": "NewAdminPass2026!"}
        )
        assert new_login.status_code == 200
        assert new_login.json()["username"] == "superadmin"

    # Reset admin back
    await reset_test_admin()


@pytest.mark.asyncio
async def test_admin_auxiliary_endpoints():
    """Verify health telemetry, error center, activity audit logs, and database overview."""
    await reset_test_admin()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        token = resp_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. System health
        health_resp = await client.get("/api/admin/health", headers=headers)
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert "status" in health_data
        assert "cpu_percent" in health_data
        assert "memory_percent" in health_data

        # 2. Errors
        err_resp = await client.get("/api/admin/errors", headers=headers)
        assert err_resp.status_code == 200
        assert isinstance(err_resp.json(), list)

        # 3. Activity audit logs
        act_resp = await client.get("/api/admin/activity?page=1&page_size=10", headers=headers)
        assert act_resp.status_code == 200
        assert "items" in act_resp.json()

        # 4. Database overview
        db_resp = await client.get("/api/admin/database/overview", headers=headers)
        assert db_resp.status_code == 200
        db_data = db_resp.json()
        assert db_data["connected"] is True
        assert "tables" in db_data

