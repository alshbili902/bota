"""Unit tests for user authorization and middleware protection."""

import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from bot.middleware import is_user_authorized, restricted
from config import Config, MESSAGES


class TestAuth(unittest.IsolatedAsyncioTestCase):
    """Test user authorization and security boundaries."""

    def setUp(self):
        Config.ALLOWED_USER_IDS.clear()
        Config.ALLOWED_USER_IDS.update({937470619, 596354371})

    def test_is_user_authorized(self):
        """Verify allowlist lookup for authorized and unauthorized users."""
        self.assertTrue(is_user_authorized(937470619))
        self.assertTrue(is_user_authorized(596354371))
        self.assertFalse(is_user_authorized(123456))
        self.assertFalse(is_user_authorized(None))

    async def test_restricted_decorator_allows_authorized_user(self):
        """Authorized user must be permitted to execute handler."""
        mock_handler = AsyncMock(return_value="executed")
        decorated = restricted(mock_handler)

        update = MagicMock()
        update.effective_user.id = 937470619
        update.effective_user.username = "valid_user"
        context = MagicMock()

        result = await decorated(update, context)
        self.assertEqual(result, "executed")
        mock_handler.assert_awaited_once_with(update, context)

    async def test_restricted_decorator_blocks_unauthorized_user(self):
        """Unauthorized user must be blocked with standard error message."""
        mock_handler = AsyncMock(return_value="executed")
        decorated = restricted(mock_handler)

        update = MagicMock()
        update.effective_user.id = 999999999
        update.effective_user.username = "hacker"
        update.callback_query = None
        update.effective_message.reply_text = AsyncMock()
        context = MagicMock()

        result = await decorated(update, context)
        self.assertIsNone(result)
        mock_handler.assert_not_called()
        update.effective_message.reply_text.assert_awaited_once_with(MESSAGES["UNAUTHORIZED"])

    async def test_restricted_decorator_blocks_unauthorized_callback(self):
        """Unauthorized user clicking an inline button must get alert answer."""
        mock_handler = AsyncMock(return_value="executed")
        decorated = restricted(mock_handler)

        update = MagicMock()
        update.effective_user.id = 888888888
        update.callback_query.answer = AsyncMock()
        context = MagicMock()

        result = await decorated(update, context)
        self.assertIsNone(result)
        mock_handler.assert_not_called()
        update.callback_query.answer.assert_awaited_once_with(MESSAGES["UNAUTHORIZED"], show_alert=True)


if __name__ == "__main__":
    unittest.main()
