"""Admin dependency injection and authorization guards."""

from __future__ import annotations

import logging
from typing import Optional
from fastapi import Cookie, Depends, Header, HTTPException, status
from app.core.admin_security import decode_admin_token
from app.core.config import settings
from app.db.admin_models import AdminProfileResponse
from app.db.database import get_db

logger = logging.getLogger("rahami.admin_deps")


async def get_current_admin(
    admin_cookie: Optional[str] = Cookie(None, alias=settings.ADMIN_COOKIE_NAME),
    authorization: Optional[str] = Header(None)
) -> AdminProfileResponse:
    """Validate admin token from HTTP-only cookie or Authorization header.

    Strictly guarantees that only authenticated administrators can access the endpoint.
    """
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif admin_cookie:
        token = admin_cookie

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="جلسة المدير غير مصرح بها أو انتهت صلاحيتها.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_admin_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="رمز الدخول غير صالح أو منتهي الصلاحية.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    username = payload.get("sub") or payload.get("username")
    if not username or payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="ليس لديك صلاحيات المدير للوصول إلى هذا المورد."
        )

    # Verify admin exists in admin_users table
    db = await get_db()
    try:
        async with db.execute(
            "SELECT username, created_at, last_login FROM admin_users WHERE username = ?",
            (username.lower(),)
        ) as cursor:
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="حساب المدير غير موجود."
                )

            return AdminProfileResponse(
                username=row["username"],
                is_admin=True,
                created_at=str(row["created_at"]) if row["created_at"] else None,
                last_login=str(row["last_login"]) if row["last_login"] else None
            )
    finally:
        await db.close()
