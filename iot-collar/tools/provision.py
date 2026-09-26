"""Registers a new PetBnB collar.

Run on the laptop, once per collar:

    .venv/Scripts/python -m tools.provision            (Windows)
    .venv/bin/python -m tools.provision                (macOS/Linux)

It prints the SQL that registers the collar (paste it into the Supabase SQL editor — a prod write,
so only with Lukas's yes) and the text for the collar's sticker, and it writes the collar's
identity into the Pi's .env (default: iot-collar/.env, which is gitignored; copy it to the Pi).

The plain secret exists only in that .env: Supabase stores a bcrypt hash. The hash uses the $2a$
prefix, which pgcrypto's crypt() verifies.
"""
from __future__ import annotations

import argparse
import secrets
import sys
import uuid
from pathlib import Path
from typing import Callable

import bcrypt

# Crockford base-32: no I, L, O or U, so a code read off a sticker cannot be misread.
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
HERE = Path(__file__).resolve().parent.parent


def new_pair_code(randbelow: Callable[[int], int] = secrets.randbelow) -> str:
    return "".join(ALPHABET[randbelow(len(ALPHABET))] for _ in range(8))


def format_pair_code(code: str) -> str:
    return f"{code[:4]}-{code[4:]}"


def hash_secret(secret: str, rounds: int = 10) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt(rounds=rounds, prefix=b"2a")).decode()


def registration_sql(device_id: str, secret_hash: str, pair_code: str) -> str:
    return (
        "insert into public.collar_devices (id, owner_id, device_secret_hash, pair_code)\n"
        f"values ('{device_id}', null, '{secret_hash}', '{pair_code}');"
    )


def write_env(env_path: Path, example_path: Path, device_id: str, secret: str) -> None:
    if env_path.exists():
        lines = env_path.read_text().splitlines()
    elif example_path.exists():
        lines = example_path.read_text().splitlines()
    else:
        lines = []
    wanted = {"DEVICE_ID": device_id, "DEVICE_SECRET": secret}
    out, seen = [], set()
    for line in lines:
        key = line.split("=", 1)[0].strip()
        if key in wanted:
            out.append(f"{key}={wanted[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, value in wanted.items():
        if key not in seen:
            out.append(f"{key}={value}")
    env_path.write_text("\n".join(out) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Register a new PetBnB collar.")
    parser.add_argument("--env", type=Path, default=HERE / ".env", help="the Pi's .env to write")
    parser.add_argument("--example", type=Path, default=HERE / ".env.example")
    args = parser.parse_args(argv)

    device_id = str(uuid.uuid4())
    secret = secrets.token_urlsafe(32)
    code = new_pair_code()

    write_env(args.env, args.example, device_id, secret)

    print("1. Run this in the Supabase SQL editor (prod write: needs Lukas's yes):\n")
    print(registration_sql(device_id, hash_secret(secret), code))
    print("\n2. Print this on the collar's sticker:\n")
    print(f"   PETBNB COLLAR · PAIRING CODE {format_pair_code(code)}")
    print(f"\n3. Copy {args.env} to the Pi (scp) and restart the collar service.")
    print("\nThe secret is only in that file. Don't commit it, and don't paste it anywhere.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
