"""Configuration module for Rahami Telegram Downloader Bot.

Loads environment variables, strictly validates the two authorized users,
and dynamically detects system binaries (yt-dlp, ffmpeg) via PATH.
"""

from __future__ import annotations

import os
from pathlib import Path
import shutil
from typing import Final
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv(override=True)


class Config:
    """Application configuration and validation."""

    # 1. Telegram Bot Token
    BOT_TOKEN: Final[str] = os.getenv("BOT_TOKEN", "").strip()

    # 2. Strict Access Control (Exactly Two Telegram User IDs)
    raw_allowed = os.getenv("ALLOWED_USER_IDS") or os.getenv("ALLOWED_USERS", "")
    ALLOWED_USER_IDS: Final[set[int]] = set()

    # 3. Download Limits & Timeouts
    MAX_FILE_SIZE_MB: Final[int] = int(os.getenv("MAX_FILE_SIZE_MB", "50"))
    MAX_FILE_SIZE_BYTES: Final[int] = MAX_FILE_SIZE_MB * 1024 * 1024
    DOWNLOAD_TIMEOUT: Final[int] = int(os.getenv("DOWNLOAD_TIMEOUT", "900"))
    TEMP_DIR: Final[Path] = Path(os.getenv("TEMP_DIR", "./temp")).resolve()
    MAX_CONCURRENT_DOWNLOADS: Final[int] = int(os.getenv("MAX_CONCURRENT_DOWNLOADS", "2"))
    LOG_LEVEL: Final[str] = os.getenv("LOG_LEVEL", "INFO").upper()

    # 4. Binary Paths (Discovered dynamically from system PATH - Zero hardcoded paths)
    @staticmethod
    def _find_ffmpeg() -> str | None:
        p = shutil.which("ffmpeg")
        if p:
            return p
        try:
            import imageio_ffmpeg
            exe = imageio_ffmpeg.get_ffmpeg_exe()
            if exe and Path(exe).exists():
                return exe
        except Exception:
            pass
        return None

    YTDLP_PATH: Final[str | None] = shutil.which("yt-dlp")
    FFMPEG_PATH: Final[str | None] = _find_ffmpeg()
    FFPROBE_PATH: Final[str | None] = shutil.which("ffprobe")

    @classmethod
    def validate(cls) -> None:
        """Validate critical configuration on startup."""
        if not cls.BOT_TOKEN or len(cls.BOT_TOKEN) < 10 or ":" not in cls.BOT_TOKEN:
            raise ValueError(
                "BOT_TOKEN is missing or invalid in .env. Please configure a valid Telegram Bot Token."
            )

        # Parse and strictly validate exactly two user IDs
        parsed_ids: set[int] = set()
        if cls.raw_allowed:
            for piece in cls.raw_allowed.split(","):
                piece = piece.strip()
                if not piece:
                    continue
                try:
                    user_id = int(piece)
                    if user_id > 0:
                        parsed_ids.add(user_id)
                except ValueError:
                    raise ValueError(f"Invalid user ID in ALLOWED_USER_IDS: '{piece}'. Must be integer.")

        if len(parsed_ids) != 2:
            raise ValueError(
                f"ALLOWED_USER_IDS must contain strictly and exactly 2 authorized Telegram User IDs. "
                f"Found {len(parsed_ids)}: {parsed_ids}. Example: ALLOWED_USER_IDS=123456789,987654321"
            )

        # Populate validated set
        cls.ALLOWED_USER_IDS.clear()
        cls.ALLOWED_USER_IDS.update(parsed_ids)

        # Create temporary directory if missing
        cls.TEMP_DIR.mkdir(parents=True, exist_ok=True)

    @classmethod
    def validate_binaries(cls) -> None:
        """Ensure yt-dlp and ffmpeg are installed and accessible in PATH."""
        if not cls.YTDLP_PATH:
            raise RuntimeError(
                "yt-dlp is not installed or not found in system PATH. "
                "Please install it using: 'pip install yt-dlp' or your system package manager."
            )
        if not cls.FFMPEG_PATH:
            raise RuntimeError(
                "ffmpeg is not installed or not found in system PATH. "
                "Please install it using: 'sudo apt install ffmpeg' (Linux) or via winget/brew."
            )


# Standard User-Facing Arabic Messages
MESSAGES: Final[dict[str, str]] = {
    "UNAUTHORIZED": "هذا البوت خاص وغير متاح لك.",
    "WELCOME": (
        "هلا والله في رهامي 🎀\n\n"
        "بوت التحميل الخاص\n"
        "أرسلي الرابط وأنا أحاول أحمله لك بأفضل جودة متاحة."
    ),
    "HELP": (
        "📖 *دليل استخدام بوت رهامي*\n\n"
        "1️⃣ أرسل أي رابط مدعوم مباشرة (تيك توك، إنستغرام، يوتيوب، أو روابط التحميل المباشرة).\n"
        "2️⃣ سيقوم البوت بفحص الرابط وعرض خيارات الجودة المتوفرة.\n"
        "3️⃣ اختر الجودة المطلوبة وسيبدأ التحميل فوراً.\n\n"
        "📌 *الأوامر المتوفرة:*\n"
        "• /start - القائمة الرئيسية\n"
        "• /status - عرض حالة التحميل الحالية\n"
        "• /cancel - إلغاء التحميل الجاري فوراً\n"
        "• /help - المساعدة والتعليمات"
    ),
    "INVALID_URL": "الرابط غير صالح، تأكد من إرسال رابط صحيح.",
    "UNSUPPORTED": "عذرًا، هذا المصدر غير مدعوم حاليًا.",
    "DOWNLOAD_FAILED": "تعذر تحميل المحتوى حاليًا، حاول مرة ثانية.",
    "FILE_TOO_LARGE": "حجم الملف أكبر من الحد المسموح.",
    "TIMEOUT": "انتهت مهلة التحميل وتم إلغاء العملية.",
    "NO_FORMATS": "لم يتم العثور على صيغة تحميل مناسبة.",
    "ACTIVE_DOWNLOAD": "عندك تحميل شغال حاليًا، انتظر لين يخلص.",
    "NO_ACTIVE_DOWNLOAD": "ما عندك أي تحميل حالي.",
    "CANCELLED": "تم إلغاء التحميل بنجاح.",
    "PRIVATE_ACCOUNT": "🔒 هذا الحساب خاص أو يتطلب تسجيل الدخول لعرض المحتوى.",
    "NO_VIDEO_IN_POST": "⚠️ هذا المنشور لا يحتوي على مقطع فيديو مدعوم.",
    "ANALYZING": "🔍 *جاري فحص الرابط واستخراج خيارات التحميل...*",
    "STARTING_DOWNLOAD": "⏳ *بدء عملية التحميل...*",
}
