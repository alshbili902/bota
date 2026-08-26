"""Strict 2-User Authorization Middleware for Rahami Bot."""

from __future__ import annotations

from functools import wraps
from typing import Any, Callable, Coroutine
from telegram import Update
from telegram.ext import ContextTypes

from config import Config, MESSAGES
from utils.logging import logger


def is_user_authorized(user_id: int | None) -> bool:
    """Return True if user_id is in the strict 2-user allowlist."""
    return bool(user_id and user_id in Config.ALLOWED_USER_IDS)


def restricted(func: Callable[..., Coroutine[Any, Any, Any]]) -> Callable[..., Coroutine[Any, Any, Any]]:
    """Decorator to enforce strict access control on commands, messages, and callbacks.

    Rejects any user outside Config.ALLOWED_USER_IDS with:
    'هذا البوت خاص وغير متاح لك.'
    Without revealing configuration or authorized IDs.
    """
    @wraps(func)
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args: Any, **kwargs: Any) -> Any:
        user = update.effective_user
        user_id = user.id if user else None

        if not is_user_authorized(user_id):
            logger.warning(
                "Access blocked for unauthorized user: %s (id: %s)",
                getattr(user, "username", "no_username"),
                user_id,
            )

            if update.callback_query:
                try:
                    await update.callback_query.answer(MESSAGES["UNAUTHORIZED"], show_alert=True)
                except Exception:
                    pass
            elif update.effective_message:
                try:
                    await update.effective_message.reply_text(MESSAGES["UNAUTHORIZED"])
                except Exception:
                    pass
            return None

        return await func(update, context, *args, **kwargs)

    return wrapper
