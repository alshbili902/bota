"""Launcher script for Rahami web server accessible from local network (mobile phones)."""

from __future__ import annotations

import socket
import sys
import uvicorn

# Configure stdout for utf-8 on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def get_local_ip() -> str:
    """Get the primary local IPv4 address of the computer on the Wi-Fi/LAN."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def main():
    local_ip = get_local_ip()
    port = 5001

    print("\n" + "=" * 65)
    print("   Rahami — رهامي (منصة التحميل الخاصة)")
    print("=" * 65)
    print(f"[*] للتشغيل على هذا الكمبيوتر:")
    print(f"    http://localhost:{port}/  أو  http://127.0.0.1:{port}/")
    print("-" * 65)
    print(f"[*] للتشغيل على هاتفك عبر نفس شبكة الواي فاي (Wi-Fi):")
    print(f"    👉  http://{local_ip}:{port}/")
    print("=" * 65)
    print("اضغط CTRL+C لإيقاف السيرفر في أي وقت.\n")

    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=False)


if __name__ == "__main__":
    main()
