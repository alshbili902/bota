"""Unit tests for file sanitization and formatters."""

import unittest
from utils.files import (
    escape_markdown,
    format_bytes,
    format_duration,
    format_eta,
    format_speed,
    sanitize_filename,
)


class TestFiles(unittest.TestCase):
    """Test file sanitization and string formatters."""

    def test_sanitize_filename_traversal(self):
        """Path traversal and dangerous characters must be sanitized."""
        self.assertEqual(sanitize_filename("../../etc/passwd", "txt"), "etc_passwd.txt")
        self.assertEqual(sanitize_filename("..\\..\\boot.ini", "txt"), "boot.ini.txt")

    def test_sanitize_filename_reserved_chars(self):
        """Windows and Linux reserved characters must be replaced."""
        name = 'Video <Title>: "Best" | Quality? *test*'
        clean = sanitize_filename(name, "mp4")
        self.assertNotIn("<", clean)
        self.assertNotIn(">", clean)
        self.assertNotIn(":", clean)
        self.assertNotIn('"', clean)
        self.assertNotIn("|", clean)
        self.assertNotIn("?", clean)
        self.assertNotIn("*", clean)
        self.assertTrue(clean.endswith(".mp4"))

    def test_format_bytes(self):
        """Format byte values into human-readable strings."""
        self.assertEqual(format_bytes(500), "500.0 B")
        self.assertEqual(format_bytes(1024 * 1024), "1.0 MB")
        self.assertEqual(format_bytes(25.5 * 1024 * 1024), "25.5 MB")
        self.assertEqual(format_bytes(1.5 * 1024 * 1024 * 1024), "1.5 GB")
        self.assertEqual(format_bytes(0), "غير معروف")
        self.assertEqual(format_bytes(None), "غير معروف")

    def test_format_duration(self):
        """Format duration into MM:SS or HH:MM:SS."""
        self.assertEqual(format_duration(45), "00:45")
        self.assertEqual(format_duration(125), "02:05")
        self.assertEqual(format_duration(3665), "01:01:05")
        self.assertEqual(format_duration(None), "غير معروف")

    def test_format_speed(self):
        """Format download speed."""
        self.assertEqual(format_speed(5.5 * 1024 * 1024), "5.5 MB/s")
        self.assertEqual(format_speed(None), "--")

    def test_format_eta(self):
        """Format ETA seconds."""
        self.assertEqual(format_eta(45), "00:45")
        self.assertEqual(format_eta(125), "02:05")
        self.assertEqual(format_eta(None), "--")

    def test_escape_markdown(self):
        """Escape Markdown special characters."""
        self.assertEqual(escape_markdown("Test *bold* _italic_ [link]"), r"Test \*bold\* \_italic\_ \[link\]")


if __name__ == "__main__":
    unittest.main()
