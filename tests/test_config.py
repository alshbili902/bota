"""Unit tests for configuration validation and strict 2-user enforcement."""

import unittest
from unittest.mock import patch
from config import Config


class TestConfigValidation(unittest.TestCase):
    """Test configuration validation rules."""

    def test_strict_two_users_accepted(self):
        """Configuration with exactly two valid IDs must pass."""
        with patch.object(Config, "raw_allowed", "111222333,444555666"):
            with patch.object(Config, "BOT_TOKEN", "1234567890:AAH5BV_IHBKI_snbKtEwQcLYqbFsC_6O2Sw"):
                Config.validate()
                self.assertEqual(len(Config.ALLOWED_USER_IDS), 2)
                self.assertIn(111222333, Config.ALLOWED_USER_IDS)
                self.assertIn(444555666, Config.ALLOWED_USER_IDS)

    def test_single_user_rejected(self):
        """Configuration with only 1 user must fail."""
        with patch.object(Config, "raw_allowed", "111222333"):
            with patch.object(Config, "BOT_TOKEN", "1234567890:AAH5BV_IHBKI_snbKtEwQcLYqbFsC_6O2Sw"):
                with self.assertRaises(ValueError):
                    Config.validate()

    def test_three_users_rejected(self):
        """Configuration with 3 users must fail."""
        with patch.object(Config, "raw_allowed", "111,222,333"):
            with patch.object(Config, "BOT_TOKEN", "1234567890:AAH5BV_IHBKI_snbKtEwQcLYqbFsC_6O2Sw"):
                with self.assertRaises(ValueError):
                    Config.validate()

    def test_invalid_string_rejected(self):
        """Non-integer user IDs must fail."""
        with patch.object(Config, "raw_allowed", "user1,user2"):
            with patch.object(Config, "BOT_TOKEN", "1234567890:AAH5BV_IHBKI_snbKtEwQcLYqbFsC_6O2Sw"):
                with self.assertRaises(ValueError):
                    Config.validate()

    def test_missing_bot_token_rejected(self):
        """Empty or invalid bot token must fail."""
        with patch.object(Config, "raw_allowed", "111,222"):
            with patch.object(Config, "BOT_TOKEN", ""):
                with self.assertRaises(ValueError):
                    Config.validate()


if __name__ == "__main__":
    unittest.main()
