"""Loads collar configuration from environment variables (.env in this directory)."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")


@dataclass(frozen=True)
class Config:
    device_id: str
    device_secret: str
    ingest_url: str
    supabase_anon_key: str
    gps_serial_port: str
    gps_baud_rate: int
    fix_interval_seconds: float
    offline_queue_path: Path


def load_config() -> Config:
    return Config(
        device_id=_require("DEVICE_ID"),
        device_secret=_require("DEVICE_SECRET"),
        ingest_url=_require("INGEST_URL"),
        supabase_anon_key=_require("SUPABASE_ANON_KEY"),
        gps_serial_port=os.getenv("GPS_SERIAL_PORT", "/dev/serial0"),
        gps_baud_rate=int(os.getenv("GPS_BAUD_RATE", "9600")),
        fix_interval_seconds=float(os.getenv("FIX_INTERVAL_SECONDS", "15")),
        offline_queue_path=Path(os.getenv("OFFLINE_QUEUE_PATH", "./queue.jsonl")),
    )


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value
