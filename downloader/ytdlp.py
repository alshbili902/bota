"""yt-dlp asynchronous wrapper and media analysis engine.

Features:
- Safe async subprocess invocation (no shell=True)
- Browser TLS impersonation via curl-cffi (--impersonate chrome)
- Pre-resolution of TikTok short links
- Instagram photo fallback extraction
- FFmpeg H.264 + AAC + faststart mobile transcode & thumbnail generation
- Real-time stdout progress parsing
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
import json
from pathlib import Path
import re
import shutil
from typing import Callable, Coroutine
from urllib.parse import urlparse

import aiohttp

from config import Config
from services.progress import ProgressData
from utils.files import sanitize_filename
from utils.logging import logger, sanitize_log_url


@dataclass
class MediaFormat:
    """Represents a genuine selectable media download format."""
    id: str
    label: str
    quality: str
    extension: str
    is_audio_only: bool = False
    filesize: int | None = None


@dataclass
class MediaMetadata:
    """Extracted metadata and available download formats."""
    url: str
    title: str
    duration: float | None = None
    thumbnail: str | None = None
    is_direct_file: bool = False
    mime_type: str = "video/mp4"
    estimated_size: int | None = None
    formats: list[MediaFormat] = field(default_factory=list)


@dataclass
class DownloadResult:
    """Result of completed media download and post-processing."""
    file_path: Path
    filename: str
    filesize: int
    mime_type: str
    duration: float | None = None
    width: int | None = None
    height: int | None = None
    thumbnail_path: Path | None = None


class YtDlpEngine:
    """Executes media analysis, downloads, and FFmpeg transcoding."""

    @staticmethod
    async def pre_resolve_url(url: str) -> str:
        """Sanitize and return the target URL (yt-dlp handles shortlinks natively via impersonation)."""
        return url.strip() if url else ""

    @classmethod
    async def extract_metadata(cls, url: str, max_retries: int = 3) -> MediaMetadata:
        """Extract media metadata and formats using yt-dlp with automatic WAF challenge retries."""
        if not Config.YTDLP_PATH:
            raise RuntimeError("YTDLP_NOT_FOUND")

        target_url = await cls.pre_resolve_url(url)
        is_tiktok = "tiktok.com" in target_url.lower()
        retries = max_retries if is_tiktok else 1
        last_error: Exception | None = None

        for attempt in range(retries):
            args = [
                Config.YTDLP_PATH,
                "--impersonate",
                "chrome",
                "--extractor-retries",
                "3",
                "-R",
                "3",
                "--retry-sleep",
                "1",
                "--dump-json",
                "--no-playlist",
                "--no-warnings",
                "--skip-download",
            ]

            if Config.FFMPEG_PATH:
                ffmpeg_dir = str(Path(Config.FFMPEG_PATH).parent)
                args.extend(["--ffmpeg-location", ffmpeg_dir])

            args.append(target_url)

            logger.debug(
                "Running yt-dlp metadata extraction (attempt %d/%d) for %s",
                attempt + 1,
                retries,
                sanitize_log_url(target_url),
            )

            process = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(process.communicate(), timeout=35.0)
            except asyncio.TimeoutError:
                process.kill()
                last_error = TimeoutError("METADATA_TIMEOUT")
                continue

            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")

            if process.returncode == 0 and stdout.strip():
                try:
                    info = json.loads(stdout.strip())
                    return cls._parse_info_dict(target_url, info)
                except Exception as err:
                    logger.error("Failed to parse yt-dlp JSON: %s", err)
                    last_error = ValueError("PARSE_METADATA_FAILED")
                    continue

            logger.warning(
                "yt-dlp metadata attempt %d/%d failed (code %d): %s",
                attempt + 1,
                retries,
                process.returncode,
                stderr[:300],
            )

            # Check if this is an Instagram photo/carousel without video
            if "instagram.com" in url.lower() and ("There is no video in this post" in stderr or "no video" in stderr):
                photo_meta = await cls.extract_instagram_photo(target_url)
                if photo_meta:
                    return photo_meta
                raise ValueError("NO_VIDEO_IN_POST")

            if "empty media response" in stderr.lower() or "login required" in stderr.lower():
                raise PermissionError("PRIVATE_ACCOUNT")

            last_error = ValueError("UNSUPPORTED_SOURCE")

            # On TikTok challenge failure, pause briefly before retrying
            if is_tiktok and attempt < retries - 1:
                await asyncio.sleep(1.0)

        if last_error:
            raise last_error
        raise ValueError("UNSUPPORTED_SOURCE")

    @classmethod
    def _parse_info_dict(cls, url: str, info: dict) -> MediaMetadata:
        """Parse raw yt-dlp info dict into structured MediaMetadata."""
        title = info.get("title") or "media_file"
        duration = info.get("duration")
        thumbnail = info.get("thumbnail")
        webpage_url = info.get("webpage_url") or url
        raw_formats = info.get("formats") or []
        filesize = info.get("filesize") or info.get("filesize_approx")

        formats: list[MediaFormat] = []

        # 1. Best Quality (Always included)
        formats.append(
            MediaFormat(
                id="best",
                label="🎬 أفضل جودة (Best Quality)",
                quality="أفضل جودة",
                extension="mp4",
                is_audio_only=False,
                filesize=filesize,
            )
        )

        # 2. Specific real resolutions found in formats
        available_heights = set()
        for f in raw_formats:
            h = f.get("height")
            if h and isinstance(h, int) and h in (1080, 720, 480, 360):
                available_heights.add(h)

        height_labels = {
            1080: "🎥 جودة فائقة (1080p FHD)",
            720: "📹 جودة عالية (720p HD)",
            480: "📺 جودة متوسطة (480p SD)",
            360: "📱 جودة خفيفة (360p)",
        }

        for h in sorted(available_heights, reverse=True):
            formats.append(
                MediaFormat(
                    id=f"res_{h}",
                    label=height_labels.get(h, f"📹 دقة {h}p"),
                    quality=f"{h}p",
                    extension="mp4",
                    is_audio_only=False,
                )
            )

        # 3. Audio Only MP3
        formats.append(
            MediaFormat(
                id="audio_mp3",
                label="🎵 صوت فقط MP3 (Audio Only)",
                quality="صوت عالي الجودة",
                extension="mp3",
                is_audio_only=True,
            )
        )

        return MediaMetadata(
            url=webpage_url,
            title=title,
            duration=duration,
            thumbnail=thumbnail,
            estimated_size=filesize,
            formats=formats,
        )

    @classmethod
    async def extract_instagram_photo(cls, url: str) -> MediaMetadata | None:
        """Extract high-resolution photo from Instagram photo/carousel posts in-process."""
        def _sync_extract() -> MediaMetadata | None:
            import yt_dlp
            from yt_dlp.utils import traverse_obj

            try:
                video_id = url.split("/p/")[1].split("/")[0] if "/p/" in url else url.split("/reel/")[1].split("/")[0]
                ydl = yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True})
                ie = ydl.get_info_extractor("Instagram")
                webpage, _ = ie._download_webpage_handle(url, video_id)
                media = traverse_obj(
                    webpage,
                    (
                        {ie._SJS_RE.findall},
                        ...,
                        {json.loads},
                        "require",
                        ...,
                        ...,
                        ...,
                        "__bbox",
                        "require",
                        lambda _, v: v[0] == "RelayPrefetchedStreamCache",
                        ...,
                        lambda _, v: v["__bbox"]["result"]["data"]["xig_polaris_media"],
                        "__bbox",
                        "result",
                        "data",
                        "xig_polaris_media",
                        {dict},
                        any,
                    ),
                )
                product_info = traverse_obj(media, ("if_not_gated_logged_out", {dict})) or {}
                candidates = product_info.get("image_versions2", {}).get("candidates", [])
                img_url = candidates[0].get("url") if candidates else product_info.get("display_uri")
                if not img_url:
                    return None

                caption = traverse_obj(product_info, ("caption", "text", {str})) or "Instagram Photo"
                first_line = caption.strip().split("\n")[0][:80] or "Instagram Photo"

                return MediaMetadata(
                    url=img_url,
                    title=first_line,
                    is_direct_file=True,
                    mime_type="image/jpeg",
                    thumbnail=img_url,
                    formats=[
                        MediaFormat(
                            id="photo_hd",
                            label="🖼 تحميل الصورة بدقة أصلية كاملة",
                            quality="أصلية",
                            extension="jpg",
                            is_audio_only=False,
                        )
                    ],
                )
            except Exception as err:
                logger.debug("Instagram photo in-process extraction error: %s", err)
                return None

        return await asyncio.to_thread(_sync_extract)

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
        """Download media file using yt-dlp and monitor progress in real-time."""
        if not Config.YTDLP_PATH:
            raise RuntimeError("YTDLP_NOT_FOUND")

        is_audio = selected_format.is_audio_only
        format_id = selected_format.id

        if is_audio:
            format_arg = "bestaudio/best"
        elif format_id.startswith("res_"):
            height = format_id.replace("res_", "")
            format_arg = (
                f"bestvideo[height<={height}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/"
                f"bestvideo[height<={height}][vcodec^=avc]+bestaudio/"
                f"bestvideo[height<={height}]+bestaudio/"
                f"best[height<={height}]/best/b"
            )
        else:
            format_arg = (
                "bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/"
                "bestvideo[vcodec^=avc]+bestaudio/"
                "best[vcodec^=avc]/bestvideo+bestaudio/best/b"
            )

        output_template = str(temp_dir / "%(title).100B.%(ext)s")

        args = [
            Config.YTDLP_PATH,
            "--impersonate",
            "chrome",
            "--extractor-retries",
            "5",
            "-R",
            "5",
            "--retry-sleep",
            "1",
            "--newline",
            "--no-playlist",
            "--no-warnings",
            "-f",
            format_arg,
            "-o",
            output_template,
        ]

        if is_audio:
            args.extend(["-x", "--audio-format", "mp3"])
        else:
            args.extend(["--merge-output-format", "mp4"])

        if Config.MAX_FILE_SIZE_BYTES > 0:
            args.extend(["--max-filesize", str(Config.MAX_FILE_SIZE_BYTES)])

        if Config.FFMPEG_PATH:
            ffmpeg_dir = str(Path(Config.FFMPEG_PATH).parent)
            args.extend(["--ffmpeg-location", ffmpeg_dir])

        args.append(url)

        is_tiktok = "tiktok.com" in url.lower()
        max_attempts = 3 if is_tiktok else 1
        downloaded_file: Path | None = None

        for attempt in range(max_attempts):
            logger.debug("Launching yt-dlp download (attempt %d/%d): format=%s, dir=%s", attempt + 1, max_attempts, format_arg, temp_dir)

            process = await asyncio.create_subprocess_exec(
                *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stderr_output = []
            assert process.stdout is not None
            assert process.stderr is not None

            async def read_stderr():
                while True:
                    line = await process.stderr.readline()
                    if not line:
                        break
                    stderr_output.append(line.decode("utf-8", errors="replace"))

            stderr_task = asyncio.create_task(read_stderr())

            progress_re = re.compile(
                r"\[download\]\s+([0-9.]+)%\s+of\s+~?([0-9.]+)([KMGT]?i?B)\s+at\s+([0-9.]+)([KMGT]?i?B/s)\s+ETA\s+([0-9:]+)",
                re.I,
            )

            while True:
                if cancel_event and cancel_event.is_set():
                    process.kill()
                    await process.wait()
                    raise asyncio.CancelledError("DOWNLOAD_CANCELLED")

                line_bytes = await process.stdout.readline()
                if not line_bytes:
                    break

                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                # Detect destination file
                if line.startswith("[download] Destination:") or line.startswith("[Merger] Merging formats into"):
                    dest = line.split(":", 1)[1].strip().strip('"')
                    downloaded_file = Path(dest)
                elif line.endswith("has already been downloaded"):
                    dest = line.replace("[download]", "").replace("has already been downloaded", "").strip().strip('"')
                    downloaded_file = Path(dest)

                # Parse progress
                match = progress_re.search(line)
                if match and on_progress:
                    try:
                        pct = float(match.group(1))
                        total_val = float(match.group(2))
                        total_unit = match.group(3)
                        speed_val = float(match.group(4))
                        speed_unit = match.group(5)
                        eta_str = match.group(6)

                        total_bytes = int(cls._unit_to_bytes(total_val, total_unit))
                        speed_bps = cls._unit_to_bytes(speed_val, speed_unit)
                        eta_sec = cls._eta_to_seconds(eta_str)
                        downloaded_bytes = int((pct / 100.0) * total_bytes)

                        pdata = ProgressData(
                            percent=pct,
                            downloaded_bytes=downloaded_bytes,
                            total_bytes=total_bytes,
                            speed=speed_bps,
                            eta=eta_sec,
                            phase="downloading",
                        )
                        await on_progress(pdata)
                    except Exception:
                        pass

            returncode = await process.wait()
            await stderr_task

            if returncode == 0:
                break

            full_stderr = "".join(stderr_output)
            logger.warning("yt-dlp download attempt %d/%d failed with code %d: %s", attempt + 1, max_attempts, returncode, full_stderr[:300])

            if "File is larger than max-filesize" in full_stderr:
                raise ValueError("FILE_TOO_LARGE")

            if attempt < max_attempts - 1:
                await asyncio.sleep(1.0)
                continue

            raise RuntimeError("DOWNLOAD_FAILED")

        # Find the downloaded file in temp_dir if not explicitly matched
        if not downloaded_file or not downloaded_file.exists():
            files = list(temp_dir.glob("*.*"))
            if files:
                downloaded_file = max(files, key=lambda f: f.stat().st_size)
            else:
                raise FileNotFoundError("Downloaded file was not created.")

        file_stat = downloaded_file.stat()
        if file_stat.st_size == 0:
            raise ValueError("Downloaded file is empty.")

        mime_type = "audio/mpeg" if is_audio or downloaded_file.suffix.lower() == ".mp3" else "video/mp4"

        # 4. If video: Ensure mobile compatibility (H.264 + AAC + faststart + thumbnail)
        width, height, duration, thumbnail_path = None, None, None, None

        if not is_audio and downloaded_file.suffix.lower() in (".mp4", ".mov", ".mkv", ".webm"):
            if on_progress:
                await on_progress(ProgressData(percent=100.0, phase="processing"))

            mobile_file, meta = await cls.ensure_mobile_compatibility(downloaded_file, temp_dir)
            downloaded_file = mobile_file
            width = meta.get("width")
            height = meta.get("height")
            duration = meta.get("duration")

            # Generate thumbnail for instant mobile Telegram inline player
            thumb_path = temp_dir / "thumb.jpg"
            thumbnail_path = await cls.generate_thumbnail(downloaded_file, thumb_path)

        final_stat = downloaded_file.stat()

        return DownloadResult(
            file_path=downloaded_file,
            filename=downloaded_file.name,
            filesize=final_stat.st_size,
            mime_type=mime_type,
            duration=duration,
            width=width,
            height=height,
            thumbnail_path=thumbnail_path,
        )

    @classmethod
    async def ensure_mobile_compatibility(cls, video_path: Path, temp_dir: Path) -> tuple[Path, dict]:
        """Transcode video to H.264 (yuv420p) + AAC + faststart if needed for mobile compatibility."""
        meta = await cls.get_video_metadata(video_path)
        codec = meta.get("codec", "").lower()
        pix_fmt = meta.get("pix_fmt", "").lower()

        # Check if already mobile-compliant H.264 with yuv420p
        is_h264 = "h264" in codec or "avc" in codec
        is_yuv420p = "yuv420p" in pix_fmt

        if is_h264 and is_yuv420p:
            # Faststart remux only (almost instantaneous, no re-encoding)
            faststart_path = temp_dir / f"faststart_{video_path.name}"
            cmd = [
                Config.FFMPEG_PATH or "ffmpeg",
                "-y",
                "-i",
                str(video_path),
                "-c",
                "copy",
                "-movflags",
                "+faststart",
                str(faststart_path),
            ]
            try:
                proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
                await proc.wait()
                if proc.returncode == 0 and faststart_path.exists() and faststart_path.stat().st_size > 0:
                    video_path.unlink(missing_ok=True)
                    return faststart_path, meta
            except Exception:
                pass
            return video_path, meta

        # Full transcode to universal mobile H.264 + AAC
        logger.info("Transcoding %s from %s (%s) to H.264 yuv420p for mobile playback", video_path.name, codec, pix_fmt)
        out_path = temp_dir / f"mobile_{video_path.stem}.mp4"

        cmd = [
            Config.FFMPEG_PATH or "ffmpeg",
            "-y",
            "-i",
            str(video_path),
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-profile:v",
            "main",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            str(out_path),
        ]

        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await proc.wait()

        if proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0:
            video_path.unlink(missing_ok=True)
            updated_meta = await cls.get_video_metadata(out_path)
            return out_path, updated_meta

        return video_path, meta

    @classmethod
    async def get_video_metadata(cls, video_path: Path) -> dict:
        """Inspect video streams using ffprobe."""
        ffprobe = Config.FFPROBE_PATH or shutil.which("ffprobe")
        if not ffprobe:
            return {}

        cmd = [
            ffprobe,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,codec_name,pix_fmt,duration",
            "-of",
            "json",
            str(video_path),
        ]

        try:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
            out_bytes, _ = await asyncio.wait_for(proc.communicate(), timeout=10.0)
            data = json.loads(out_bytes.decode("utf-8"))
            streams = data.get("streams", [])
            if streams:
                st = streams[0]
                return {
                    "width": st.get("width"),
                    "height": st.get("height"),
                    "codec": st.get("codec_name", ""),
                    "pix_fmt": st.get("pix_fmt", ""),
                    "duration": float(st.get("duration", 0)) if st.get("duration") else None,
                }
        except Exception as err:
            logger.debug("ffprobe metadata failed: %s", err)

        return {}

    @classmethod
    async def generate_thumbnail(cls, video_path: Path, output_thumb: Path) -> Path | None:
        """Extract a single frame JPEG thumbnail using ffmpeg for Telegram inline player."""
        ffmpeg = Config.FFMPEG_PATH or shutil.which("ffmpeg")
        if not ffmpeg:
            return None

        cmd = [
            ffmpeg,
            "-y",
            "-ss",
            "00:00:01",
            "-i",
            str(video_path),
            "-vframes",
            "1",
            "-q:v",
            "2",
            str(output_thumb),
        ]

        try:
            proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
            await proc.wait()
            if proc.returncode == 0 and output_thumb.exists() and output_thumb.stat().st_size > 0:
                return output_thumb
        except Exception:
            pass

        return None

    @staticmethod
    def _unit_to_bytes(val: float, unit: str) -> float:
        u = unit.strip().upper()
        if u.startswith("K"):
            return val * 1024
        if u.startswith("M"):
            return val * 1024 * 1024
        if u.startswith("G"):
            return val * 1024 * 1024 * 1024
        if u.startswith("T"):
            return val * 1024 * 1024 * 1024 * 1024
        return val

    @staticmethod
    def _eta_to_seconds(eta: str) -> float:
        parts = eta.split(":")
        try:
            if len(parts) == 2:
                return float(int(parts[0]) * 60 + int(parts[1]))
            if len(parts) == 3:
                return float(int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2]))
        except ValueError:
            pass
        return 0.0
