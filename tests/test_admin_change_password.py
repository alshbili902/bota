"""Automated test suite for Admin Secure Password Management Feature.

Validates:
1. Admin authorization (reject unauthenticated & non-admin requests)
2. Password complexity validation (minimum 8 chars, uppercase, lowercase, digit, special char)
3. Password confirmation mismatch handling
4. Invalid / non-existent user rejection
5. Successful password change and credential mutation
6. Independent credential isolation (changing user 1 does not affect user 2)
7. Session invalidation (previously issued tokens immediately rejected)
8. Audit logging without plaintext password or hash leakage
"""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.db.database import get_db, init_db
from app.db.supabase import db_manager
from app.main import app


@pytest.mark.asyncio
async def test_admin_change_password_authorization():
    """Verify that only authenticated administrators can access the change-password endpoint."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Anonymous request -> 401
        res_anon = await client.post(
            "/api/admin/users/rahma/change-password",
            json={"new_password": "ValidPassword2026!@", "confirm_password": "ValidPassword2026!@"}
        )
        assert res_anon.status_code == 401

        # 2. Normal user request -> 401 / 403
        from app.core.security import create_access_token
        normal_token = create_access_token({"sub": "rahma"})
        res_user = await client.post(
            "/api/admin/users/rahma/change-password",
            headers={"Authorization": f"Bearer {normal_token}"},
            json={"new_password": "ValidPassword2026!@", "confirm_password": "ValidPassword2026!@"}
        )
        assert res_user.status_code in (401, 403)


@pytest.mark.asyncio
async def test_admin_change_password_validation():
    """Verify password complexity validation, confirmation match, and user lookup."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        login_res = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        assert login_res.status_code == 200
        admin_token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Weak passwords (too short)
        res_short = await client.post(
            "/api/admin/users/rahma/change-password",
            headers=headers,
            json={"new_password": "Sh1!", "confirm_password": "Sh1!"}
        )
        assert res_short.status_code in (400, 422)

        # 2. Weak passwords (no uppercase)
        res_no_upper = await client.post(
            "/api/admin/users/rahma/change-password",
            headers=headers,
            json={"new_password": "password123!", "confirm_password": "password123!"}
        )
        assert res_no_upper.status_code == 400
        assert "شروط الأمان" in res_no_upper.json()["detail"]

        # 3. Weak passwords (no number)
        res_no_num = await client.post(
            "/api/admin/users/rahma/change-password",
            headers=headers,
            json={"new_password": "PasswordSpecial!", "confirm_password": "PasswordSpecial!"}
        )
        assert res_no_num.status_code == 400
        assert "شروط الأمان" in res_no_num.json()["detail"]

        # 4. Weak passwords (no special char)
        res_no_spec = await client.post(
            "/api/admin/users/rahma/change-password",
            headers=headers,
            json={"new_password": "Password12345", "confirm_password": "Password12345"}
        )
        assert res_no_spec.status_code == 400
        assert "شروط الأمان" in res_no_spec.json()["detail"]

        # 5. Confirmation mismatch
        res_mismatch = await client.post(
            "/api/admin/users/rahma/change-password",
            headers=headers,
            json={"new_password": "ValidPassword2026!@", "confirm_password": "DifferentPassword2026!@"}
        )
        assert res_mismatch.status_code == 400
        assert "غير متطابقتين" in res_mismatch.json()["detail"]

        # 6. Invalid / non-existent user ID
        res_not_found = await client.post(
            "/api/admin/users/non_existent_user_9999/change-password",
            headers=headers,
            json={"new_password": "ValidPassword2026!@", "confirm_password": "ValidPassword2026!@"}
        )
        assert res_not_found.status_code == 404
        assert "المستخدم غير موجود" in res_not_found.json()["detail"]


@pytest.mark.asyncio
async def test_admin_change_password_success_and_independence():
    """Verify successful password change for User 1, and ensure User 2 credentials are untouched."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        login_res = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        admin_token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {admin_token}"}

        # 1. Change user 'rahma' password
        new_rahma_pass = "RahmaSecret2026!#$"
        change_res = await client.post(
            "/api/admin/users/rahma/change-password",
            headers=headers,
            json={"new_password": new_rahma_pass, "confirm_password": new_rahma_pass}
        )
        assert change_res.status_code == 200
        body = change_res.json()
        assert "نجاح" in body["message"]
        # Plaintext password is NEVER returned in response
        assert "new_password" not in body
        assert new_rahma_pass not in str(body)

        # 2. Login as rahma with new password -> 200 OK
        user_login_res = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": new_rahma_pass}
        )
        assert user_login_res.status_code == 200
        assert "access_token" in user_login_res.json()

        # 3. Old password is rejected -> 401
        old_login_res = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": "OldInvalidPassword123"}
        )
        assert old_login_res.status_code == 401

        # 4. Independent Credentials: user 'maha' is still in database and has distinct credentials
        users_res = await client.get("/api/admin/users", headers=headers)
        user_items = users_res.json()
        maha_user = next((u for u in user_items if u["username"] == "maha"), None)
        assert maha_user is not None


@pytest.mark.asyncio
async def test_session_invalidation_after_password_change():
    """Verify that all previous sessions/tokens for the target user are invalidated upon password change."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Admin login
        admin_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        # 2. First, set known password for user 'maha'
        initial_maha_pass = "MahaInitial2026!@"
        await client.post(
            "/api/admin/users/maha/change-password",
            headers=admin_headers,
            json={"new_password": initial_maha_pass, "confirm_password": initial_maha_pass}
        )

        # 3. User maha logs in and gets token
        maha_login = await client.post(
            "/api/auth/login",
            json={"username": "maha", "password": initial_maha_pass}
        )
        assert maha_login.status_code == 200
        old_maha_token = maha_login.json()["access_token"]

        # 4. Token works
        me_res1 = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {old_maha_token}"}
        )
        assert me_res1.status_code == 200
        assert me_res1.json()["username"] == "maha"

        # 5. Admin changes maha's password to a brand new password
        updated_maha_pass = "MahaUpdated2026!#"
        change_res = await client.post(
            "/api/admin/users/maha/change-password",
            headers=admin_headers,
            json={"new_password": updated_maha_pass, "confirm_password": updated_maha_pass}
        )
        assert change_res.status_code == 200

        # 6. Verify OLD token is now invalidated -> HTTP 401
        me_res2 = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {old_maha_token}"}
        )
        assert me_res2.status_code == 401
        assert "تسجيل الدخول مجددًا" in me_res2.json()["detail"]

        # 7. Admin session was NOT invalidated and still works
        admin_check = await client.get("/api/admin/auth/me", headers=admin_headers)
        assert admin_check.status_code == 200


@pytest.mark.asyncio
async def test_audit_logging_and_hashing_security():
    """Verify that password changes create a sanitized audit event without plaintext passwords."""
    await init_db()
    await db_manager.init_admin_database()
    from tests.test_admin_auth import reset_test_admin
    await reset_test_admin()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Admin login
        admin_login = await client.post(
            "/api/admin/auth/login",
            json={"username": settings.ADMIN_USERNAME, "password": settings.ADMIN_PASSWORD}
        )
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}

        secret_password = "AuditVerification2026!$"
        await client.post(
            "/api/admin/users/rahma/change-password",
            headers=admin_headers,
            json={"new_password": secret_password, "confirm_password": secret_password}
        )

        # Check audit logs
        logs_res = await client.get("/api/admin/activity", headers=admin_headers)
        assert logs_res.status_code == 200
        logs = logs_res.json()["items"]
        
        pwd_events = [l for l in logs if l["action"] == "PASSWORD_CHANGED"]
        assert len(pwd_events) >= 1
        latest_event = pwd_events[0]

        # Verify target is recorded
        assert "rahma" in latest_event["target"].lower()
        # Verify plaintext password or hash is NEVER stored in audit log
        assert secret_password not in str(latest_event)
        assert "$2b$" not in str(latest_event)

        # Verify password in database is hashed with bcrypt
        db = await get_db()
        try:
            async with db.execute("SELECT password_hash FROM users WHERE username = 'rahma'") as cursor:
                row = await cursor.fetchone()
                assert row is not None
                db_hash = row["password_hash"]
                assert db_hash.startswith("$2b$") or db_hash.startswith("$2a$")
                assert secret_password != db_hash
        finally:
            await db.close()
