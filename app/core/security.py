"""Security module for Rahami.

Provides bcrypt password hashing/verification, JWT token handling,
and brute-force lockout protection.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import logging
import time
from typing import Any, Dict, Optional, Tuple
import bcrypt
import jwt
from app.core.config import settings

logger = logging.getLogger("rahami.security")

# Brute force protection tracker: key -> list of timestamp failures
_FAILED_LOGINS: Dict[str, list[float]] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_SECONDS = 900  # 15 minutes


def hash_password(password: str) -> str:
    """Hash a plain text password using bcrypt with salt rounds."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against its bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception as e:
        logger.warning(f"Error during password verification: {e}")
        return False


def is_rate_locked(client_identifier: str) -> Tuple[bool, int]:
    """Check if an identifier (IP or username) is currently locked out."""
    now = time.time()
    attempts = _FAILED_LOGINS.get(client_identifier, [])
    # Filter attempts within lockout window
    recent_attempts = [t for t in attempts if now - t < LOCKOUT_DURATION_SECONDS]
    _FAILED_LOGINS[client_identifier] = recent_attempts

    if len(recent_attempts) >= MAX_FAILED_ATTEMPTS:
        oldest = recent_attempts[0]
        remaining = int(LOCKOUT_DURATION_SECONDS - (now - oldest))
        return True, max(remaining, 1)
    return False, 0


def record_failed_login(client_identifier: str) -> None:
    """Record a failed login attempt."""
    now = time.time()
    if client_identifier not in _FAILED_LOGINS:
        _FAILED_LOGINS[client_identifier] = []
    _FAILED_LOGINS[client_identifier].append(now)


def clear_failed_logins(client_identifier: str) -> None:
    """Clear failed login attempts after successful authentication."""
    _FAILED_LOGINS.pop(client_identifier, None)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": time.time()})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


# User Session Invalidation Tracker: username (lower) -> revocation timestamp
_USER_REVOCATION_TIMESTAMPS: Dict[str, float] = {}


def invalidate_user_sessions(username: str) -> None:
    """Invalidate all active sessions and issued tokens for a specific user."""
    _USER_REVOCATION_TIMESTAMPS[username.strip().lower()] = time.time()
    logger.info(f"Revoked all active sessions for user: {username}")


def is_user_session_revoked(username: str, token_issued_at: Optional[Any]) -> bool:
    """Check if a token was issued before the most recent session invalidation."""
    if not token_issued_at or not username:
        return False

    revocation_time = _USER_REVOCATION_TIMESTAMPS.get(username.strip().lower())
    if not revocation_time:
        return False

    # Convert token_issued_at to float seconds if datetime or numeric
    if isinstance(token_issued_at, datetime):
        token_iat_ts = token_issued_at.timestamp()
    elif isinstance(token_issued_at, (int, float)):
        token_iat_ts = float(token_issued_at)
    else:
        return False

    # Token issued before the revocation timestamp is revoked
    return token_iat_ts < revocation_time




def validate_password_complexity(password: str) -> Tuple[bool, Optional[str]]:
    """Validate that password meets enterprise security standards:
    - Minimum 8 characters
    - At least one uppercase letter (A-Z)
    - At least one lowercase letter (a-z)
    - At least one number (0-9)
    - At least one special character
    """
    import re
    if not password or len(password) < 8:
        return False, "كلمة المرور لا تستوفي شروط الأمان: يجب ألا تقل عن 8 أحرف."
    if not re.search(r"[A-Z]", password):
        return False, "كلمة المرور لا تستوفي شروط الأمان: يجب أن تحتوي على حرف كبير واحد على الأقل (A-Z)."
    if not re.search(r"[a-z]", password):
        return False, "كلمة المرور لا تستوفي شروط الأمان: يجب أن تحتوي على حرف صغير واحد على الأقل (a-z)."
    if not re.search(r"\d", password):
        return False, "كلمة المرور لا تستوفي شروط الأمان: يجب أن تحتوي على رقم واحد على الأقل (0-9)."
    if not re.search(r'[!@#$%^&*(),.?":{}|<>\-_=+~`\[\]/\\]', password):
        return False, "كلمة المرور لا تستوفي شروط الأمان: يجب أن تحتوي على رمز خاص واحد على الأقل (!@#$%...)."
    return True, None


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        logger.debug("Token has expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug(f"Invalid token: {e}")
        return None

