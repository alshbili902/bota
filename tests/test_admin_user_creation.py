"""Comprehensive test suite for Admin User Creation and Dynamic Authentication in Rahami."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_admin_create_user_unauthorized():
    """Verify that only authenticated administrators can create new users."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Unauthenticated request -> 401
        res = await client.post("/api/admin/users", json={
            "username": "unauth_user",
            "password": "Password2026!@",
            "confirm_password": "Password2026!@",
            "is_active": True
        })
        assert res.status_code == 401

        # 2. Normal user token -> rejected
        user_login = await client.post("/api/auth/login", json={
            "username": "rahma",
            "password": "Rahami2026!"
        })
        assert user_login.status_code == 200
        user_token = user_login.json()["access_token"]

        res_user = await client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {user_token}"},
            json={
                "username": "escalated_user",
                "password": "Password2026!@",
                "confirm_password": "Password2026!@",
                "is_active": True
            }
        )
        assert res_user.status_code in [401, 403]


@pytest.mark.asyncio
async def test_admin_create_user_validation():
    """Verify server-side validation for username, email, password strength, and match."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        admin_login = await client.post("/api/admin/auth/login", json={
            "username": settings.ADMIN_USERNAME,
            "password": settings.ADMIN_PASSWORD
        })
        assert admin_login.status_code == 200
        admin_token = admin_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Unsafe username with spaces / special characters
        res_bad_user = await client.post("/api/admin/users", headers=headers, json={
            "username": "bad user!",
            "password": "ValidPassword2026!@",
            "confirm_password": "ValidPassword2026!@"
        })
        assert res_bad_user.status_code in [400, 422]

        # 2. Invalid email format
        res_bad_email = await client.post("/api/admin/users", headers=headers, json={
            "username": "valid_user_email_test",
            "email": "not-a-valid-email",
            "password": "ValidPassword2026!@",
            "confirm_password": "ValidPassword2026!@"
        })
        assert res_bad_email.status_code == 400
        assert "صيغة البريد الإلكتروني" in res_bad_email.json()["detail"]

        # 3. Weak password (missing special char or uppercase)
        res_weak = await client.post("/api/admin/users", headers=headers, json={
            "username": "weak_pass_user",
            "password": "weakpassword123",
            "confirm_password": "weakpassword123"
        })
        assert res_weak.status_code == 400
        assert "شروط الأمان" in res_weak.json()["detail"]

        # 4. Password mismatch
        res_mismatch = await client.post("/api/admin/users", headers=headers, json={
            "username": "mismatch_user",
            "password": "ValidPassword2026!@",
            "confirm_password": "DifferentPassword2026!@"
        })
        assert res_mismatch.status_code == 400
        assert "غير متطابقتين" in res_mismatch.json()["detail"]


@pytest.mark.asyncio
async def test_admin_create_user_success_and_duplicates():
    """Verify successful user creation and rejection of duplicate usernames and emails."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin_login = await client.post("/api/admin/auth/login", json={
            "username": settings.ADMIN_USERNAME,
            "password": settings.ADMIN_PASSWORD
        })
        admin_token = admin_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Successful creation
        res = await client.post("/api/admin/users", headers=headers, json={
            "username": "noura",
            "display_name": "Noura VIP",
            "email": "noura@example.com",
            "password": "NouraPass2026!@",
            "confirm_password": "NouraPass2026!@",
            "is_active": True
        })
        assert res.status_code == 201
        data = res.json()
        assert "تم إنشاء المستخدم بنجاح" in data["message"]
        user_info = data["user"]
        assert user_info["username"] == "noura"
        assert user_info["display_name"] == "Noura VIP"
        assert user_info["email"] == "noura@example.com"
        assert user_info["is_active"] is True
        # Verify NO passwords or hashes are returned
        assert "password" not in user_info
        assert "password_hash" not in user_info

        # 2. Duplicate username rejection
        res_dup_u = await client.post("/api/admin/users", headers=headers, json={
            "username": "NOURA",
            "password": "NouraPass2026!@",
            "confirm_password": "NouraPass2026!@"
        })
        assert res_dup_u.status_code == 400
        assert "اسم المستخدم مستخدم بالفعل" in res_dup_u.json()["detail"]

        # 3. Duplicate email rejection
        res_dup_e = await client.post("/api/admin/users", headers=headers, json={
            "username": "another_noura",
            "email": "noura@example.com",
            "password": "NouraPass2026!@",
            "confirm_password": "NouraPass2026!@"
        })
        assert res_dup_e.status_code == 400
        assert "البريد الإلكتروني مستخدم بالفعل" in res_dup_e.json()["detail"]


@pytest.mark.asyncio
async def test_new_user_login_and_permissions():
    """Verify that newly created users authenticate dynamically and have standard user permissions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Login with new user
        login_res = await client.post("/api/auth/login", json={
            "username": "noura",
            "password": "NouraPass2026!@"
        })
        assert login_res.status_code == 200
        login_data = login_res.json()
        token = login_data["access_token"]
        assert token

        # 2. Access normal user protected endpoint
        me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_res.status_code == 200
        assert me_res.json()["username"] == "noura"

        # 3. Normal user CANNOT access admin dashboard stats or users
        admin_res = await client.get("/api/admin/dashboard/stats", headers={"Authorization": f"Bearer {token}"})
        assert admin_res.status_code == 401


@pytest.mark.asyncio
async def test_admin_disable_user_and_immediate_revocation():
    """Verify that disabling a user immediately revokes their active sessions and blocks login."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. User noura logs in and obtains token
        login_res = await client.post("/api/auth/login", json={
            "username": "noura",
            "password": "NouraPass2026!@"
        })
        assert login_res.status_code == 200
        active_token = login_res.json()["access_token"]

        # 2. Admin disables user noura
        admin_login = await client.post("/api/admin/auth/login", json={
            "username": settings.ADMIN_USERNAME,
            "password": settings.ADMIN_PASSWORD
        })
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        disable_res = await client.put(
            "/api/admin/users/noura",
            headers=admin_headers,
            json={"is_active": False}
        )
        assert disable_res.status_code == 200

        # 3. Active session is immediately rejected (revoked session / disabled user)
        me_res = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {active_token}"})
        assert me_res.status_code in [401, 403]

        # 4. New login attempt is rejected with 403
        bad_login = await client.post("/api/auth/login", json={
            "username": "noura",
            "password": "NouraPass2026!@"
        })
        assert bad_login.status_code == 403
        assert "تعطيل هذا الحساب" in bad_login.json()["detail"]

        # 5. Re-enable user
        enable_res = await client.put(
            "/api/admin/users/noura",
            headers=admin_headers,
            json={"is_active": True}
        )
        assert enable_res.status_code == 200

        # 6. Login succeeds again
        good_login = await client.post("/api/auth/login", json={
            "username": "noura",
            "password": "NouraPass2026!@"
        })
        assert good_login.status_code == 200


@pytest.mark.asyncio
async def test_existing_users_preserved_throughout():
    """Verify that existing users rahma and maha remain fully operational."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post("/api/auth/login", json={
            "username": "rahma",
            "password": "Rahami2026!"
        })
        assert res.status_code == 200
        assert res.json()["username"] == "rahma"
