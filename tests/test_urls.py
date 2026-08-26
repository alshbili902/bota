"""Unit tests for URL validation and SSRF protection."""

import unittest
from utils.urls import clean_tracking_url, extract_urls, is_safe_url, is_valid_url


class TestUrls(unittest.TestCase):
    """Test URL parsing, sanitization, and SSRF prevention."""

    def test_valid_urls(self):
        """Standard valid HTTP/HTTPS URLs."""
        self.assertTrue(is_valid_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
        self.assertTrue(is_valid_url("http://example.com/video.mp4"))
        self.assertTrue(is_valid_url("https://vt.tiktok.com/ZSVqQPVuM/"))

    def test_invalid_urls(self):
        """Invalid schemas and malformed URLs."""
        self.assertFalse(is_valid_url(""))
        self.assertFalse(is_valid_url("not_a_url"))
        self.assertFalse(is_valid_url("ftp://example.com/file.zip"))
        self.assertFalse(is_valid_url("file:///etc/passwd"))
        self.assertFalse(is_valid_url("javascript:alert(1)"))

    def test_ssrf_blocks_private_ips(self):
        """SSRF protection must block loopback, local LAN and metadata endpoints."""
        self.assertFalse(is_safe_url("http://127.0.0.1/admin"))
        self.assertFalse(is_safe_url("http://localhost:8080/"))
        self.assertFalse(is_safe_url("http://10.0.0.5/api"))
        self.assertFalse(is_safe_url("http://192.168.1.1/"))
        self.assertFalse(is_safe_url("http://172.16.0.1/"))
        self.assertFalse(is_safe_url("http://169.254.169.254/latest/meta-data/"))
        self.assertFalse(is_safe_url("http://[::1]/"))

    def test_ssrf_permits_public_urls(self):
        """Public web services must be allowed."""
        self.assertTrue(is_safe_url("https://www.youtube.com/watch?v=test"))
        self.assertTrue(is_safe_url("https://www.instagram.com/reel/test/"))
        self.assertTrue(is_safe_url("https://vt.tiktok.com/test/"))

    def test_clean_tracking_url(self):
        """Tracking queries should be removed for video links."""
        tt_url = "https://www.tiktok.com/@user/video/123456789?_r=1&_t=ZS-99"
        self.assertEqual(clean_tracking_url(tt_url), "https://www.tiktok.com/@user/video/123456789")

        ig_url = "https://www.instagram.com/p/Db3KqPst4mp/?igsh=MW44eWF0ejhhcmYyMQ=="
        self.assertEqual(clean_tracking_url(ig_url), "https://www.instagram.com/p/Db3KqPst4mp/")

    def test_extract_urls(self):
        """Finds valid URLs within text messages."""
        text = "Hello check this video https://vt.tiktok.com/ZSVqQPVuM/ and this https://example.com/file.mp4"
        urls = extract_urls(text)
        self.assertEqual(len(urls), 2)
        self.assertEqual(urls[0], "https://vt.tiktok.com/ZSVqQPVuM/")
        self.assertEqual(urls[1], "https://example.com/file.mp4")


if __name__ == "__main__":
    unittest.main()
