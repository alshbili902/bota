"""Callback query handlers for format selection and inline buttons."""

from __future__ import annotations

import asyncio
from telegram import Update
from telegram.ext import ContextTypes

from bot.middleware import restricted
from config import MESSAGES
from downloader.manager import manager
from utils.logging import logger


@restricted
async def callback_query_handler(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Process inline keyboard button clicks."""
    query = update.callback_query
    if not query or not update.effective_user or not update.effective_chat:
        return

    data = query.data or ""
    user_id = update.effective_user.id
    chat_id = update.effective_chat.id

    parts = data.split(":")
    action = parts[0] if parts else ""

    # 1. Main Menu Buttons
    if action == "menu":
        menu_action = parts[1] if len(parts) > 1 else ""
        await query.answer()

        if menu_action == "prompt_url":
            await query.message.reply_text("أرسل الرابط مباشرة في المحادثة للبدء في تحميله 🎀")
        elif menu_action == "status":
            await query.message.reply_text(manager.get_status_message(user_id), parse_mode="Markdown")
        elif menu_action == "cancel":
            success = await manager.cancel_task(user_id)
            if success:
                await query.message.reply_text(MESSAGES["CANCELLED"])
            else:
                await query.message.reply_text(MESSAGES["NO_ACTIVE_DOWNLOAD"])
        elif menu_action == "help":
            await query.message.reply_text(MESSAGES["HELP"], parse_mode="Markdown")
        return

    # 2. Cancel Button from Format Selection Menu
    if action == "cancel":
        owner_id = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else user_id
        if user_id != owner_id:
            await query.answer("هذا الإجراء غير متاح لك.", show_alert=True)
            return

        await query.answer()
        await manager.cancel_task(user_id)
        try:
            await query.edit_message_text(MESSAGES["CANCELLED"])
        except Exception:
            pass
        return

    try:
        # 3. Format Selection Download Button (dl:<token>:<owner_id>:<format_id>)
        if action == "dl":
            if len(parts) < 4:
                await query.answer("طلب غير صالح.", show_alert=True)
                return

            token = parts[1]
            owner_id = int(parts[2]) if parts[2].isdigit() else 0
            format_id = parts[3]

            # Security check: verify button belongs to this user
            if user_id != owner_id:
                await query.answer("لا يمكنك استخدام هذا الزر لأن الرابط يخص مستخدماً آخر.", show_alert=True)
                return

            # Check if user already has an active download
            if manager.has_active_download(user_id):
                await query.answer(MESSAGES["ACTIVE_DOWNLOAD"], show_alert=True)
                return

            metadata = manager.get_cached_metadata(token)
            if not metadata:
                await query.answer("انتهت صلاحية هذا الرابط. يرجى إرسال الرابط من جديد.", show_alert=True)
                try:
                    await query.edit_message_text("⚠️ انتهت صلاحية خيارات التحميل. أرسل الرابط مرة أخرى.")
                except Exception:
                    pass
                return

            selected_format = next((f for f in metadata.formats if f.id == format_id), None)
            if not selected_format:
                # Defensive fallback: if requested format is not found, fallback to first available format safely
                if metadata.formats and len(metadata.formats) > 0:
                    selected_format = metadata.formats[0]
                    logger.warning(
                        "Selected format '%s' not found for token %s. Safely falling back to '%s'",
                        format_id,
                        token,
                        selected_format.id,
                    )
                else:
                    await query.answer("الصيغة المختارة غير متوفرة.", show_alert=True)
                    return

            await query.answer("جاري بدء التحميل...")

            # Delete or edit format menu to prevent duplicate clicks
            try:
                await query.delete_message()
            except Exception:
                try:
                    await query.edit_message_reply_markup(reply_markup=None)
                except Exception:
                    pass

            # Spawn download background task
            asyncio.create_task(
                manager.start_download(
                    bot=context.bot,
                    chat_id=chat_id,
                    user_id=user_id,
                    metadata=metadata,
                    selected_format=selected_format,
                )
            )
            return

        await query.answer()

    except Exception as err:
        logger.error("Callback query processing failed: %s", err, exc_info=True)
        try:
            await query.answer(MESSAGES["DOWNLOAD_FAILED"], show_alert=True)
        except Exception:
            pass
