import re

import bcrypt

from tools.provision import (
    ALPHABET, format_pair_code, hash_secret, new_pair_code, registration_sql, write_env,
)


def test_alphabet_is_crockford_without_confusable_letters():
    assert len(ALPHABET) == 32
    assert not set("ILOU") & set(ALPHABET)


def test_pair_codes_are_eight_characters_from_the_alphabet():
    for _ in range(200):
        code = new_pair_code()
        assert re.fullmatch(r"[0-9A-HJKMNP-TV-Z]{8}", code)


def test_pair_code_uses_the_random_source():
    assert new_pair_code(randbelow=lambda n: 0) == "00000000"
    assert new_pair_code(randbelow=lambda n: 31) == "ZZZZZZZZ"


def test_format_adds_the_dash():
    assert format_pair_code("7K3Q9D2M") == "7K3Q-9D2M"


def test_hash_is_2a_bcrypt_that_verifies():
    hashed = hash_secret("s3cret", rounds=4)
    assert hashed.startswith("$2a$04$")
    assert bcrypt.checkpw(b"s3cret", hashed.encode())


def test_registration_sql_registers_an_unowned_collar():
    sql = registration_sql("11111111-2222-4333-8444-555555555555", "$2a$10$abc", "7K3Q9D2M")
    assert "insert into public.collar_devices (id, owner_id, device_secret_hash, pair_code)" in sql
    assert "values ('11111111-2222-4333-8444-555555555555', null, '$2a$10$abc', '7K3Q9D2M');" in sql


def test_write_env_replaces_identity_and_keeps_the_rest(tmp_path):
    env = tmp_path / ".env"
    env.write_text("DEVICE_ID=old\nDEVICE_SECRET=old\nSUPABASE_ANON_KEY=keep-me\n")
    write_env(env, tmp_path / "missing.example", "new-id", "new-secret")
    text = env.read_text()
    assert "DEVICE_ID=new-id\n" in text and "DEVICE_SECRET=new-secret\n" in text
    assert "SUPABASE_ANON_KEY=keep-me\n" in text
    assert "old" not in text


def test_write_env_starts_from_the_example_when_there_is_no_env(tmp_path):
    example = tmp_path / ".env.example"
    example.write_text("DEVICE_ID=0000\nDEVICE_SECRET=change-me\nFIX_INTERVAL_SECONDS=15\n")
    env = tmp_path / ".env"
    write_env(env, example, "new-id", "new-secret")
    assert env.read_text() == "DEVICE_ID=new-id\nDEVICE_SECRET=new-secret\nFIX_INTERVAL_SECONDS=15\n"


def test_write_env_uses_unix_line_endings_for_the_pi(tmp_path):
    # Written on Windows it had CRLF, and the Pi is Linux (seen 2026-09-28).
    env = tmp_path / ".env"
    write_env(env, tmp_path / "missing.example", "new-id", "new-secret")
    assert b"\r" not in env.read_bytes()
