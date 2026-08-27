"""Admin security, JWT issuance, and lockout protection."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import time
from typing import Dict, Optional, Tuple
import jwt
from app.core.config import settings
from app.core.security import hash_password, verify_password

logger = logging.getLogger("rahami.admin_security")

_ADMIN_FAILED_LOGINS: Dict[str, list[float]] = {}
ADMIN_MAX_FAILED_ATTEMPTS = 5
ADMIN_LOCKOUT_DURATION_SECONDS = 900  # 15 minutes


def is_admin_locked(client_identifier: str) -> Tuple[bool, int]:
    """Check if client IP is locked out from admin portal."""
    now = time.time()
    attempts = _ADMIN_FAILED_LOGINS.get(client_identifier, [])
    recent = [t for t in attempts if now - t < ADMIN_LOCKOUT_DURATION_SECONDS]
    _ADMIN_FAILED_LOGINS[client_identifier] = recent

    if len(recent) >= ADMIN_MAX_FAILED_ATTEMPTS:
        oldest = recent[0]
        remaining = int(ADMIN_LOCKOUT_DURATION_SECONDS - (now - oldest))
        return True, max(remaining, 1)
    return False, 0


def record_admin_failed_login(client_identifier: str) -> None:
    """Record a failed admin login attempt."""
    now = time.time()
    if client_identifier not in _ADMIN_FAILED_LOGINS:
        _ADMIN_FAILED_LOGINS[client_identifier] = []
    _ADMIN_FAILED_LOGINS[client_identifier].append(now)


def clear_admin_failed_logins(client_identifier: str) -> None:
    """Clear failed login records after successful admin login."""
    _ADMIN_FAILED_LOGINS.pop(client_identifier, None)


def create_admin_token(username: str) -> str:
    """Create a signed JWT token specifically for the admin session."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ADMIN_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": username.lower(),
        "username": username.lower(),
        "role": "admin",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_admin_token(token: str) -> Optional[dict]:
    """Decode and verify admin JWT token and role."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("role") != "admin":
            logger.warning("Token provided is not an admin role token.")
            return None
        return payload
    except jwt.PyJWTError as e:
        logger.debug(f"Admin token verification failed: {e}")
        return None
