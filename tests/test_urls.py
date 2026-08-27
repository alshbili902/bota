"""Tests for URL validation, SSRF prevention, and source detection."""

import pytest
from app.services.analyzer import detect_source, format_duration, is_safe_url


def test_url_safety_ssrf():
    """Verify SSRF protection rejects localhost, local IPs, and private subnets."""
    assert is_safe_url("http://localhost") is False
    assert is_safe_url("http://127.0.0.1:8000") is False
    assert is_safe_url("http://0.0.0.0") is False
    assert is_safe_url("http://192.168.1.1/admin") is False
    assert is_safe_url("http://10.0.0.1") is False
    assert is_safe_url("http://169.254.169.254/latest/meta-data") is False
    assert is_safe_url("ftp://example.com/file") is False
    assert is_safe_url("file:///etc/passwd") is False

    # Valid public URLs
    assert is_safe_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ") is True
    assert is_safe_url("https://www.tiktok.com/@user/video/123456789") is True
    assert is_safe_url("https://instagram.com/reel/Cx12345") is True
    assert is_safe_url("https://x.com/user/status/123456") is True


def test_source_detection():
    """Verify source platform categorization."""
    assert detect_source("https://www.youtube.com/watch?v=123") == "YouTube"
    assert detect_source("https://youtu.be/123") == "YouTube"
    assert detect_source("https://www.tiktok.com/@test/video/123") == "TikTok"
    assert detect_source("https://www.instagram.com/reel/123") == "Instagram"
    assert detect_source("https://x.com/someone/status/123") == "X (Twitter)"
    assert detect_source("https://twitter.com/someone/status/123") == "X (Twitter)"
    assert detect_source("https://www.pinterest.com/pin/123") == "Pinterest"
    assert detect_source("https://example.com/video.mp4") == "Direct / Web"


def test_format_duration():
    """Verify duration formatting."""
    assert format_duration(None) is None
    assert format_duration(0) is None
    assert format_duration(45) == "00:45"
    assert format_duration(125) == "02:05"
    assert format_duration(3665) == "01:01:05"
