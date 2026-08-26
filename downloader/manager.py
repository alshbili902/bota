"""Download manager, queue, concurrency semaphore, and lifecycle controller."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
import time
from typing import Final
import uuid

from telegram import Bot, InputFile
from telegram.error import TelegramError

from config import Config, MESSAGES
from downloader.direct import DirectDownloader
from downloader.ytdlp import DownloadResult, MediaFormat, MediaMetadata, YtDlpEngine
from services.cleanup import clean_task_dir, create_temp_task_dir
from services.progress import ProgressData, ProgressThrottler
from utils.files import escape_markdown, format_bytes
from utils.logging import logger, sanitize_log_url


@dataclass
class DownloadTask:
    """Represents an ongoing active download job."""
    id: str
    user_id: int
    chat_id: int
    url: str
    metadata: MediaMetadata
    selected_format: MediaFormat
    temp_dir: Path
    status: str = "queued"  # queued, downloading, processing, uploading, completed, cancelled, failed
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    status_message_id: int | None = None
    start_time: float = field(default_factory=time.monotonic)
    progress: ProgressData = field(default_factory=ProgressData)


class DownloadManager:
    """Manages concurrent downloads, user concurrency locking, and status updates."""

    def __init__(self) -> None:
        self.semaphore: Final[asyncio.Semaphore] = asyncio.Semaphore(Config.MAX_CONCURRENT_DOWNLOADS)
        self.active_tasks: dict[int, DownloadTask] = {}
        self.metadata_cache: dict[str, tuple[MediaMetadata, float]] = {}
        self._lock = asyncio.Lock()

    def cache_metadata(self, metadata: MediaMetadata) -> str:
        """Cache metadata for 10 minutes and return a unique cache token."""
        token = uuid.uuid4().hex[:12]
        # Clean expired cache items
        now = time.monotonic()
        self.metadata_cache = {k: v for k, v in self.metadata_cache.items() if now - v[1] < 600}
        self.metadata_cache[token] = (metadata, now)
        return token

    def get_cached_metadata(self, token: str) -> MediaMetadata | None:
        """Retrieve cached metadata if valid."""
        item = self.metadata_cache.get(token)
        if item and (time.monotonic() - item[1] < 600):
            return item[0]
        return None

    def has_active_download(self, user_id: int) -> bool:
        """Check if user has an active ongoing download."""
        return user_id in self.active_tasks

    def get_user_task(self, user_id: int) -> DownloadTask | None:
        """Get the active task for a user."""
        return self.active_tasks.get(user_id)

    async def cancel_task(self, user_id: int) -> bool:
        """Cancel an active user download job and clean resources."""
        async with self._lock:
            task = self.active_tasks.get(user_id)
            if not task:
                return False

            task.status = "cancelled"
            task.cancel_event.set()
            clean_task_dir(task.temp_dir)
            self.active_tasks.pop(user_id, None)
            logger.info("Cancelled download task %s for user %d", task.id, user_id)
            return True

    def get_status_message(self, user_id: int) -> str:
        """Return formatted Arabic status text for /status."""
        task = self.active_tasks.get(user_id)
        if not task:
            return MESSAGES["NO_ACTIVE_DOWNLOAD"]

        escaped_title = escape_markdown(task.metadata.title[:50])
        status_labels = {
            "queued": "في قائمة الانتظار ⏳",
            "downloading": "جاري التحميل 📥",
            "processing": "جاري معالجة الفيديو ⚙️",
            "uploading": "جاري الرفع إلى تيليجرام 📤",
        }
        status_text = status_labels.get(task.status, task.status)
        pct_text = f"{task.progress.percent:.1f}%" if task.progress.percent > 0 else "--"

        return (
            "📊 *حالة التحميل الحالية:*\n\n"
            f"📁 *الملف:* `{escaped_title}`\n"
            f"🎯 *الجودة:* {escape_markdown(task.selected_format.label)}\n"
            f"🔄 *الحالة:* {status_text}\n"
            f"📈 *التقدم:* {pct_text}"
        )

    async def start_download(
        self,
        bot: Bot,
        chat_id: int,
        user_id: int,
        metadata: MediaMetadata,
        selected_format: MediaFormat,
    ) -> None:
        """Execute full download workflow under semaphore and user concurrency lock."""
        # 1. Enforce 1 active download per user
        async with self._lock:
            if user_id in self.active_tasks:
                raise ValueError("ACTIVE_DOWNLOAD")

            task_id = uuid.uuid4().hex[:8]
            temp_dir = create_temp_task_dir(task_id)
            task = DownloadTask(
                id=task_id,
                user_id=user_id,
                chat_id=chat_id,
                url=metadata.url,
                metadata=metadata,
                selected_format=selected_format,
                temp_dir=temp_dir,
            )
            self.active_tasks[user_id] = task

        logger.info("Registered download task %s for user %d: %s", task.id, user_id, sanitize_log_url(task.url))

        # Send initial status message in Telegram
        status_msg = await bot.send_message(
            chat_id=chat_id,
            text=(
                "⏳ *بدء عملية التحميل...*\n\n"
                f"📁 *الملف:* `{escape_markdown(metadata.title[:60])}`\n"
                f"🎯 *الجودة:* {escape_markdown(selected_format.label)}\n\n"
                "يرجى الانتظار، جاري تحضير الملف..."
            ),
            parse_mode="Markdown",
        )
        task.status_message_id = status_msg.message_id
        throttler = ProgressThrottler(
            bot=bot,
            chat_id=chat_id,
            message_id=status_msg.message_id,
            title=metadata.title,
            quality_label=selected_format.label,
        )

        try:
            # 2. Acquire concurrency semaphore
            async with self.semaphore:
                task.status = "downloading"

                async def on_progress(p: ProgressData) -> None:
                    task.progress = p
                    await throttler.update(p)

                # 3. Download based on provider (Direct HTTP vs yt-dlp)
                if metadata.is_direct_file or DirectDownloader.can_handle(metadata.url):
                    result = await DirectDownloader.download(
                        url=metadata.url,
                        title=metadata.title,
                        selected_format=selected_format,
                        temp_dir=task.temp_dir,
                        on_progress=on_progress,
                        cancel_event=task.cancel_event,
                    )
                else:
                    result = await YtDlpEngine.download(
                        url=metadata.url,
                        title=metadata.title,
                        selected_format=selected_format,
                        temp_dir=task.temp_dir,
                        on_progress=on_progress,
                        cancel_event=task.cancel_event,
                    )

                if task.cancel_event.is_set():
                    raise asyncio.CancelledError("DOWNLOAD_CANCELLED")

                # 4. Upload media to Telegram
                task.status = "uploading"
                await throttler.update(ProgressData(percent=100.0, total_bytes=result.filesize, phase="uploading"), force=True)

                await self._upload_media(bot, chat_id, result, selected_format.is_audio_only)

                task.status = "completed"
                # Remove progress message after successful delivery
                try:
                    await bot.delete_message(chat_id=chat_id, message_id=status_msg.message_id)
                except Exception:
                    pass

        except asyncio.CancelledError:
            task.status = "cancelled"
            logger.info("Task %s was cancelled by user %d", task.id, user_id)
            try:
                await bot.edit_message_text(chat_id=chat_id, message_id=status_msg.message_id, text=MESSAGES["CANCELLED"])
            except Exception:
                pass
        except ValueError as err:
            task.status = "failed"
            error_key = str(err)
            reply = MESSAGES.get(error_key, MESSAGES["DOWNLOAD_FAILED"])
            logger.warning("Download task %s failed with ValueError (%s): %s", task.id, error_key, err, exc_info=True)
            try:
                await bot.edit_message_text(chat_id=chat_id, message_id=status_msg.message_id, text=reply)
            except Exception:
                pass
        except (IndexError, KeyError) as err:
            task.status = "failed"
            logger.error("Data structure error in download task %s: %s", task.id, err, exc_info=True)
            try:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_msg.message_id,
                    text=MESSAGES["DOWNLOAD_FAILED"],
                )
            except Exception:
                pass
        except (FileNotFoundError, TimeoutError, asyncio.TimeoutError) as err:
            task.status = "failed"
            logger.error("File or timeout error in download task %s: %s", task.id, err, exc_info=True)
            try:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_msg.message_id,
                    text=MESSAGES["DOWNLOAD_FAILED"],
                )
            except Exception:
                pass
        except Exception as err:
            task.status = "failed"
            logger.error("Unhandled exception in download task %s: %s", task.id, err, exc_info=True)
            try:
                await bot.edit_message_text(
                    chat_id=chat_id,
                    message_id=status_msg.message_id,
                    text=MESSAGES["DOWNLOAD_FAILED"],
                )
            except Exception:
                pass
        finally:
            # 5. Clean temporary files and release active task lock
            clean_task_dir(task.temp_dir)
            async with self._lock:
                self.active_tasks.pop(user_id, None)
            logger.debug("Task %s cleaned and unregistered.", task.id)

    async def _upload_media(self, bot: Bot, chat_id: int, result: DownloadResult, is_audio: bool) -> None:
        """Send downloaded media via appropriate Telegram method with dimensions and thumbnail."""
        if not result.file_path or not result.file_path.exists() or result.filesize == 0:
            raise FileNotFoundError(f"Downloaded media file not found or empty: {result.file_path}")

        caption = f"🎬 `{escape_markdown(result.filename)}`\n📦 *الحجم:* {format_bytes(result.filesize)}"

        with open(result.file_path, "rb") as media_file:
            if is_audio or result.mime_type.startswith("audio/"):
                await bot.send_audio(
                    chat_id=chat_id,
                    audio=media_file,
                    caption=caption,
                    title=result.filename,
                    duration=int(result.duration) if result.duration else None,
                    parse_mode="Markdown",
                    read_timeout=120,
                    write_timeout=120,
                )
            elif result.mime_type.startswith("image/"):
                await bot.send_photo(
                    chat_id=chat_id,
                    photo=media_file,
                    caption=caption,
                    parse_mode="Markdown",
                    read_timeout=120,
                    write_timeout=120,
                )
            elif (
                result.mime_type.startswith("video/")
                or result.filename.lower().endswith((".mp4", ".mov", ".mkv", ".webm"))
            ):
                thumb_file = None
                if result.thumbnail_path and result.thumbnail_path.exists():
                    thumb_file = open(result.thumbnail_path, "rb")

                try:
                    await bot.send_video(
                        chat_id=chat_id,
                        video=media_file,
                        caption=caption,
                        duration=int(result.duration) if result.duration else None,
                        width=result.width,
                        height=result.height,
                        thumbnail=thumb_file,
                        supports_streaming=True,
                        parse_mode="Markdown",
                        read_timeout=180,
                        write_timeout=180,
                    )
                finally:
                    if thumb_file:
                        thumb_file.close()
            else:
                await bot.send_document(
                    chat_id=chat_id,
                    document=media_file,
                    caption=caption,
                    parse_mode="Markdown",
                    read_timeout=120,
                    write_timeout=120,
                )

        logger.info("Delivered file %s to chat %d", result.filename, chat_id)


manager = DownloadManager()
