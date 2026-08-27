"""Pydantic data models for the Rahami Admin Dashboard."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# --- Admin Authentication ---
class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class AdminProfileResponse(BaseModel):
    username: str
    is_admin: bool = True
    created_at: Optional[str] = None
    last_login: Optional[str] = None


class AdminAccountUpdate(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_username: Optional[str] = Field(None, min_length=1, max_length=100)
    new_password: Optional[str] = Field(None, min_length=6, max_length=200)
    confirm_password: Optional[str] = Field(None, min_length=6, max_length=200)


# --- Dashboard Overview Statistics ---
class AdminDashboardStats(BaseModel):
    total_users: int = 0
    active_users: int = 0
    total_downloads: int = 0
    successful_downloads: int = 0
    failed_downloads: int = 0
    active_downloads: int = 0
    storage_used_mb: float = 0.0
    total_errors: int = 0
    system_status: str = "healthy"
    maintenance_mode: bool = False


# --- User Management ---
class AdminUserItem(BaseModel):
    id: str
    username: str
    display_name: Optional[str] = None
    email: Optional[str] = None
    is_active: bool = True
    total_downloads: int = 0
    successful_downloads: int = 0
    failed_downloads: int = 0
    last_activity: Optional[str] = None
    created_at: Optional[str] = None


class AdminUserCreateRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    display_name: Optional[str] = Field(None, max_length=64)
    email: Optional[str] = Field(None, max_length=128)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = None
    is_active: bool = True


class AdminUserEditRequest(BaseModel):
    username: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class AdminResetPasswordRequest(BaseModel):
    new_password: Optional[str] = None  # If empty, auto-generate a secure random password


class AdminChangeUserPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)
    confirm_password: Optional[str] = None



# --- Download Management ---
class AdminDownloadItem(BaseModel):
    id: str
    user_id: str
    url: str
    source: str
    title: str
    filename: Optional[str] = None
    format: Optional[str] = None
    file_size_mb: float = 0.0
    status: str  # queued, analyzing, downloading, processing, completed, failed, cancelled
    error_message: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = 0.0


class AdminDownloadsResponse(BaseModel):
    items: List[AdminDownloadItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 1


# --- Website Settings & Maintenance Mode ---
class SiteSettingsModel(BaseModel):
    site_name: str = "Rahami — رهامي"
    site_description: str = "منصة التحميل الشخصية الفاخرة"
    logo_url: str = ""
    favicon_url: str = ""
    primary_language: str = "ar"
    default_theme: str = "dark"
    maintenance_mode: bool = False
    maintenance_message: str = "الموقع حاليًا تحت الصيانة، سنعود قريبًا."
    max_file_size_mb: int = 200
    download_timeout: int = 900
    max_concurrent_downloads: int = 2
    max_retries: int = 2
    retention_hours: int = 24
    auto_cleanup_enabled: bool = True
    auto_healing_enabled: bool = True


# --- System Health & Diagnostics ---
class SystemHealthDetail(BaseModel):
    status: str  # healthy, warning, critical
    ytdlp_available: bool = True
    ffmpeg_available: bool = True
    ffprobe_available: bool = True
    supabase_connected: bool = False
    database_engine: str = "SQLite / Supabase"
    cpu_percent: float = 0.0
    memory_used_mb: float = 0.0
    memory_total_mb: float = 0.0
    memory_percent: float = 0.0
    disk_used_gb: float = 0.0
    disk_total_gb: float = 0.0
    disk_percent: float = 0.0
    active_downloads: int = 0
    queue_length: int = 0
    uptime_seconds: float = 0.0


# --- Error Center ---
class ErrorLogItem(BaseModel):
    id: str
    error_type: str
    summary: str
    details: Optional[str] = None
    source: str = "unknown"
    user_id: str = "system"
    status: str = "active"  # active, resolved, ignored
    occurrences: int = 1
    last_occurred_at: Optional[str] = None
    created_at: Optional[str] = None


class ErrorStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|resolved|ignored)$")


# --- Administrative Audit Logs ---
class AuditLogItem(BaseModel):
    id: str
    admin_username: str
    action: str
    target: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: str


class AuditLogResponse(BaseModel):
    items: List[AuditLogItem] = []
    total: int = 0
    page: int = 1
    page_size: int = 25
    total_pages: int = 1


# --- Database Overview ---
class DatabaseOverviewResponse(BaseModel):
    connected: bool
    engine: str
    latency_ms: float
    tables: Dict[str, int] = {}
    health_status: str
