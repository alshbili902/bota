"""Tests for Admin user management and password resets."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.db.database import init_db
from app.db.supabase import db_manager
from app.main import app


@pytest.mark.asyncio
async def test_admin_user_management():
    """Verify admin listing users, editing user details, and resetting user passwords."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Admin login
        resp_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        assert resp_login.status_code == 200
        token = resp_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. List platform users
        users_resp = await client.get("/api/admin/users", headers=headers)
        assert users_resp.status_code == 200
        users = users_resp.json()
        assert len(users) >= 2  # The 2 authorized users rahma and maha

        # 3. Update user 'rahma' display name
        update_resp = await client.put(
            "/api/admin/users/rahma",
            headers=headers,
            json={"display_name": "Rahami VIP", "is_active": True}
        )
        assert update_resp.status_code == 200

        # 4. Reset user 'maha' password
        reset_resp = await client.post(
            "/api/admin/users/maha/reset-password",
            headers=headers,
            json={"new_password": "NewMahaPassword2026!"}
        )
        assert reset_resp.status_code == 200
        assert reset_resp.json()["new_password"] == "NewMahaPassword2026!"

        # 5. User maha can login with new password
        user_login = await client.post(
            "/api/auth/login",
            json={"username": "maha", "password": "NewMahaPassword2026!"}
        )
        assert user_login.status_code == 200
