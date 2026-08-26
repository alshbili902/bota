"""Structured logging utility for Rahami Bot.

Avoids leaking bot tokens, secrets, or sensitive user query tokens.
"""

from __future__ import annotations

import logging
import re
import sys
from config import Config

# Ensure Windows stdout/stderr handles unicode and emojis without cp1256 crashes
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def setup_logger(name: str = "rahami") -> logging.Logger:
    """Set up and return a structured console logger."""
    logger = logging.getLogger(name)
    level_name = getattr(logging, Config.LOG_LEVEL, logging.INFO)
    logger.setLevel(level_name)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level_name)
        formatter = logging.Formatter(
            fmt="%(asctime)s | %(levelname)-7s | [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logger()


def sanitize_log_url(url: str) -> str:
    """Strip sensitive query parameters (tokens, signatures, keys) from URL before logging."""
    if not url:
        return ""
    # Strip common sensitive query params
    clean = re.sub(r"([?&](?:token|sig|signature|key|auth|pass|pwd|secret)=)[^&#]+", r"\1***", url, flags=re.I)
    return clean
