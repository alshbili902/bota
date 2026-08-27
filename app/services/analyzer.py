"""Media URL analyzer using yt-dlp.

Safely extracts real metadata, available video resolutions, audio options,
and accurate file size estimates without shell execution.
"""

from __future__ import annotations

import asyncio
import ipaddress
import json
import logging
from pathlib import Path
import re
import shutil
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.core.config import settings
from app.db.models import MediaFormat, MediaMetadata

logger = logging.getLogger("rahami.analyzer")


def is_safe_url(url: str) -> bool:
    """Validate that the URL is HTTP/HTTPS and not targeting private/loopback IP addresses (SSRF prevention)."""
    try:
        parsed = urlparse(url.strip())
        if parsed.scheme.lower() not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname:
            return False

        # Reject loopback and local names
        if hostname.lower() in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
            return False

        # Check for IP address literals
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
        except ValueError:
            # Not an IP literal, it's a domain name
            pass

        return True
    except Exception as e:
        logger.warning(f"URL safety check failed for {url}: {e}")
        return False


def detect_source(url: str) -> str:
    """Detect platform source name from URL."""
    domain = urlparse(url).netloc.lower()
    if "youtube.com" in domain or "youtu.be" in domain:
        return "YouTube"
    if "tiktok.com" in domain:
        return "TikTok"
    if "instagram.com" in domain:
        return "Instagram"
    if "twitter.com" in domain or "x.com" in domain:
        return "X (Twitter)"
    if "pinterest.com" in domain or "pin.it" in domain:
        return "Pinterest"
    if "facebook.com" in domain or "fb.watch" in domain:
        return "Facebook"
    if "reddit.com" in domain or "redd.it" in domain:
        return "Reddit"
    if "soundcloud.com" in domain:
        return "SoundCloud"
    return "Direct / Web"


def format_duration(seconds: Optional[float]) -> Optional[str]:
    """Convert seconds into HH:MM:SS or MM:SS."""
    if not seconds or seconds <= 0:
        return None
    total_sec = int(seconds)
    hours, remainder = divmod(total_sec, 3600)
    minutes, sec = divmod(remainder, 60)
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{sec:02d}"
    return f"{minutes:02d}:{sec:02d}"


async def analyze_url(url: str) -> MediaMetadata:
    """Safely analyze video URL and return structured metadata and available formats."""
    if not is_safe_url(url):
        raise ValueError("الرابط غير صالح.")

    ytdlp_bin = settings.YTDLP_PATH or shutil.which("yt-dlp")
    if not ytdlp_bin:
        raise RuntimeError("yt-dlp غير متوفر على الخادم.")

    # Secure subprocess invocation: Array of arguments, strictly NO shell=True
    cmd = [
        ytdlp_bin,
        "--dump-json",
        "--skip-download",
        "--no-warnings",
        "--socket-timeout", "15",
        url
    ]

    logger.info(f"Analyzing URL from source: {detect_source(url)}")

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=35.0)
        except asyncio.TimeoutError:
            process.kill()
            raise ValueError("انتهت مهلة تحليل الرابط.")

        if process.returncode != 0:
            err_msg = stderr.decode("utf-8", errors="replace")
            logger.warning(f"yt-dlp analysis failed (code {process.returncode}): {err_msg[:300]}")

            if "Unsupported URL" in err_msg:
                raise ValueError("هذا المصدر غير مدعوم حاليًا.")
            if "No video formats found" in err_msg:
                raise ValueError("لم يتم العثور على مقطع فيديو صالح للتحميل في هذا الرابط.")
            raise ValueError("تعذر تحليل الرابط، تأكد من صحته أو حاول مجددًا.")

        raw_json = stdout.decode("utf-8", errors="replace").strip()
        info = None
        for line in raw_json.splitlines():
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    info = json.loads(line)
                    break
                except json.JSONDecodeError:
                    continue

        if not info:
            raise ValueError("لم نتمكن من قراءة بيانات الوسائط.")

        return parse_metadata(url, info)

    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Unexpected error during URL analysis: {e}", exc_info=True)
        raise ValueError("حدث خطأ أثناء فحص الرابط.")


def parse_metadata(url: str, info: Dict[str, Any]) -> MediaMetadata:
    """Parse raw yt-dlp JSON dictionary into structured MediaMetadata for video/audio."""
    title = info.get("title") or "فيديو بدون عنوان"
    thumbnail = info.get("thumbnail")
    duration = info.get("duration")
    uploader = info.get("uploader") or info.get("channel") or info.get("creator")
    source = detect_source(url)

    raw_formats = info.get("formats") or []
    extracted_formats: List[MediaFormat] = []

    # Best Quality (Standard combined or fallback)
    best_size = info.get("filesize") or info.get("filesize_approx")
    best_size_mb = round(best_size / (1024 * 1024), 1) if best_size else None
    extracted_formats.append(MediaFormat(
        format_id="best",
        format_type="video",
        resolution="أعلى جودة متاحة",
        ext="mp4",
        filesize_estimate_mb=best_size_mb,
        label="أفضل جودة فيديو (Best Quality)",
        note="تحميل بأعلى دقة متوفرة مع الصوت",
        is_best=True
    ))

    # Extract distinct video resolutions that actually exist
    seen_heights = set()
    video_formats_candidates = []

    for f in raw_formats:
        vcodec = f.get("vcodec")
        height = f.get("height")
        if vcodec and vcodec != "none" and height and height >= 144:
            video_formats_candidates.append(f)

    # Sort video candidates by resolution descending
    video_formats_candidates.sort(key=lambda x: (x.get("height", 0), x.get("tbr", 0)), reverse=True)

    target_resolutions = [2160, 1440, 1080, 720, 480, 360]
    for res in target_resolutions:
        matched = [f for f in video_formats_candidates if f.get("height") == res]
        if matched and res not in seen_heights:
            seen_heights.add(res)
            cand = matched[0]
            fmt_id = f"bestvideo[height<={res}]+bestaudio/best[height<={res}]"
            size = cand.get("filesize") or cand.get("filesize_approx")
            size_mb = round(size / (1024 * 1024), 1) if size else None
            extracted_formats.append(MediaFormat(
                format_id=fmt_id,
                format_type="video",
                resolution=f"{res}p",
                height=res,
                ext="mp4",
                filesize_estimate_mb=size_mb,
                label=f"{res}p (فيديو عالي الوضوح)",
                note=f"دقة {res}p مع دمج الصوت"
            ))

    if not seen_heights and video_formats_candidates:
        cand = video_formats_candidates[0]
        h = cand.get("height", 720)
        fmt_id = "bestvideo+bestaudio/best"
        extracted_formats.append(MediaFormat(
            format_id=fmt_id,
            format_type="video",
            resolution=f"{h}p",
            height=h,
            ext="mp4",
            filesize_estimate_mb=None,
            label=f"{h}p (فيديو)",
            note="جودة الفيديو الأصلية"
        ))

    # Audio Formats (MP3 & M4A)
    has_audio = any(f.get("acodec") and f.get("acodec") != "none" for f in raw_formats) or info.get("acodec") != "none"
    if has_audio:
        extracted_formats.append(MediaFormat(
            format_id="bestaudio",
            format_type="audio",
            resolution="صوت عالي الجودة",
            ext="mp3",
            filesize_estimate_mb=round((duration or 180) * 192 * 1000 / (8 * 1024 * 1024), 1) if duration else None,
            label="صوت MP3 (نقي 192kbps)",
            note="ملف صوتي فقط بصيغة MP3"
        ))

        extracted_formats.append(MediaFormat(
            format_id="bestaudio[ext=m4a]/bestaudio",
            format_type="audio",
            resolution="صوت أصلي",
            ext="m4a",
            filesize_estimate_mb=round((duration or 180) * 128 * 1000 / (8 * 1024 * 1024), 1) if duration else None,
            label="صوت M4A (الأصلي السريع)",
            note="صوت خفيف ومتوافق مع أجهزة Apple"
        ))

    return MediaMetadata(
        url=url,
        title=title,
        thumbnail=thumbnail,
        duration=duration,
        duration_formatted=format_duration(duration),
        uploader=uploader,
        source=source,
        formats=extracted_formats
    )
