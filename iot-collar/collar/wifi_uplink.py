"""Posts GPS fixes to the collar-ingest Supabase Edge Function over WiFi.

Fixes that fail to send (no WiFi, backend unreachable) are appended to a local
JSONL queue and retried on the next tick, so a walk out of WiFi range doesn't
lose data -- it just arrives late once the collar is back in range.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

from .gps_reader import Fix

logger = logging.getLogger(__name__)


class WiFiUplink:
    def __init__(
        self,
        ingest_url: str,
        device_id: str,
        device_secret: str,
        supabase_anon_key: str,
        queue_path: Path,
        battery_pct_provider=None,
        timeout_seconds: float = 5.0,
    ):
        self._ingest_url = ingest_url
        self._device_id = device_id
        self._device_secret = device_secret
        self._anon_key = supabase_anon_key
        self._queue_path = queue_path
        self._battery_pct_provider = battery_pct_provider
        self._timeout = timeout_seconds
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)

    def send(self, fix: Fix) -> None:
        """Sends one fix, queueing it locally on any failure."""
        self._flush_queue()
        payload = self._build_payload(fix)
        if self._post(payload):
            return
        self._enqueue(payload)

    def _flush_queue(self) -> None:
        if not self._queue_path.exists() or self._queue_path.stat().st_size == 0:
            return
        remaining = []
        for line in self._queue_path.read_text().splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            if not self._post(payload):
                remaining.append(line)
        self._queue_path.write_text("\n".join(remaining) + ("\n" if remaining else ""))
        if remaining:
            logger.info("%d queued fix(es) still pending", len(remaining))

    def _post(self, payload: dict) -> bool:
        try:
            response = requests.post(
                self._ingest_url,
                json=payload,
                headers={
                    "apikey": self._anon_key,
                    "Authorization": f"Bearer {self._anon_key}",
                    "Content-Type": "application/json",
                },
                timeout=self._timeout,
            )
            if response.ok:
                return True
            logger.warning("Ingest rejected fix: %s %s", response.status_code, response.text)
            return False
        except requests.RequestException as exc:
            logger.info("Ingest unreachable, queueing fix: %s", exc)
            return False

    def _enqueue(self, payload: dict) -> None:
        with self._queue_path.open("a") as f:
            f.write(json.dumps(payload) + "\n")

    def _build_payload(self, fix: Fix) -> dict:
        battery_pct: Optional[int] = self._battery_pct_provider() if self._battery_pct_provider else None
        return {
            "device_id": self._device_id,
            "device_secret": self._device_secret,
            "lat": fix.lat,
            "lng": fix.lng,
            "speed_kmh": round(fix.speed_kmh, 1),
            "battery_pct": battery_pct,
            "recorded_at": datetime.fromtimestamp(fix.fix_time, tz=timezone.utc).isoformat(),
        }
