"""Subprocess-based Downloader service.

Executes yt-dlp safely with strict subprocess arguments, real-time progress parsing,
automatic timeout enforcement, and immediate cancellation cleanup.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable, Coroutine
import logging
from pathlib import Path
import re
import shutil
from typing import Any, Dict, List, Optional
from app.core.config import settings

logger = logging.getLogger("rahami.downloader")

# Regex to capture yt-dlp progress output
# e.g.: [download]  10.0% of 50.00MiB at 2.10MiB/s ETA 00:22
PROGRESS_RE = re.compile(
    r"\[download\]\s+([0-9\.]+)%\s+of\s+~?([0-9\.]+\s*[a-zA-Z]+)\s+at\s+([0-9\.]+\s*[a-zA-Z]+/s)\s+ETA\s+([0-9:]+)",
    re.IGNORECASE
)


def sanitize_filename(name: str) -> str:
    """Sanitize title for safe filesystem storage and prevent path traversal."""
    # Remove any directory separators and invalid characters
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r"[\r\n\t]", " ", clean)
    clean = clean.strip(". ")
    if not clean:
        clean = "media_download"
    # Truncate length
    if len(clean) > 80:
        clean = clean[:80].strip()
    return clean


class DownloaderService:
    """Handles subprocess execution of yt-dlp with realtime progress parsing."""

    def __init__(
        self,
        task_id: str,
        url: str,
        format_id: str,
        format_type: str,
        temp_dir: Path,
        on_progress: Optional[Callable[[Dict[str, Any]], Coroutine[Any, Any, None]]] = None
    ) -> None:
        self.task_id = task_id
        self.url = url
        self.format_id = format_id
        self.format_type = format_type
        self.temp_dir = temp_dir
        self.on_progress = on_progress
        self.process: Optional[asyncio.subprocess.Process] = None
        self._is_cancelled = False

    async def cancel(self) -> None:
        """Terminate the active yt-dlp and child FFmpeg processes."""
        self._is_cancelled = True
        if self.process:
            try:
                self.process.terminate()
                await asyncio.sleep(0.5)
                if self.process.returncode is None:
                    self.process.kill()
            except Exception as e:
                logger.warning(f"Error terminating download task {self.task_id}: {e}")

    async def execute(self) -> Path:
        """Run the download and return the final destination file path."""
        self.temp_dir.mkdir(parents=True, exist_ok=True)

        ytdlp_bin = settings.YTDLP_PATH or shutil.which("yt-dlp")
        if not ytdlp_bin:
            raise RuntimeError("yt-dlp غير متوفر على الخادم.")

        ffmpeg_bin = settings.FFMPEG_PATH or shutil.which("ffmpeg")
        # Template safe filename: %(title).70s_%(id)s.%(ext)s
        output_template = str(self.temp_dir / "%(title).70s_%(id)s.%(ext)s")

        # Build secure argument list
        cmd = [
            ytdlp_bin,
            "--newline",
            "--no-playlist",
            "--no-warnings",
            "--no-colors",
            "--max-filesize", f"{settings.MAX_FILE_SIZE_MB}M",
            "--output", output_template,
        ]

        if ffmpeg_bin:
            cmd.extend(["--ffmpeg-location", str(Path(ffmpeg_bin).parent)])

        # Handle Audio extraction vs Video format selection
        if self.format_type == "audio":
            if "m4a" in self.format_id.lower():
                cmd.extend([
                    "-f", "bestaudio[ext=m4a]/bestaudio",
                    "--extract-audio",
                    "--audio-format", "m4a",
                ])
            else:
                cmd.extend([
                    "-f", "bestaudio/best",
                    "--extract-audio",
                    "--audio-format", "mp3",
                    "--audio-quality", "192K"
                ])
        else:
            if self.format_id and self.format_id != "best":
                cmd.extend(["-f", self.format_id])
            else:
                cmd.extend(["-f", "bestvideo+bestaudio/best"])
            cmd.extend(["--merge-output-format", "mp4"])

        cmd.append(self.url)

        logger.info(f"Starting download task {self.task_id} with format {self.format_id}")

        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        async def enforce_timeout():
            await asyncio.sleep(settings.DOWNLOAD_TIMEOUT_SECONDS)
            if self.process and self.process.returncode is None:
                logger.warning(f"Task {self.task_id} timed out after {settings.DOWNLOAD_TIMEOUT_SECONDS}s")
                await self.cancel()

        timeout_task = asyncio.create_task(enforce_timeout())

        try:
            # Stream stdout line-by-line for progress updates
            stderr_output = []

            async def read_stderr():
                if self.process and self.process.stderr:
                    while True:
                        line = await self.process.stderr.readline()
                        if not line:
                            break
                        decoded = line.decode("utf-8", errors="replace").strip()
                        if decoded:
                            stderr_output.append(decoded)

            stderr_reader = asyncio.create_task(read_stderr())

            if self.process.stdout:
                while True:
                    line_bytes = await self.process.stdout.readline()
                    if not line_bytes:
                        break
                    line = line_bytes.decode("utf-8", errors="replace").strip()
                    if line:
                        await self._parse_and_notify_progress(line)

            await self.process.wait()
            await stderr_reader

            if self._is_cancelled:
                raise asyncio.CancelledError("تم إلغاء مهمة التحميل.")

            if self.process.returncode != 0:
                err_text = "\n".join(stderr_output)
                logger.error(f"yt-dlp failed for task {self.task_id} (code {self.process.returncode}): {err_text}")
                if "File is larger than max-filesize" in err_text:
                    raise ValueError(f"حجم الملف يتجاوز الحد الأقصى المسموح به ({settings.MAX_FILE_SIZE_MB}MB).")
                raise RuntimeError("فشل تنزيل مقطع الفيديو، تأكد من صحة الرابط أو حاول مجددًا.")

            # Identify downloaded file in temp_dir
            downloaded_files = [
                f for f in self.temp_dir.iterdir()
                if f.is_file() and not f.name.endswith(".part") and not f.name.endswith(".ytdl")
            ]

            if not downloaded_files:
                raise FileNotFoundError("لم يتم العثور على الملف بعد اكتمال التحميل.")

            # Sort by modified time descending
            downloaded_files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
            final_file = downloaded_files[0]

            # Verify file size
            file_size = final_file.stat().st_size
            if file_size > settings.max_file_size_bytes:
                final_file.unlink(missing_ok=True)
                raise ValueError("حجم الملف أكبر من الحد المسموح.")

            return final_file

        finally:
            timeout_task.cancel()

    async def _parse_and_notify_progress(self, line: str) -> None:
        """Parse stdout line and emit progress update to callback."""
        if not self.on_progress:
            return

        match = PROGRESS_RE.search(line)
        if match:
            percent_str, total_str, speed_str, eta_str = match.groups()
            try:
                progress_val = float(percent_str)
            except ValueError:
                progress_val = 0.0

            update_data = {
                "task_id": self.task_id,
                "status": "downloading",
                "progress": progress_val,
                "speed_text": speed_str,
                "eta_text": eta_str,
                "total_text": total_str,
            }
            try:
                await self.on_progress(update_data)
            except Exception as e:
                logger.debug(f"Progress callback error: {e}")
        elif "[Merger]" in line or "[ExtractAudio]" in line or "[Fixup" in line:
            update_data = {
                "task_id": self.task_id,
                "status": "processing",
                "progress": 98.0,
                "speed_text": "معالجة الوسائط...",
                "eta_text": "00:01",
            }
            try:
                await self.on_progress(update_data)
            except Exception:
                pass
