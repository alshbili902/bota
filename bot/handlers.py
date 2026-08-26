"""Command and message handlers for Rahami Bot."""

from __future__ import annotations

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import ContextTypes

from bot.middleware import restricted
from config import MESSAGES
from downloader.direct import DirectDownloader
from downloader.manager import manager
from downloader.ytdlp import YtDlpEngine
from utils.files import escape_markdown, format_bytes, format_duration
from utils.logging import logger, sanitize_log_url
from utils.urls import extract_urls, is_safe_url


def get_main_menu_keyboard() -> InlineKeyboardMarkup:
    """Return clean inline main menu buttons."""
    keyboard = [
        [
            InlineKeyboardButton("📥 أرسل رابطاً للتحميل", callback_data="menu:prompt_url"),
            InlineKeyboardButton("📊 حالة التحميل", callback_data="menu:status"),
        ],
        [
            InlineKeyboardButton("❌ إلغاء التحميل الجاري", callback_data="menu:cancel"),
            InlineKeyboardButton("ℹ️ المساعدة", callback_data="menu:help"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


@restricted
async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command."""
    if not update.effective_message:
        return
    await update.effective_message.reply_text(
        MESSAGES["WELCOME"],
        reply_markup=get_main_menu_keyboard(),
    )


@restricted
async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command."""
    if not update.effective_message:
        return
    await update.effective_message.reply_text(
        MESSAGES["HELP"],
        parse_mode="Markdown",
    )


@restricted
async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /status command."""
    if not update.effective_message or not update.effective_user:
        return
    user_id = update.effective_user.id
    status_text = manager.get_status_message(user_id)
    await update.effective_message.reply_text(status_text, parse_mode="Markdown")


@restricted
async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /cancel command."""
    if not update.effective_message or not update.effective_user:
        return
    user_id = update.effective_user.id
    success = await manager.cancel_task(user_id)
    if success:
        await update.effective_message.reply_text(MESSAGES["CANCELLED"])
    else:
        await update.effective_message.reply_text(MESSAGES["NO_ACTIVE_DOWNLOAD"])


@restricted
async def text_message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle incoming text messages and extract URLs."""
    if not update.effective_message or not update.effective_user:
        return

    text = update.effective_message.text or ""
    urls = extract_urls(text)

    # If no URL detected, show guidance
    if not urls:
        await update.effective_message.reply_text(
            "أرسلي رابط الفيديو أو الملف مباشرة لبدء التحميل 🎀",
            reply_markup=get_main_menu_keyboard(),
        )
        return

    url = urls[0]
    user_id = update.effective_user.id
    chat_id = update.effective_message.chat_id

    logger.info("Processing URL from user %d: %s", user_id, sanitize_log_url(url))

    # 1. SSRF Safety Check
    if not is_safe_url(url):
        logger.warning("Rejected unsafe URL from user %d: %s", user_id, sanitize_log_url(url))
        await update.effective_message.reply_text(MESSAGES["INVALID_URL"])
        return

    # 2. Check if user already has an active download
    if manager.has_active_download(user_id):
        await update.effective_message.reply_text(MESSAGES["ACTIVE_DOWNLOAD"])
        return

    # 3. Send analyzing status message
    status_msg = await update.effective_message.reply_text(
        MESSAGES["ANALYZING"],
        parse_mode="Markdown",
    )

    try:
        # 4. Analyze URL and extract metadata
        if DirectDownloader.can_handle(url):
            metadata = await DirectDownloader.extract_metadata(url)
        else:
            metadata = await YtDlpEngine.extract_metadata(url)

        logger.info("Extracted metadata for '%s' (%d formats)", metadata.title, len(metadata.formats))

        if not metadata.formats:
            await status_msg.edit_text(MESSAGES["NO_FORMATS"])
            return

        # 5. Cache metadata for button selection
        token = manager.cache_metadata(metadata)

        # 6. Build format selection inline keyboard
        buttons = []
        for fmt in metadata.formats:
            # callback_data: dl:<token>:<owner_id>:<format_id>
            cb_data = f"dl:{token}:{user_id}:{fmt.id}"
            buttons.append([InlineKeyboardButton(fmt.label, callback_data=cb_data)])

        buttons.append([InlineKeyboardButton("❌ إلغاء", callback_data=f"cancel:{user_id}")])
        reply_markup = InlineKeyboardMarkup(buttons)

        duration_line = f"⏱️ *المدة:* {format_duration(metadata.duration)}\n" if metadata.duration else ""
        size_line = f"📦 *الحجم التقديري:* {format_bytes(metadata.estimated_size)}\n" if metadata.estimated_size else ""

        card_text = (
            "📋 *خيارات التحميل المتاحة:*\n\n"
            f"📁 *العنوان:* `{escape_markdown(metadata.title[:60])}`\n"
            f"{duration_line}"
            f"{size_line}\n"
            "اضغط على الخيار المناسب لبدء التحميل:"
        )

        await status_msg.edit_text(
            card_text,
            reply_markup=reply_markup,
            parse_mode="Markdown",
        )

    except PermissionError:
        await status_msg.edit_text(MESSAGES["PRIVATE_ACCOUNT"])
    except ValueError as err:
        err_str = str(err)
        reply = MESSAGES.get(err_str, MESSAGES["UNSUPPORTED"])
        await status_msg.edit_text(reply)
    except Exception as err:
        logger.error("URL analysis failed for %s: %s", sanitize_log_url(url), err)
        await status_msg.edit_text(MESSAGES["UNSUPPORTED"])
