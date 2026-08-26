"""Progress reporting and rate-limit throttling for Telegram status cards."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import time
from telegram import Bot
from telegram.error import BadRequest
from utils.files import escape_markdown, format_bytes, format_duration, format_eta, format_speed
from utils.logging import logger


@dataclass
class ProgressData:
    """Live progress metrics of an active download."""
    percent: float = 0.0
    downloaded_bytes: int = 0
    total_bytes: int = 0
    speed: float = 0.0
    eta: float = 0.0
    phase: str = "downloading"  # downloading, processing, uploading


class ProgressThrottler:
    """Throttles Telegram editMessageText API calls to prevent 429 Too Many Requests."""

    def __init__(
        self,
        bot: Bot,
        chat_id: int,
        message_id: int,
        title: str,
        quality_label: str,
        throttle_seconds: float = 2.5,
    ) -> None:
        self.bot = bot
        self.chat_id = chat_id
        self.message_id = message_id
        self.title = title
        self.quality_label = quality_label
        self.throttle_seconds = throttle_seconds
        self.last_update_time: float = 0.0
        self.last_rendered_text: str = ""
        self._lock = asyncio.Lock()

    def format_card(self, progress: ProgressData) -> str:
        """Render Arabic progress card according to design specifications."""
        escaped_title = escape_markdown(self.title[:60])
        escaped_quality = escape_markdown(self.quality_label)

        if progress.phase == "processing":
            return (
                "⚙️ *جاري معالجة الفيديو وتحسين التوافقية...*\n\n"
                f"📁 *الملف:* `{escaped_title}`\n"
                f"🎯 *الجودة:* {escaped_quality}\n"
                "🔄 *الحالة:* تحويل الترميز ودعم التشغيل المباشر على الهاتف\n\n"
                "يرجى الانتظار لحين اكتمال المعالجة..."
            )

        if progress.phase == "uploading":
            size_str = format_bytes(progress.total_bytes or progress.downloaded_bytes)
            return (
                "📤 *جاري رفع الملف إلى تيليجرام...*\n\n"
                f"📁 *الملف:* `{escaped_title}`\n"
                f"🎯 *الجودة:* {escaped_quality}\n"
                f"📦 *الحجم:* {size_str}\n\n"
                "لحظات ويصلك الملف في المحادثة..."
            )

        # Normal downloading phase
        pct_str = f"{progress.percent:.1f}%"
        size_str = format_bytes(progress.total_bytes or progress.downloaded_bytes)
        speed_str = format_speed(progress.speed)
        eta_str = format_eta(progress.eta)

        # Progress bar visualization (10 blocks)
        filled = min(10, max(0, int(progress.percent / 10)))
        bar = "▓" * filled + "░" * (10 - filled)

        return (
            "⏳ *جاري التحميل...*\n\n"
            f"📁 *الملف:* `{escaped_title}`\n"
            f"🎯 *الجودة:* {escaped_quality}\n"
            f"📦 *الحجم:* {size_str}\n"
            f"📊 *التقدم:* {pct_str} `[{bar}]`\n"
            f"⚡ *السرعة:* {speed_str}\n"
            f"⏱️ *الوقت المتبقي:* {eta_str}"
        )

    async def update(self, progress: ProgressData, force: bool = False) -> None:
        """Send throttled editMessageText update to Telegram."""
        now = time.monotonic()
        if not force and (now - self.last_update_time) < self.throttle_seconds:
            return

        text = self.format_card(progress)
        if text == self.last_rendered_text and not force:
            return

        async with self._lock:
            # Re-check inside lock
            now = time.monotonic()
            if not force and (now - self.last_update_time) < self.throttle_seconds:
                return

            try:
                await self.bot.edit_message_text(
                    chat_id=self.chat_id,
                    message_id=self.message_id,
                    text=text,
                    parse_mode="Markdown",
                )
                self.last_update_time = now
                self.last_rendered_text = text
            except BadRequest as err:
                # Ignore message not modified errors
                if "Message is not modified" not in str(err):
                    logger.debug("BadRequest on progress card edit: %s", err)
            except Exception as err:
                logger.debug("Failed to update progress card: %s", err)
