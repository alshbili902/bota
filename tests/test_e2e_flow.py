"""End-to-End integration test for Rahami — رهامي."""

from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient
from app.core.config import settings
from app.db.database import init_db
from app.main import app


@pytest.mark.asyncio
async def test_complete_e2e_flow():
    """Verify complete end-to-end flow: SPA serve -> Login -> Health -> User isolation."""
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Verify SPA Root Serving
        spa_resp = await client.get("/")
        assert spa_resp.status_code == 200
        assert "رهامي" in spa_resp.text

        # 2. Verify Health Check
        health_resp = await client.get("/api/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["ytdlp_available"] is True

        # 3. Authenticate User 1 (rahma)
        login_resp = await client.post(
            "/api/auth/login",
            json={"username": "rahma", "password": "Rahami2026!"}
        )
        assert login_resp.status_code == 200
        rahma_token = login_resp.json()["access_token"]
        headers_rahma = {"Authorization": f"Bearer {rahma_token}"}

        # 4. Authenticate User 2 (maha)
        login_resp_maha = await client.post(
            "/api/auth/login",
            json={"username": "maha", "password": "MahaDownload2026!"}
        )
        assert login_resp_maha.status_code == 200
        maha_token = login_resp_maha.json()["access_token"]
        headers_maha = {"Authorization": f"Bearer {maha_token}"}

        # 5. Check Identity Isolation
        me_rahma = await client.get("/api/auth/me", headers=headers_rahma)
        assert me_rahma.json()["username"] == "rahma"

        me_maha = await client.get("/api/auth/me", headers=headers_maha)
        assert me_maha.json()["username"] == "maha"

        # 6. Verify User Isolation in History
        history_rahma = await client.get("/api/download/user/history", headers=headers_rahma)
        assert history_rahma.status_code == 200
        assert isinstance(history_rahma.json(), list)

        history_maha = await client.get("/api/download/user/history", headers=headers_maha)
        assert history_maha.status_code == 200
        assert isinstance(history_maha.json(), list)
