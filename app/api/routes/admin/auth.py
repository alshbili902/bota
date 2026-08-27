"""Admin authentication and account management routes."""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from app.api.admin_deps import get_current_admin
from app.core.admin_security import (
    clear_admin_failed_logins,
    create_admin_token,
    is_admin_locked,
    record_admin_failed_login
)
from app.core.config import settings
from app.core.rate_limit import limiter
from app.core.security import hash_password, verify_password
from app.db.admin_models import (
    AdminAccountUpdate,
    AdminLoginRequest,
    AdminProfileResponse,
    AdminTokenResponse
)
from app.db.database import get_db
from app.db.supabase import db_manager

logger = logging.getLogger("rahami.api.admin_auth")

router = APIRouter(prefix="/api/admin/auth", tags=["admin_auth"])


@router.post("/login", response_model=AdminTokenResponse)
@limiter.limit("10/minute")
async def admin_login(
    request: Request,
    response: Response,
    payload: AdminLoginRequest
) -> AdminTokenResponse:
    """Authenticate administrator, verify against admin_users, and issue admin JWT."""
    client_ip = request.client.host if request.client else "unknown"
    lockout_key = f"admin:{client_ip}"

    # 1. Check brute force lockout
    is_locked, remaining_sec = is_admin_locked(lockout_key)
    if is_locked:
        logger.warning(f"Admin login lockout active for IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"تم حظر تسجيل دخول المدير مؤقتًا بسبب تكرار الأخطاء. يرجى المحاولة بعد {remaining_sec} ثانية."
        )

    # 2. Check credentials in database
    db = await get_db()
    admin_row = None
    try:
        async with db.execute(
            "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
            (payload.username.strip().lower(),)
        ) as cursor:
            admin_row = await cursor.fetchone()
    finally:
        await db.close()

    if not admin_row or not verify_password(payload.password, admin_row["password_hash"]):
        record_admin_failed_login(lockout_key)
        logger.warning(f"Failed admin login attempt for user: {payload.username} from IP: {client_ip}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="اسم مستخدم المدير أو كلمة المرور غير صحيحة."
        )

    # Success: update last_login
    clear_admin_failed_logins(lockout_key)
    db = await get_db()
    try:
        await db.execute(
            "UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            (admin_row["id"],)
        )
        await db.commit()
    finally:
        await db.close()

    # Log to audit trail
    await db_manager.log_admin_event(
        admin_username=admin_row["username"],
        action="LOGIN",
        target="Admin Portal",
        ip_address=client_ip
    )

    # Create admin token
    token = create_admin_token(admin_row["username"])

    # Set secure HTTP-only admin cookie
    response.set_cookie(
        key=settings.ADMIN_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        max_age=settings.ADMIN_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    logger.info(f"Successful admin login for user: {admin_row['username']}")
    return AdminTokenResponse(
        access_token=token,
        token_type="bearer",
        username=admin_row["username"]
    )


@router.post("/logout")
async def admin_logout(
    response: Response,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Clear admin session and log out."""
    client_ip = request.client.host if request.client else "unknown"
    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="LOGOUT",
        target="Admin Portal",
        ip_address=client_ip
    )
    response.delete_cookie(
        key=settings.ADMIN_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite=settings.COOKIE_SAMESITE
    )
    return {"message": "تم تسجيل خروج المدير بنجاح."}


@router.get("/me", response_model=AdminProfileResponse)
async def get_admin_me(current_admin: AdminProfileResponse = Depends(get_current_admin)) -> AdminProfileResponse:
    """Return profile information of currently authenticated administrator."""
    return current_admin


@router.put("/account")
async def update_admin_account(
    request: Request,
    response: Response,
    payload: AdminAccountUpdate,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Allow administrator to update their username and password after verifying current password."""
    client_ip = request.client.host if request.client else "unknown"

    # Verify current password
    db = await get_db()
    try:
        async with db.execute(
            "SELECT id, username, password_hash FROM admin_users WHERE username = ?",
            (current_admin.username.lower(),)
        ) as cursor:
            admin_row = await cursor.fetchone()

        if not admin_row or not verify_password(payload.current_password, admin_row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="كلمة المرور الحالية غير صحيحة."
            )

        updates = []
        values = []
        new_username = current_admin.username

        if payload.new_username and payload.new_username.strip():
            new_username = payload.new_username.strip().lower()
            updates.append("username = ?")
            values.append(new_username)

        if payload.new_password:
            if payload.new_password != payload.confirm_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="كلمة المرور الجديدة وتأكيدها غير متطابقين."
                )
            if len(payload.new_password) < 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="يجب أن تتكون كلمة المرور من 6 خانات على الأقل."
                )
            new_hash = hash_password(payload.new_password)
            updates.append("password_hash = ?")
            values.append(new_hash)

        if not updates:
            return {"message": "لم يتم إجراء أي تعديل."}

        updates.append("updated_at = CURRENT_TIMESTAMP")
        values.append(admin_row["id"])

        await db.execute(
            f"UPDATE admin_users SET {', '.join(updates)} WHERE id = ?",
            values
        )
        await db.commit()

        # Audit log
        await db_manager.log_admin_event(
            admin_username=new_username,
            action="PASSWORD_CHANGE" if payload.new_password else "USER_EDIT",
            target=f"Admin Account ({new_username})",
            ip_address=client_ip
        )

        # Invalidate old cookie
        response.delete_cookie(key=settings.ADMIN_COOKIE_NAME, path="/")

        return {
            "message": "تم تحديث بيانات حساب المدير بنجاح. يرجى تسجيل الدخول بالبيانات الجديدة.",
            "require_login": True
        }
    finally:
        await db.close()
