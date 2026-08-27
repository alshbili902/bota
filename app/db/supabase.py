"""Database repository and Supabase integration layer for Rahami.

Provides seamless connectivity to Supabase PostgreSQL using the server-side service role key,
with automatic fallback to local SQLite when Supabase is not yet configured.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple
import aiosqlite
from supabase import Client, create_client
from app.core.config import settings
from app.core.security import hash_password
from app.db.database import get_db

logger = logging.getLogger("rahami.supabase")

# Extended SQLite Schema for Admin Tables (Mirrors Supabase PostgreSQL Schema)
ADMIN_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    site_name TEXT DEFAULT 'Rahami — رهامي',
    site_description TEXT DEFAULT 'منصة التحميل الشخصية الفاخرة',
    logo_url TEXT DEFAULT '',
    favicon_url TEXT DEFAULT '',
    primary_language TEXT DEFAULT 'ar',
    default_theme TEXT DEFAULT 'dark',
    maintenance_mode INTEGER DEFAULT 0,
    maintenance_message TEXT DEFAULT 'الموقع حاليًا تحت الصيانة الدورية، سنعود قريبًا.',
    max_file_size_mb INTEGER DEFAULT 200,
    download_timeout INTEGER DEFAULT 900,
    max_concurrent_downloads INTEGER DEFAULT 2,
    max_retries INTEGER DEFAULT 2,
    retention_hours INTEGER DEFAULT 24,
    auto_cleanup_enabled INTEGER DEFAULT 1,
    auto_healing_enabled INTEGER DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS download_errors (
    id TEXT PRIMARY KEY,
    error_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    source TEXT DEFAULT 'unknown',
    user_id TEXT DEFAULT 'system',
    status TEXT DEFAULT 'active', -- active, resolved, ignored
    occurrences INTEGER DEFAULT 1,
    last_occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_events (
    id TEXT PRIMARY KEY,
    admin_username TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT DEFAULT '',
    details TEXT DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Ensure default site settings exist
INSERT OR IGNORE INTO site_settings (id, site_name) VALUES (1, 'Rahami — رهامي');
"""


class DatabaseManager:
    """Manages database operations with Supabase and SQLite fallback."""

    def __init__(self) -> None:
        self.supabase_client: Optional[Client] = None
        self._init_supabase()

    def _init_supabase(self) -> None:
        """Initialize Supabase client if credentials are configured."""
        url = settings.SUPABASE_URL.strip()
        key = settings.SUPABASE_SERVICE_ROLE_KEY.strip() or settings.SUPABASE_ANON_KEY.strip()

        if url and key and url.startswith("http"):
            try:
                self.supabase_client = create_client(url, key)
                logger.info("Supabase client initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not connect to Supabase: {e}. Falling back to SQLite.")
                self.supabase_client = None
        else:
            self.supabase_client = None

    @property
    def is_supabase_enabled(self) -> bool:
        return self.supabase_client is not None

    async def init_admin_database(self) -> None:
        """Initialize admin schema and bootstrap initial admin credentials."""
        # 1. Initialize SQLite tables
        db = await get_db()
        try:
            await db.executescript(ADMIN_SCHEMA_SQL)
            await db.commit()

            # 2. Check if admin user exists in SQLite
            async with db.execute("SELECT COUNT(*) FROM admin_users") as cursor:
                row = await cursor.fetchone()
                count = row[0] if row else 0

            if count == 0:
                import uuid
                initial_admin_id = str(uuid.uuid4())
                initial_hash = hash_password(settings.ADMIN_PASSWORD)
                await db.execute(
                    """
                    INSERT INTO admin_users (id, username, password_hash)
                    VALUES (?, ?, ?)
                    """,
                    (initial_admin_id, settings.ADMIN_USERNAME.lower(), initial_hash)
                )
                await db.commit()
                logger.info(f"Bootstrapped initial admin user: {settings.ADMIN_USERNAME}")
        finally:
            await db.close()

        # 3. If Supabase is active, ensure admin user exists there as well
        if self.is_supabase_enabled:
            try:
                res = self.supabase_client.table("admin_users").select("id").limit(1).execute()
                if not res.data:
                    import uuid
                    self.supabase_client.table("admin_users").insert({
                        "id": str(uuid.uuid4()),
                        "username": settings.ADMIN_USERNAME.lower(),
                        "password_hash": hash_password(settings.ADMIN_PASSWORD)
                    }).execute()
                    logger.info("Synced initial admin account to Supabase.")
            except Exception as e:
                logger.error(f"Error checking/syncing Supabase admin user: {e}")

    async def get_site_settings(self) -> Dict[str, Any]:
        """Fetch current site settings."""
        if self.is_supabase_enabled:
            try:
                res = self.supabase_client.table("site_settings").select("*").eq("id", 1).single().execute()
                if res.data:
                    return res.data
            except Exception as e:
                logger.warning(f"Failed to fetch site_settings from Supabase: {e}")

        # Fallback to SQLite
        db = await get_db()
        try:
            async with db.execute("SELECT * FROM site_settings WHERE id = 1") as cursor:
                row = await cursor.fetchone()
                if row:
                    return {
                        "site_name": row["site_name"],
                        "site_description": row["site_description"],
                        "logo_url": row["logo_url"] or "",
                        "favicon_url": row["favicon_url"] or "",
                        "primary_language": row["primary_language"],
                        "default_theme": row["default_theme"],
                        "maintenance_mode": bool(row["maintenance_mode"]),
                        "maintenance_message": row["maintenance_message"],
                        "max_file_size_mb": row["max_file_size_mb"],
                        "download_timeout": row["download_timeout"],
                        "max_concurrent_downloads": row["max_concurrent_downloads"],
                        "max_retries": row["max_retries"],
                        "retention_hours": row["retention_hours"],
                        "auto_cleanup_enabled": bool(row["auto_cleanup_enabled"]),
                        "auto_healing_enabled": bool(row["auto_healing_enabled"]),
                    }
        finally:
            await db.close()

        return {
            "site_name": "Rahami — رهامي",
            "site_description": "منصة التحميل الشخصية الفاخرة",
            "maintenance_mode": False,
            "maintenance_message": "الموقع حاليًا تحت الصيانة.",
            "max_file_size_mb": 200,
            "download_timeout": 900,
            "max_concurrent_downloads": 2,
            "max_retries": 2,
            "retention_hours": 24,
            "auto_cleanup_enabled": True,
            "auto_healing_enabled": True,
        }

    async def update_site_settings(self, updates: Dict[str, Any]) -> None:
        """Persist site settings updates."""
        # 1. Update SQLite
        db = await get_db()
        try:
            set_clauses = []
            values = []
            for k, v in updates.items():
                if isinstance(v, bool):
                    v = 1 if v else 0
                set_clauses.append(f"{k} = ?")
                values.append(v)
            values.append(1)

            sql = f"UPDATE site_settings SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            await db.execute(sql, values)
            await db.commit()
        finally:
            await db.close()

        # 2. Update Supabase if available
        if self.is_supabase_enabled:
            try:
                self.supabase_client.table("site_settings").update(updates).eq("id", 1).execute()
            except Exception as e:
                logger.error(f"Error persisting site_settings to Supabase: {e}")

    async def log_admin_event(
        self,
        admin_username: str,
        action: str,
        target: str = "",
        details: Optional[Dict[str, Any]] = None,
        ip_address: str = ""
    ) -> None:
        """Record an administrative action to the audit log."""
        import uuid
        event_id = str(uuid.uuid4())
        details_json = json.dumps(details or {})

        db = await get_db()
        try:
            await db.execute(
                """
                INSERT INTO system_events (id, admin_username, action, target, details, ip_address)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (event_id, admin_username, action, target, details_json, ip_address)
            )
            await db.commit()
        finally:
            await db.close()

        if self.is_supabase_enabled:
            try:
                self.supabase_client.table("system_events").insert({
                    "id": event_id,
                    "admin_username": admin_username,
                    "action": action,
                    "target": target,
                    "details": details or {},
                    "ip_address": ip_address
                }).execute()
            except Exception as e:
                logger.debug(f"Could not log event to Supabase: {e}")

    async def record_download_error(
        self,
        error_type: str,
        summary: str,
        details: Optional[str] = None,
        source: str = "unknown",
        user_id: str = "system"
    ) -> None:
        """Record or increment occurrence of an error in the Error Center."""
        import uuid
        db = await get_db()
        try:
            # Check if active error with same summary exists
            async with db.execute(
                "SELECT id, occurrences FROM download_errors WHERE summary = ? AND status = 'active'",
                (summary,)
            ) as cursor:
                existing = await cursor.fetchone()

            if existing:
                await db.execute(
                    """
                    UPDATE download_errors
                    SET occurrences = occurrences + 1, last_occurred_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (existing["id"],)
                )
            else:
                new_id = str(uuid.uuid4())
                await db.execute(
                    """
                    INSERT INTO download_errors (id, error_type, summary, details, source, user_id, status, occurrences)
                    VALUES (?, ?, ?, ?, ?, ?, 'active', 1)
                    """,
                    (new_id, error_type, summary, details, source, user_id)
                )
            await db.commit()
        finally:
            await db.close()

    async def sync_download_task(self, task_data: Dict[str, Any]) -> None:
        """Sync a download task record to Supabase with schema fallback."""
        if not self.is_supabase_enabled:
            return

        base_payload = {
            "id": str(task_data.get("id")),
            "user_id": str(task_data.get("user_id")),
            "url": str(task_data.get("url")),
            "source": str(task_data.get("source") or "Direct"),
            "title": str(task_data.get("title") or ""),
            "filename": str(task_data.get("filename") or ""),
            "format": str(task_data.get("format") or ""),
            "file_size": int(task_data.get("file_size") or 0),
            "status": str(task_data.get("status") or "queued"),
            "error_message": task_data.get("error_message"),
        }

        extended_payload = dict(base_payload)
        if task_data.get("media_type"):
            extended_payload["media_type"] = task_data["media_type"]
        if task_data.get("width"):
            extended_payload["width"] = task_data["width"]
        if task_data.get("height"):
            extended_payload["height"] = task_data["height"]
        if task_data.get("image_format"):
            extended_payload["image_format"] = task_data["image_format"]

        try:
            self.supabase_client.table("downloads").upsert(extended_payload).execute()
        except Exception as err:
            if any(col in str(err).lower() for col in ("media_type", "width", "height", "image_format")):
                try:
                    self.supabase_client.table("downloads").upsert(base_payload).execute()
                except Exception as e2:
                    logger.debug(f"Supabase downloads base upsert error: {e2}")
            else:
                logger.debug(f"Supabase downloads sync error: {err}")


db_manager = DatabaseManager()
