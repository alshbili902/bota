"""File manipulation, sanitization, and formatting utilities."""

from __future__ import annotations

import os
from pathlib import Path
import re
import unicodedata


def sanitize_filename(name: str, ext: str | None = None, max_length: int = 80) -> str:
    """Sanitize a filename to prevent directory traversal and filesystem errors.

    Strips null bytes, directory separators (/ and \\), control characters,
    and reserved filename characters on Linux and Windows.
    """
    if not name or not name.strip():
        name = "media_file"

    # Remove null bytes and path traversal sequences
    clean = name.replace("\x00", "").replace("..", "_")

    # Normalize unicode characters
    clean = unicodedata.normalize("NFKC", clean)

    # Remove illegal characters across Windows and Linux: < > : " / \ | ? * and control chars
    clean = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", clean)

    # Collapse multiple underscores/spaces
    clean = re.sub(r"[\s_]+", "_", clean).strip(" ._")

    if not clean:
        clean = "media_file"

    # Truncate to maximum length safely
    clean = clean[:max_length].rstrip(" ._")

    if ext:
        ext_clean = ext.strip().lstrip(".").lower()
        # Ensure clean doesn't already end with .ext
        if ext_clean and not clean.lower().endswith(f".{ext_clean}"):
            clean = f"{clean}.{ext_clean}"

    return clean or "file.bin"


def format_bytes(bytes_count: int | float | None) -> str:
    """Convert bytes count to human readable format (e.g. 24.5 MB)."""
    if bytes_count is None or bytes_count <= 0:
        return "غير معروف"

    units = ["B", "KB", "MB", "GB", "TB"]
    size = float(bytes_count)
    unit_index = 0

    while size >= 1024.0 and unit_index < len(units) - 1:
        size /= 1024.0
        unit_index += 1

    return f"{size:.1f} {units[unit_index]}"


def format_duration(seconds: int | float | None) -> str:
    """Convert duration in seconds to MM:SS or HH:MM:SS."""
    if seconds is None or seconds < 0:
        return "غير معروف"

    total = int(round(seconds))
    hrs = total // 3600
    mins = (total % 3600) // 60
    secs = total % 60

    if hrs > 0:
        return f"{hrs:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"


def format_speed(bytes_per_second: float | None) -> str:
    """Convert download speed to human-readable format (e.g. 5.8 MB/s)."""
    if bytes_per_second is None or bytes_per_second <= 0:
        return "--"
    return f"{format_bytes(bytes_per_second)}/s"


def format_eta(seconds: int | float | None) -> str:
    """Convert ETA in seconds to MM:SS."""
    if seconds is None or seconds < 0:
        return "--"
    secs = int(round(seconds))
    if secs > 3599:
        hrs = secs // 3600
        mins = (secs % 3600) // 60
        return f"{hrs:02d}:{mins:02d}:00"
    mins = secs // 60
    s = secs % 60
    return f"{mins:02d}:{s:02d}"


def escape_markdown(text: str) -> str:
    """Escape Telegram Markdown V1 special characters."""
    if not text:
        return ""
    # In Telegram Markdown v1, * ` _ [ are the primary syntax characters
    return re.sub(r"([*_`\[\]])", r"\\\1", text)
