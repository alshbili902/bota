"""CLI tool to generate secure bcrypt password hashes for ALLOWED_USERS."""

from __future__ import annotations

import sys
from app.core.security import hash_password


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.cli.hash_password <plain_password>")
        print("Example: python -m app.cli.hash_password RahamiSecure2026!")
        sys.exit(1)

    raw_password = sys.argv[1]
    hashed = hash_password(raw_password)
    print("\n=======================================================")
    print("Rahami — Password Hash Generated Successfully")
    print("=======================================================")
    print(f"Password: {raw_password}")
    print(f"Bcrypt Hash: {hashed}")
    print("\nCopy this hash into your .env file under ALLOWED_USERS:")
    print(f'ALLOWED_USERS=user1:{hashed},user2:<second_user_hash>')
    print("=======================================================\n")


if __name__ == "__main__":
    main()
