"""Unit tests for defensive format selection, parser resilience, and error safety."""

import unittest
from pathlib import Path
from unittest.mock import MagicMock

from downloader.ytdlp import MediaFormat, MediaMetadata, YtDlpEngine


class TestDefensiveFormatSelection(unittest.TestCase):
    """Test suite ensuring format selection and metadata parsing never raise IndexError."""

    def test_parse_info_with_separate_streams(self):
        """Test video with separate video and audio streams."""
        info = {
            "title": "Separate Streams Video",
            "duration": 60,
            "formats": [
                {"format_id": "v1080", "vcodec": "avc1", "acodec": "none", "height": 1080, "ext": "mp4"},
                {"format_id": "v720", "vcodec": "avc1", "acodec": "none", "height": 720, "ext": "mp4"},
                {"format_id": "a1", "vcodec": "none", "acodec": "mp4a", "ext": "m4a"},
            ],
        }
        meta = YtDlpEngine._parse_info_dict("https://example.com/video", info)
        fmt_ids = [f.id for f in meta.formats]
        self.assertIn("best", fmt_ids)
        self.assertIn("res_1080", fmt_ids)
        self.assertIn("res_720", fmt_ids)
        self.assertIn("audio_mp3", fmt_ids)
        # Verify 480 and 360 are NOT present because they don't exist in source formats
        self.assertNotIn("res_480", fmt_ids)
        self.assertNotIn("res_360", fmt_ids)

    def test_parse_info_with_combined_stream(self):
        """Test video with a combined video+audio stream."""
        info = {
            "title": "Combined Stream Video",
            "duration": 120,
            "formats": [
                {"format_id": "c720", "vcodec": "h264", "acodec": "aac", "height": 720, "ext": "mp4"},
            ],
        }
        meta = YtDlpEngine._parse_info_dict("https://example.com/combined", info)
        fmt_ids = [f.id for f in meta.formats]
        self.assertIn("best", fmt_ids)
        self.assertIn("res_720", fmt_ids)
        self.assertIn("audio_mp3", fmt_ids)

    def test_parse_info_audio_only(self):
        """Test media that only contains audio streams."""
        info = {
            "title": "Podcast Episode",
            "duration": 3600,
            "formats": [
                {"format_id": "audio_128", "vcodec": "none", "acodec": "mp3", "ext": "mp3"},
            ],
        }
        meta = YtDlpEngine._parse_info_dict("https://example.com/audio", info)
        fmt_ids = [f.id for f in meta.formats]
        self.assertIn("audio_mp3", fmt_ids)
        self.assertNotIn("res_1080", fmt_ids)
        self.assertNotIn("res_720", fmt_ids)

    def test_parse_info_single_format(self):
        """Test source with only one format available."""
        info = {
            "title": "Single Format File",
            "url": "https://example.com/file.mp4",
            "ext": "mp4",
            "formats": [],
        }
        meta = YtDlpEngine._parse_info_dict("https://example.com/file", info)
        self.assertTrue(len(meta.formats) >= 1)
        self.assertEqual(meta.formats[0].id, "best")

    def test_parse_info_missing_filesize_and_resolution(self):
        """Test source where filesize and resolution are both unavailable."""
        info = {
            "title": "Unknown Specs",
            "formats": [
                {"format_id": "stream1", "ext": "mp4"},
            ],
        }
        meta = YtDlpEngine._parse_info_dict("https://example.com/unknown", info)
        self.assertTrue(len(meta.formats) >= 1)
        self.assertIsNone(meta.estimated_size)

    def test_parse_info_completely_empty_dict(self):
        """Test completely empty info dict without crashing."""
        info = {}
        meta = YtDlpEngine._parse_info_dict("https://example.com/empty", info)
        self.assertTrue(len(meta.formats) >= 1)
        self.assertEqual(meta.formats[0].id, "best")

    def test_parse_info_malformed_formats_elements(self):
        """Test formats list containing non-dict elements."""
        info = {
            "title": "Malformed List",
            "formats": [None, "invalid_string", 123, []],
        }
        meta = YtDlpEngine._parse_info_dict("https://example.com/malformed", info)
        self.assertTrue(len(meta.formats) >= 1)

    def test_merger_line_no_index_error(self):
        """Test that yt-dlp [Merger] line never throws IndexError (regression fix)."""
        merger_line = '[Merger] Merging formats into "temp/output.mp4"'
        parts = merger_line.split("[Merger] Merging formats into", 1)
        self.assertTrue(len(parts) > 1)
        extracted = Path(parts[1].strip().strip('"\''))
        self.assertEqual(extracted.name, "output.mp4")

    def test_destination_line_safe_extraction(self):
        """Test that yt-dlp [download] Destination line extracts correctly without IndexError."""
        dest_line = '[download] Destination: temp/output.mp4'
        parts = dest_line.split("[download] Destination:", 1)
        self.assertTrue(len(parts) > 1)
        extracted = Path(parts[1].strip().strip('"\''))
        self.assertEqual(extracted.name, "output.mp4")

    def test_eta_seconds_safe_parsing(self):
        """Test that _eta_to_seconds never raises IndexError or ValueError on corrupt ETAs."""
        self.assertEqual(YtDlpEngine._eta_to_seconds("01:30"), 90.0)
        self.assertEqual(YtDlpEngine._eta_to_seconds("01:02:03"), 3723.0)
        self.assertEqual(YtDlpEngine._eta_to_seconds(""), 0.0)
        self.assertEqual(YtDlpEngine._eta_to_seconds("unknown"), 0.0)
        self.assertEqual(YtDlpEngine._eta_to_seconds("12:invalid"), 0.0)


if __name__ == "__main__":
    unittest.main()
