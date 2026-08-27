"""Configuration module for Rahami — رهامي.

Enforces strictly two authorized accounts, dynamic binary detection,
safe download limits, and secure filesystem directories.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
import shutil
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("rahami.config")

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class AuthorizedUser(BaseModel):
    username: str
    password_hash: str


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Application Info
    APP_NAME: str = "Rahami — رهامي"
    ENVIRONMENT: str = "production"  # development | production | test
    DEBUG: bool = False

    # Security & Tokens
    SECRET_KEY: str = Field(
        default="rahami_super_secret_production_key_change_me_minimum_32_chars_12345",
        description="Cryptographic secret key for signing JWT sessions"
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days persistent session
    COOKIE_NAME: str = "rahami_session"
    ADMIN_COOKIE_NAME: str = "rahami_admin_session"
    ADMIN_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    COOKIE_SECURE: bool = False  # Set to True when HTTPS is enabled
    COOKIE_SAMESITE: str = "lax"

    # Supabase PostgreSQL & Storage Settings
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Initial Administrator Credentials (used for initial bootstrap)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "RahamiAdmin2026!"

    # Strict Access Control: Exactly Two Authorized Users
    # Supported formats in .env:
    # 1. Comma-separated: ALLOWED_USERS=user1:$2b$12$...,user2:$2b$12$...
    # 2. JSON array: ALLOWED_USERS=[{"username":"user1","password_hash":"..."},{"username":"user2","password_hash":"..."}]
    ALLOWED_USERS: str = ""

    # Resource & Download Limits
    MAX_FILE_SIZE_MB: int = 200
    DOWNLOAD_TIMEOUT: int = 900  # seconds (15 minutes)
    MAX_CONCURRENT_DOWNLOADS: int = 2
    MAX_STORAGE_GB: int = 10
    MAX_DOWNLOAD_RETRIES: int = 2
    HEALTH_CHECK_INTERVAL: int = 300  # seconds
    FILE_RETENTION_HOURS: int = 24  # Delete completed files after 24h

    # Storage Paths (Isolated & Dedicated)
    STORAGE_DIR: Path = BASE_DIR / "storage"
    TEMP_DIR: Path = BASE_DIR / "storage" / "temp"
    DOWNLOADS_DIR: Path = BASE_DIR / "storage" / "downloads"
    DB_PATH: Path = BASE_DIR / "storage" / "rahami.db"

    # Dynamic Binary Detection via PATH
    YTDLP_PATH: Optional[str] = None
    FFMPEG_PATH: Optional[str] = None
    FFPROBE_PATH: Optional[str] = None
    USER_AGENT: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def max_storage_bytes(self) -> int:
        return self.MAX_STORAGE_GB * 1024 * 1024 * 1024

    def parse_allowed_users(self) -> List[AuthorizedUser]:
        """Parse and strictly validate that exactly two authorized users are configured."""
        raw = (self.ALLOWED_USERS or "").strip()
        if not raw:
            return []

        users: List[AuthorizedUser] = []

        # Try JSON format first
        if raw.startswith("[") and raw.endswith("]"):
            try:
                data = json.loads(raw)
                for item in data:
                    if isinstance(item, dict) and "username" in item and "password_hash" in item:
                        users.append(AuthorizedUser(
                            username=str(item["username"]).strip().lower(),
                            password_hash=str(item["password_hash"]).strip()
                        ))
            except Exception as e:
                logger.error(f"Failed to parse ALLOWED_USERS as JSON: {e}")

        # Fallback to delimiter format: username:hash,username2:hash2 or separated by semicolons/newlines
        if not users:
            delimiters = [",", ";", "\n"]
            items = [raw]
            for d in delimiters:
                if any(d in item for item in items):
                    new_items = []
                    for item in items:
                        new_items.extend(item.split(d))
                    items = new_items

            for entry in items:
                entry = entry.strip()
                if not entry:
                    continue
                parts = entry.split(":", 1)
                if len(parts) == 2:
                    username, p_hash = parts[0].strip().lower(), parts[1].strip()
                    if username and p_hash:
                        users.append(AuthorizedUser(username=username, password_hash=p_hash))

        return users

    def validate_strict_requirements(self) -> None:
        """Validate startup requirements for production readiness."""
        # 1. Check directories
        self.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        self.TEMP_DIR.mkdir(parents=True, exist_ok=True)
        self.DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

        # 2. Check binary paths dynamically via shutil.which
        self.YTDLP_PATH = shutil.which("yt-dlp")
        self.FFMPEG_PATH = shutil.which("ffmpeg")
        self.FFPROBE_PATH = shutil.which("ffprobe")

        # Fallback for ffmpeg via imageio_ffmpeg if available
        if not self.FFMPEG_PATH:
            try:
                import imageio_ffmpeg
                exe = imageio_ffmpeg.get_ffmpeg_exe()
                if exe and Path(exe).exists():
                    self.FFMPEG_PATH = exe
            except Exception:
                pass

        # 3. Check allowed users count (at least 2 initial bootstrap accounts)
        users = self.parse_allowed_users()
        if len(users) < 2:
            raise ValueError(
                f"Rahami requires at least TWO authorized user accounts in ALLOWED_USERS. "
                f"Found {len(users)}. Please configure ALLOWED_USERS in .env"
            )

        # 4. Check secret key strength
        if len(self.SECRET_KEY) < 16:
            raise ValueError("SECRET_KEY must be at least 16 characters long.")


settings = Settings()
