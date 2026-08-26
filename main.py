"""Application entrypoint for Rahami Telegram Downloader Bot.

Executes startup checks, binary discovery, cleans temporary folders,
and initializes Telegram polling with graceful shutdown.
"""

from __future__ import annotations

import sys
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

from bot.callbacks import callback_query_handler
from bot.handlers import (
    cancel_command,
    help_command,
    start_command,
    status_command,
    text_message_handler,
)
from config import Config
from services.cleanup import clean_orphaned_temp_dirs
from utils.logging import logger


async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Global error handler for unexpected Telegram exceptions."""
    logger.error("Unhandled Telegram exception: %s", context.error)
    if isinstance(update, Update) and update.effective_message:
        try:
            await update.effective_message.reply_text("حدث خطأ غير متوقع أثناء معالجة الطلب.")
        except Exception:
            pass


def main() -> None:
    """Validate configuration, dependencies, and start Telegram bot polling."""
    logger.info("========================================================")
    logger.info("Starting Rahami Private Telegram Download Bot")
    logger.info("========================================================")

    # 1. Validate environment configuration & user allowlist
    try:
        Config.validate()
        logger.info(
            "Configuration valid. Strictly authorized users count: %d (%s)",
            len(Config.ALLOWED_USER_IDS),
            Config.ALLOWED_USER_IDS,
        )
    except Exception as err:
        logger.critical("Startup configuration error: %s", err)
        sys.exit(1)

    # 2. Validate system binaries (yt-dlp, ffmpeg)
    try:
        Config.validate_binaries()
        logger.info("Binary verified: yt-dlp at '%s'", Config.YTDLP_PATH)
        logger.info("Binary verified: ffmpeg at '%s'", Config.FFMPEG_PATH)
        if Config.FFPROBE_PATH:
            logger.info("Binary verified: ffprobe at '%s'", Config.FFPROBE_PATH)
    except Exception as err:
        logger.critical("Dependency error: %s", err)
        sys.exit(1)

    # 3. Clean any orphaned temporary directories from previous sessions
    clean_orphaned_temp_dirs()

    # 4. Build python-telegram-bot Application
    logger.info("Connecting to Telegram Bot API...")
    app = (
        ApplicationBuilder()
        .token(Config.BOT_TOKEN)
        .concurrent_updates(True)
        .build()
    )

    # 5. Register command handlers
    app.add_handler(CommandHandler("start", start_command))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CommandHandler("status", status_command))
    app.add_handler(CommandHandler("cancel", cancel_command))

    # 6. Register callback query handler for buttons
    app.add_handler(CallbackQueryHandler(callback_query_handler))

    # 7. Register message handler for URLs and text
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_message_handler))

    # 8. Register error handler
    app.add_error_handler(error_handler)

    # 9. Start polling
    logger.info("Rahami Telegram Bot is live and listening for updates.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
