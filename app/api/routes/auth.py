"""Authentication routes for Rahami."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import (
    clear_failed_logins,
    create_access_token,
    is_rate_locked,
    record_failed_login,
    verify_password
)
from app.db.database import get_db
from app.db.models import LoginRequest, TokenResponse, UserProfile

logger = logging.getLogger("rahami.auth")

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest
) -> TokenResponse:
    """Authenticate authorized user, set secure HTTP-only cookie, and issue JWT."""
    client_ip = request.client.host if request.client else "unknown"
    lockout_key = f"{client_ip}:{payload.username.lower()}"

    # 1. Check brute force lockout
    is_locked, remaining_sec = is_rate_locked(lockout_key)
    if is_locked:
        logger.warning(f"Brute force lockout active for {client_ip} ({payload.username})")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"تم حظر المحاولات مؤقتًا لعدة محاولات خاطئة. يرجى المحاولة بعد {remaining_sec} ثانية."
        )

    # 2. Match credentials against database users table
    db = await get_db()
    matched_user_username = None
    try:
        async with db.execute(
            "SELECT username, password_hash, COALESCE(is_active, 1) as is_active FROM users WHERE LOWER(username) = ?",
            (payload.username.strip().lower(),)
        ) as cursor:
            db_user = await cursor.fetchone()
            if db_user:
                if not db_user["is_active"]:
                    logger.warning(f"Login rejected: account {payload.username} is disabled.")
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="تم تعطيل هذا الحساب بواسطة مدير النظام."
                    )
                if verify_password(payload.password, db_user["password_hash"]):
                    matched_user_username = db_user["username"]
                    # Update last_login timestamp
                    try:
                        await db.execute(
                            "UPDATE users SET last_login = CURRENT_TIMESTAMP, last_activity = CURRENT_TIMESTAMP WHERE LOWER(username) = ?",
                            (matched_user_username.lower(),)
                        )
                        await db.commit()
                    except Exception:
                        pass
    finally:
        await db.close()

    # Fallback to configured allowed users in settings if database row was not found
    if not matched_user_username:
        allowed_users = settings.parse_allowed_users()
        for u in allowed_users:
            if u.username.lower() == payload.username.strip().lower():
                if verify_password(payload.password, u.password_hash):
                    matched_user_username = u.username
                    break

    if not matched_user_username:
        record_failed_login(lockout_key)
        logger.warning(f"Failed login attempt for username: {payload.username} from IP: {client_ip}")
        # Always return generic message to avoid leaking user existence
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم المستخدم أو كلمة المرور غير صحيحة."
        )

    # Successful login
    clear_failed_logins(lockout_key)
    access_token = create_access_token(data={"sub": matched_user_username})

    # Set secure HTTP-only cookie
    response.set_cookie(
        key=settings.COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    logger.info(f"Successful login for user: {matched_user_username}")
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        username=matched_user_username
    )


@router.post("/logout")
async def logout(response: Response) -> dict:
    """Clear session cookie and log out."""
    response.delete_cookie(
        key=settings.COOKIE_NAME,
        path="/",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "تم تسجيل الخروج بنجاح."}


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: UserProfile = Depends(get_current_user)) -> UserProfile:
    """Return profile of currently authenticated user."""
    return current_user
