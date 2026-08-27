"""Pydantic schemas and database models for Rahami."""

from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


# --- Auth Schemas ---
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class UserProfile(BaseModel):
    username: str
    is_authenticated: bool = True


# --- Media Analysis Schemas ---
class AnalyzeRequest(BaseModel):
    url: str = Field(..., min_length=4, max_length=2048)


class MediaFormat(BaseModel):
    format_id: str
    format_type: str  # "video" | "audio"
    resolution: Optional[str] = None  # e.g., "1080p", "720p", "480p"
    height: Optional[int] = None
    ext: str  # "mp4", "mp3", "m4a"
    filesize_estimate_mb: Optional[float] = None
    label: str  # Display label
    note: Optional[str] = None
    is_best: bool = False


class MediaMetadata(BaseModel):
    url: str
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    duration_formatted: Optional[str] = None
    uploader: Optional[str] = None
    source: str
    formats: List[MediaFormat] = []


# --- Download Task Schemas ---
class StartDownloadRequest(BaseModel):
    url: str
    format_id: str
    format_type: str = "video"  # "video" | "audio"
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    source: Optional[str] = None


class DownloadTaskResponse(BaseModel):
    id: str
    url: str
    title: str
    thumbnail: Optional[str] = None
    source: str
    format_id: str
    format_note: str
    is_audio_only: bool
    status: str  # "queued", "analyzing", "downloading", "processing", "completed", "failed", "cancelled"
    progress: float = 0.0
    speed_text: str = ""
    eta_text: str = ""
    downloaded_bytes: int = 0
    total_bytes: int = 0
    filename: Optional[str] = None
    download_url: Optional[str] = None
    error_message: Optional[str] = None
    created_at: Optional[str] = None


# --- Download History Schemas ---
class HistoryItemResponse(BaseModel):
    id: str
    task_id: str
    title: str
    source: str
    format: str
    file_size_mb: float
    filename: str
    download_url: Optional[str] = None
    completed_at: str


# --- Health & Diagnostics Schemas ---
class SystemHealthResponse(BaseModel):
    status: str  # "healthy" | "degraded" | "error"
    ytdlp_available: bool
    ffmpeg_available: bool
    ffprobe_available: bool
    storage_used_mb: float
    storage_free_mb: float
    max_storage_gb: int
    active_downloads: int
    environment: str
