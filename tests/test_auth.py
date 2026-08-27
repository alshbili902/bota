"""Tests for two-user authentication and authorization."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import Settings
from app.core.security import hash_password, verify_password
from app.main import app


@pytest.mark.asyncio
async def test_strictly_two_users_validation():
    """Verify that settings reject anything other than exactly two users."""
    # 0 users -> fails
    s_zero = Settings(ALLOWED_USERS="")
    assert len(s_zero.parse_allowed_users()) == 0
    with pytest.raises(ValueError, match="at least TWO"):
        s_zero.validate_strict_requirements()

    # 1 user -> fails
    s_one = Settings(ALLOWED_USERS="user1:$2b$12$fakehash")
    assert len(s_one.parse_allowed_users()) == 1
    with pytest.raises(ValueError, match="at least TWO"):
        s_one.validate_strict_requirements()

    # 3 users -> passes
    s_three = Settings(ALLOWED_USERS="u1:h1,u2:h2,u3:h3")
    assert len(s_three.parse_allowed_users()) == 3
    s_three.validate_strict_requirements()

    # Exactly 2 users -> passes
    s_two = Settings(ALLOWED_USERS="u1:h1,u2:h2")
    assert len(s_two.parse_allowed_users()) == 2
    s_two.validate_strict_requirements()


@pytest.mark.asyncio
async def test_password_hashing():
    """Verify bcrypt password hashing and verification."""
    plain = "SuperSecurePassword123!"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


@pytest.mark.asyncio
async def test_login_success_and_unauthorized_rejection():
    """Verify successful login for authorized user and 401 for unauthorized visitors."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Reject unauthenticated access to protected endpoints
        resp = await client.get("/api/auth/me")
        assert resp.status_code == 401

        resp_down = await client.post("/api/download/analyze", json={"url": "https://youtube.com/watch?v=test"})
        assert resp_down.status_code == 401

        # 2. Reject wrong password
        bad_login = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": "WrongPassword!"}
        )
        assert bad_login.status_code == 401
        assert "غير صحيحة" in bad_login.json()["detail"]

        # 3. Reject non-existent user
        fake_user = await client.post(
            "/api/auth/login",
            json={"username": "hacker", "password": "anypassword"}
        )
        assert fake_user.status_code == 401

        # 4. Successful login for authorized user rahma
        good_login = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": "Rahami2026!"}
        )
        assert good_login.status_code == 200
        data = good_login.json()
        assert "access_token" in data
        assert data["username"] == "rahma"

        token = data["access_token"]

        # 5. Access protected endpoint with token header
        me_resp = await client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == "rahma"
