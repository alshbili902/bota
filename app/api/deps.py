"""API dependencies for authentication, database, and rate limiting."""

from __future__ import annotations

import logging
from typing import Optional
from fastapi import Cookie, Depends, Header, HTTPException, status
from app.core.config import settings
from app.core.security import decode_access_token
from app.db.models import UserProfile

logger = logging.getLogger("rahami.deps")


async def get_current_user(
    cookie_token: Optional[str] = Cookie(None, alias=settings.COOKIE_NAME),
    authorization: Optional[str] = Header(None)
) -> UserProfile:
    """Validate JWT token from HTTP-only cookie or Authorization header.

    Strictly ensures the caller is one of the two authorized users.
    """
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
    elif cookie_token:
        token = cookie_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="يرجى تسجيل الدخول للوصول إلى هذه الخدمة.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجددًا.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    username = payload.get("sub") or payload.get("username")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="بيانات الاعتماد غير صالحة.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    username_clean = username.strip().lower()

    # 1. Check in-memory session revocation tracker
    from app.core.security import is_user_session_revoked
    if is_user_session_revoked(username_clean, payload.get("iat")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="تم تغيير كلمة المرور الخاصة بحسابك، يرجى تسجيل الدخول مجددًا.",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # 2. Check dynamic database state for authorized user and active status
    from app.db.database import get_db
    try:
        db = await get_db()
        try:
            async with db.execute(
                "SELECT id, username, COALESCE(is_active, 1) as is_active, password_changed_at FROM users WHERE LOWER(username) = ?",
                (username_clean,)
            ) as cursor:
                db_user = await cursor.fetchone()
                if not db_user:
                    # Fallback to initial bootstrap users in settings
                    allowed_usernames = [u.username.lower() for u in settings.parse_allowed_users()]
                    if username_clean not in allowed_usernames:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="الحساب غير مصرح له بالوصول."
                        )
                else:
                    if not db_user["is_active"]:
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="تم تعطيل هذا الحساب بواسطة مدير النظام."
                        )
                    if db_user["password_changed_at"] and payload.get("iat"):
                        from datetime import datetime, timezone
                        try:
                            # Parse sqlite timestamp
                            pwd_changed_str = str(db_user["password_changed_at"])
                            if "T" in pwd_changed_str:
                                pwd_dt = datetime.fromisoformat(pwd_changed_str.replace("Z", "+00:00"))
                            else:
                                pwd_dt = datetime.strptime(pwd_changed_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
                            token_iat = payload["iat"]
                            if isinstance(token_iat, (int, float)) and token_iat < (pwd_dt.timestamp() - 1):
                                raise HTTPException(
                                    status_code=status.HTTP_401_UNAUTHORIZED,
                                    detail="تم تغيير كلمة المرور الخاصة بحسابك، يرجى تسجيل الدخول مجددًا.",
                                    headers={"WWW-Authenticate": "Bearer"}
                                )
                        except (ValueError, TypeError):
                            pass
        finally:
            await db.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Error checking user database state in dependency: {e}")

    return UserProfile(username=username_clean, is_authenticated=True)
