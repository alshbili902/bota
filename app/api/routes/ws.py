"""WebSocket route for real-time download progress broadcasting."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Cookie, Query, WebSocket, WebSocketDisconnect, status
from app.core.config import settings
from app.core.security import decode_access_token
from app.services.download_manager import download_manager

logger = logging.getLogger("rahami.ws")

router = APIRouter(tags=["websocket"])


@router.websocket("/api/ws/progress")
async def websocket_progress_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None)
):
    """Authenticate and connect WebSocket client for real-time download updates."""
    # Try token from query param or cookie
    jwt_token = token
    if not jwt_token:
        jwt_token = websocket.cookies.get(settings.COOKIE_NAME)

    if not jwt_token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    payload = decode_access_token(jwt_token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    username = payload.get("sub") or payload.get("username")
    if not username:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    username_clean = username.strip().lower()

    # Dynamic database user verification
    from app.db.database import get_db
    is_valid_user = False
    try:
        db = await get_db()
        try:
            async with db.execute(
                "SELECT COALESCE(is_active, 1) as is_active FROM users WHERE LOWER(username) = ?",
                (username_clean,)
            ) as cursor:
                db_user = await cursor.fetchone()
                if db_user and db_user["is_active"]:
                    is_valid_user = True
        finally:
            await db.close()
    except Exception:
        pass

    if not is_valid_user:
        allowed_usernames = [u.username.lower() for u in settings.parse_allowed_users()]
        if username_clean in allowed_usernames:
            is_valid_user = True

    if not is_valid_user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    download_manager.register_ws(username.lower(), websocket)
    logger.info(f"WebSocket client connected for user: {username}")

    try:
        # Send initial connection acknowledgment
        await websocket.send_json({
            "type": "connected",
            "message": "متصل بنجاح مع خادم المتابعة الفورية."
        })

        while True:
            # Keep connection open and handle client ping/messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user: {username}")
    except Exception as e:
        logger.debug(f"WebSocket error for user {username}: {e}")
    finally:
        download_manager.unregister_ws(username.lower(), websocket)
