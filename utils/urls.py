"""URL validation, SSRF protection, and query cleaning utilities."""

from __future__ import annotations

import ipaddress
import re
import socket
from urllib.parse import urlparse, urlunparse, parse_qs, urlencode


def is_valid_url(url: str) -> bool:
    """Validate that the string is a well-formed HTTP/HTTPS URL."""
    if not url or len(url) > 2048:
        return False
    try:
        parsed = urlparse(url.strip())
        return parsed.scheme.lower() in ("http", "https") and bool(parsed.netloc)
    except Exception:
        return False


def is_safe_url(url: str) -> bool:
    """SSRF Protection: Rejects private LAN, loopback, link-local, and cloud metadata endpoints."""
    if not is_valid_url(url):
        return False

    try:
        parsed = urlparse(url.strip())
        hostname = parsed.hostname

        if not hostname:
            return False

        hostname_lower = hostname.lower()

        # Block localhost and common cloud metadata domain names
        if hostname_lower in ("localhost", "metadata.google.internal") or hostname_lower.endswith(".local"):
            return False

        # Attempt to parse directly as an IP address
        try:
            ip_obj = ipaddress.ip_address(hostname)
            if (
                ip_obj.is_private
                or ip_obj.is_loopback
                or ip_obj.is_link_local
                or ip_obj.is_multicast
                or ip_obj.is_reserved
            ):
                return False
        except ValueError:
            # Hostname is a domain name. Resolve IP to verify destination
            try:
                addr_info = socket.getaddrinfo(hostname, None, proto=socket.IPPROTO_TCP)
                for item in addr_info:
                    sockaddr = item[4]
                    ip_str = sockaddr[0]
                    ip_obj = ipaddress.ip_address(ip_str)
                    if (
                        ip_obj.is_private
                        or ip_obj.is_loopback
                        or ip_obj.is_link_local
                        or ip_obj.is_multicast
                        or ip_obj.is_reserved
                    ):
                        return False
            except (socket.gaierror, socket.herror, ValueError):
                # If resolution fails, allow yt-dlp to handle or fail naturally
                pass

        return True
    except Exception:
        return False


def clean_tracking_url(url: str) -> str:
    """Strip tracking query parameters for cleaner media extraction (especially TikTok & Instagram)."""
    if not url:
        return ""

    try:
        parsed = urlparse(url.strip())
        netloc = parsed.netloc.lower()

        # For TikTok short links or canonical links, strip _r, _t, etc.
        if "tiktok.com" in netloc:
            # Return URL without query params if canonical video link
            if "/video/" in parsed.path:
                return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))

        # For Instagram, strip tracking parameters like igsh, igsi, etc.
        if "instagram.com" in netloc:
            if "/p/" in parsed.path or "/reel/" in parsed.path:
                return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", "", ""))

        # General tracking query stripper
        if parsed.query:
            query_dict = parse_qs(parsed.query)
            # Remove common analytics / tracking params
            filtered_query = {
                k: v
                for k, v in query_dict.items()
                if not k.lower().startswith(("utm_", "fbclid", "igsh", "igsi", "_r", "_t"))
            }
            new_query = urlencode(filtered_query, doseq=True)
            return urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment))

        return url
    except Exception:
        return url


def extract_urls(text: str) -> list[str]:
    """Extract all HTTP/HTTPS URLs from message text."""
    if not text:
        return []
    # Regex to capture valid URLs
    pattern = r"https?://[^\s<>\"'{}|\\^`\[\]]+"
    matches = re.findall(pattern, text)
    return [clean_tracking_url(m.rstrip(".,;!?:)")) for m in matches if is_valid_url(m)]
