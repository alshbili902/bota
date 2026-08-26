"""Direct HTTP/HTTPS file streaming downloader."""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Callable, Coroutine
from urllib.parse import urlparse
import aiohttp

from config import Config
from downloader.ytdlp import DownloadResult, MediaFormat, MediaMetadata
from services.progress import ProgressData
from utils.files import sanitize_filename
from utils.logging import logger, sanitize_log_url


class DirectDownloader:
    """Streams direct HTTP files safely to disk with progress callback."""

    DIRECT_EXTENSIONS = {
        ".mp4", ".mkv", ".webm", ".mov", ".avi", ".mp3", ".m4a", ".wav",
        ".flac", ".aac", ".ogg", ".opus", ".pdf", ".zip", ".rar", ".7z",
        ".tar", ".gz", ".iso", ".apk", ".dmg", ".exe", ".jpg", ".jpeg",
        ".png", ".gif", ".webp", ".heic", ".heif"
    }

    @classmethod
    def can_handle(cls, url: str) -> bool:
        """Check if URL points directly to a known file extension."""
        try:
            parsed = urlparse(url)
            ext = Path(parsed.path).suffix.lower()
            return ext in cls.DIRECT_EXTENSIONS
        except Exception:
            return False

    @classmethod
    async def extract_metadata(cls, url: str) -> MediaMetadata:
        """Extract metadata for direct URL via quick HTTP HEAD request."""
        parsed = urlparse(url)
        ext = Path(parsed.path).suffix.lower() or ".bin"
        title = Path(parsed.path).stem or "direct_file"
        estimated_size = None
        mime_type = "application/octet-stream"

        try:
            timeout = aiohttp.ClientTimeout(total=6.0)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.head(
                    url,
                    allow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                ) as resp:
                    cl = resp.headers.get("content-length")
                    if cl and cl.isdigit():
                        estimated_size = int(cl)
                    ct = resp.headers.get("content-type")
                    if ct:
                        mime_type = ct.split(";")[0].strip()
        except Exception as err:
            logger.debug("HEAD request for direct URL failed: %s", err)

        is_audio = mime_type.startswith("audio/")
        is_video = mime_type.startswith("video/") or ext in (".mp4", ".mkv", ".mov", ".webm")
        is_photo = mime_type.startswith("image/") or ext in (".jpg", ".jpeg", ".png", ".webp", ".heic")

        if is_photo:
            format_label = "🖼 تحميل الصورة الأصلية (Direct Photo)"
        elif is_audio:
            format_label = "🎵 تحميل صوتي مباشر (Direct Audio)"
        elif is_video:
            format_label = "🎬 تحميل فيديو مباشر (Direct Video)"
        else:
            format_label = "📁 تحميل الملف مباشرة (Direct File)"

        return MediaMetadata(
            url=url,
            title=title,
            is_direct_file=True,
            mime_type=mime_type,
            estimated_size=estimated_size,
            formats=[
                MediaFormat(
                    id="direct_file",
                    label=format_label,
                    quality="أصلية",
                    extension=ext.lstrip("."),
                    is_audio_only=is_audio,
                    filesize=estimated_size,
                )
            ],
        )

    @classmethod
    async def download(
        cls,
        url: str,
        title: str,
        selected_format: MediaFormat,
        temp_dir: Path,
        on_progress: Callable[[ProgressData], Coroutine[None, None, None]] | None = None,
        cancel_event: asyncio.Event | None = None,
    ) -> DownloadResult:
        """Stream direct file with size limit enforcement and progress tracking."""
        ext = selected_format.extension
        safe_name = sanitize_filename(title, ext)
        target_path = temp_dir / safe_name

        logger.debug("Starting direct download for %s to %s", sanitize_log_url(url), target_path)

        timeout = aiohttp.ClientTimeout(total=Config.DOWNLOAD_TIMEOUT)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                url,
                allow_redirects=True,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            ) as resp:
                if resp.status >= 400:
                    raise RuntimeError(f"HTTP_{resp.status}")

                content_length = resp.headers.get("content-length")
                total_bytes = int(content_length) if content_length and content_length.isdigit() else 0

                if total_bytes and Config.MAX_FILE_SIZE_BYTES > 0 and total_bytes > Config.MAX_FILE_SIZE_BYTES:
                    raise ValueError("FILE_TOO_LARGE")

                downloaded_bytes = 0
                start_time = asyncio.get_event_loop().time()
                last_time = start_time

                with open(target_path, "wb") as f:
                    async for chunk in resp.content.iter_chunked(64 * 1024):
                        if cancel_event and cancel_event.is_set():
                            raise asyncio.CancelledError("DOWNLOAD_CANCELLED")

                        f.write(chunk)
                        downloaded_bytes += len(chunk)

                        if Config.MAX_FILE_SIZE_BYTES > 0 and downloaded_bytes > Config.MAX_FILE_SIZE_BYTES:
                            raise ValueError("FILE_TOO_LARGE")

                        current_time = asyncio.get_event_loop().time()
                        if on_progress and (current_time - last_time) >= 1.0:
                            elapsed = max(0.1, current_time - start_time)
                            speed = downloaded_bytes / elapsed
                            pct = (downloaded_bytes / total_bytes * 100.0) if total_bytes > 0 else 0.0
                            eta = ((total_bytes - downloaded_bytes) / speed) if total_bytes > downloaded_bytes and speed > 0 else 0.0

                            await on_progress(
                                ProgressData(
                                    percent=pct,
                                    downloaded_bytes=downloaded_bytes,
                                    total_bytes=total_bytes,
                                    speed=speed,
                                    eta=eta,
                                    phase="downloading",
                                )
                            )
                            last_time = current_time

        file_stat = target_path.stat()
        mime_type = resp.headers.get("content-type", "application/octet-stream").split(";")[0].strip()

        return DownloadResult(
            file_path=target_path,
            filename=safe_name,
            filesize=file_stat.st_size,
            mime_type=mime_type,
        )
