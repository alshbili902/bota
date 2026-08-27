"""Structured logging configuration for Rahami.

Ensures that passwords, tokens, secrets, and authorization headers
are never logged in server outputs.
"""

from __future__ import annotations

import logging
import re
import sys

SENSITIVE_PATTERNS = [
    re.compile(r"password['\"]\s*:\s*['\"][^'\"]+['\"]", re.IGNORECASE),
    re.compile(r"bearer\s+[a-zA-Z0-9_\-\.]+", re.IGNORECASE),
    re.compile(r"secret['\"]\s*:\s*['\"][^'\"]+['\"]", re.IGNORECASE),
    re.compile(r"token['\"]\s*:\s*['\"][^'\"]+['\"]", re.IGNORECASE),
]


class SanitizingFormatter(logging.Formatter):
    """Sanitize sensitive tokens, credentials, and passwords from logs."""

    def format(self, record: logging.LogRecord) -> str:
        msg = super().format(record)
        for pattern in SENSITIVE_PATTERNS:
            msg = pattern.sub("[REDACTED]", msg)
        return msg


def setup_logging(log_level: str = "INFO") -> None:
    """Configure root and application loggers."""
    level = getattr(logging, log_level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter = SanitizingFormatter(
        fmt="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    # Clear existing handlers
    root_logger.handlers.clear()
    root_logger.addHandler(handler)

    # Set third-party logger levels
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("aiosqlite").setLevel(logging.WARNING)
