"""Admin user management routes."""

from __future__ import annotations

import logging
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.api.admin_deps import get_current_admin
from app.core.security import validate_password_complexity
from app.db.admin_models import (
    AdminChangeUserPasswordRequest,
    AdminProfileResponse,
    AdminResetPasswordRequest,
    AdminUserCreateRequest,
    AdminUserEditRequest,
    AdminUserItem
)
from app.db.supabase import db_manager
from app.services.admin_service import admin_service

logger = logging.getLogger("rahami.api.admin_users")

router = APIRouter(prefix="/api/admin/users", tags=["admin_users"])


@router.get("", response_model=List[AdminUserItem])
async def list_platform_users(
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> List[AdminUserItem]:
    """List all authorized platform users with their activity metrics."""
    return await admin_service.list_users()


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_platform_user(
    payload: AdminUserCreateRequest,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Create a new authorized platform user directly from Admin Dashboard."""
    client_ip = request.client.host if request.client else "unknown"

    # Validate password confirmation if supplied
    if payload.confirm_password is not None and payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمتا المرور غير متطابقتين."
        )

    new_user = await admin_service.create_user(payload)

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="USER_CREATED",
        target=f"User {new_user.username}",
        details={
            "username": new_user.username,
            "display_name": new_user.display_name,
            "email": new_user.email,
            "is_active": new_user.is_active
        },
        ip_address=client_ip
    )

    return {
        "message": "تم إنشاء المستخدم بنجاح.",
        "user": new_user.model_dump() if hasattr(new_user, "model_dump") else new_user.dict()
    }


@router.put("/{user_id}")
async def update_platform_user(
    user_id: str,
    payload: AdminUserEditRequest,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Update user username, display name, email, password, or active status."""
    client_ip = request.client.host if request.client else "unknown"
    success = await admin_service.update_user(
        user_id=user_id,
        new_username=payload.username,
        display_name=payload.display_name,
        email=payload.email,
        new_password=payload.password,
        is_active=payload.is_active
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="تعذر تعديل بيانات المستخدم."
        )

    # Determine specific audit action
    action = "USER_EDIT"
    if payload.is_active is False:
        action = "USER_DISABLED"
    elif payload.is_active is True and payload.username is None and payload.display_name is None:
        action = "USER_ENABLED"

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action=action,
        target=f"User {user_id}",
        details={
            "new_username": payload.username,
            "display_name": payload.display_name,
            "email": payload.email,
            "is_active": payload.is_active,
            "password_changed": bool(payload.password)
        },
        ip_address=client_ip
    )

    return {"message": "تم تحديث بيانات المستخدم بنجاح."}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: str,
    payload: AdminResetPasswordRequest,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Reset user password and return the new credentials securely to the admin."""
    client_ip = request.client.host if request.client else "unknown"
    new_password = await admin_service.reset_user_password(user_id, payload.new_password)

    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="PASSWORD_CHANGE",
        target=f"User {user_id}",
        ip_address=client_ip
    )

    return {
        "message": "تمت إعادة تعيين كلمة المرور بنجاح.",
        "new_password": new_password
    }


@router.post("/{user_id}/change-password")
async def change_user_password(
    user_id: str,
    payload: AdminChangeUserPasswordRequest,
    request: Request,
    current_admin: AdminProfileResponse = Depends(get_current_admin)
) -> dict:
    """Securely change an authorized user's password with enterprise validation,
    hash it using bcrypt, invalidate all user sessions, and record an audit event.
    
    Never displays or logs plaintext passwords.
    """
    client_ip = request.client.host if request.client else "unknown"

    # 1. Validate confirmation password match if provided
    if payload.confirm_password is not None and payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="كلمتا المرور غير متطابقتين."
        )

    # 2. Strict password complexity policy verification
    is_valid, error_msg = validate_password_complexity(payload.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg or "كلمة المرور لا تستوفي شروط الأمان."
        )

    # 3. Execute password mutation and session invalidation
    target_username = await admin_service.change_user_password(user_id, payload.new_password)
    if not target_username:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="المستخدم غير موجود."
        )

    # 4. Record sanitized audit log (strictly zero plaintext passwords or hashes)
    await db_manager.log_admin_event(
        admin_username=current_admin.username,
        action="PASSWORD_CHANGED",
        target=f"User {target_username}",
        details={"target_username": target_username},
        ip_address=client_ip
    )

    return {"message": "تم تغيير كلمة المرور بنجاح."}

