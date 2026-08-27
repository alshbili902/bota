"""Tests for system diagnostics and health endpoints."""

import pytest
from httpx import ASGITransport, AsyncClient
from app.main import app
from app.services.diagnostics import get_system_health, perform_safe_auto_recovery


@pytest.mark.asyncio
async def test_health_endpoint():
    """Verify health endpoint returns status without leaking server credentials."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert "status" in data
        assert "ytdlp_available" in data
        assert "ffmpeg_available" in data
        assert "storage_used_mb" in data
        assert "storage_free_mb" in data
        assert "max_storage_gb" in data
        # Ensure no sensitive tokens or secrets are leaked
        assert "SECRET_KEY" not in str(data)
        assert "ALLOWED_USERS" not in str(data)
        assert "password" not in str(data).lower()


@pytest.mark.asyncio
async def test_safe_auto_recovery():
    """Verify safe self-recovery runs without error."""
    recovery = await perform_safe_auto_recovery()
    assert recovery["success"] is True
    assert isinstance(recovery["actions_taken"], list)
