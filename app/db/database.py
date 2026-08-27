"""Async SQLite database manager for Rahami."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncGenerator
import aiosqlite
from app.core.config import settings

logger = logging.getLogger("rahami.database")

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    email TEXT,
    password_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    last_activity TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    password_changed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS download_tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    url TEXT NOT NULL,
    source TEXT DEFAULT 'unknown',
    title TEXT DEFAULT '',
    thumbnail TEXT DEFAULT '',
    duration REAL DEFAULT 0,
    format_id TEXT DEFAULT '',
    format_note TEXT DEFAULT '',
    is_audio_only INTEGER DEFAULT 0,
    status TEXT DEFAULT 'queued',
    progress REAL DEFAULT 0.0,
    speed_text TEXT DEFAULT '',
    eta_text TEXT DEFAULT '',
    downloaded_bytes INTEGER DEFAULT 0,
    total_bytes INTEGER DEFAULT 0,
    file_path TEXT DEFAULT '',
    filename TEXT DEFAULT '',
    error_message TEXT DEFAULT '',
    media_type TEXT DEFAULT 'video',
    width INTEGER,
    height INTEGER,
    image_format TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS download_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT DEFAULT '',
    format TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    filename TEXT DEFAULT '',
    media_type TEXT DEFAULT 'video',
    width INTEGER,
    height INTEGER,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON download_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_history_user_id ON download_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON download_tasks(status);
"""


async def get_db() -> aiosqlite.Connection:
    """Open and configure an async SQLite connection with 30s busy timeout."""
    settings.DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(settings.DB_PATH), timeout=30.0)
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL;")
    await db.execute("PRAGMA foreign_keys=ON;")
    await db.execute("PRAGMA busy_timeout=30000;")
    return db


async def init_db() -> None:
    """Initialize database tables and sync allowed users."""
    async with aiosqlite.connect(str(settings.DB_PATH), timeout=30.0) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA busy_timeout=30000;")
        await db.executescript(SCHEMA_SQL)
        await db.commit()

    # Migrate existing users table if columns are missing
        for col, ctype in [
            ("display_name", "TEXT"),
            ("email", "TEXT"),
            ("is_active", "INTEGER DEFAULT 1"),
            ("last_activity", "TIMESTAMP"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("password_changed_at", "TIMESTAMP")
        ]:
            try:
                await db.execute(f"ALTER TABLE users ADD COLUMN {col} {ctype}")
                await db.commit()
            except Exception:
                pass

        # Migrate download_tasks and download_history for image support
        for col, ctype in [
            ("media_type", "TEXT DEFAULT 'video'"),
            ("width", "INTEGER"),
            ("height", "INTEGER"),
            ("image_format", "TEXT")
        ]:
            try:
                await db.execute(f"ALTER TABLE download_tasks ADD COLUMN {col} {ctype}")
                await db.commit()
            except Exception:
                pass

            try:
                await db.execute(f"ALTER TABLE download_history ADD COLUMN {col} {ctype}")
                await db.commit()
            except Exception:
                pass

        try:
            await db.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != ''"
            )
            await db.commit()
        except Exception:
            pass

        # Sync allowed users into users table (do not overwrite if already exists)
        allowed_users = settings.parse_allowed_users()
        for user in allowed_users:
            await db.execute(
                """
                INSERT INTO users (username, password_hash)
                VALUES (?, ?)
                ON CONFLICT(username) DO NOTHING
                """,
                (user.username.lower(), user.password_hash)
            )
        await db.commit()
    logger.info("Database schema initialized and user credentials synced.")
