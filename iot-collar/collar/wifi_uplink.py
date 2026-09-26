"""Posts GPS fixes and no-fix check-ins to the collar-ingest Supabase Edge Function over WiFi.

Fixes that fail to send (no WiFi, backend unreachable) are appended to a local JSONL queue and
retried on the next tick, so a walk out of WiFi range arrives late instead of never. The queue
holds only the position fields: the device secret is added when a request is sent, so the file
on disk never contains it. Check-ins are not queued; a stale "I was online" is worth nothing.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

from .gps_reader import Fix, GPSStatus

logger = logging.getLogger(__name__)


class WiFiUplink:
    def __init__(
        self,
        ingest_url: str,
        device_id: str,
        device_secret: str,
        supabase_anon_key: str,
        queue_path: Path,
        battery_pct_provider: Optional[Callable[[], Optional[int]]] = None,
        timeout_seconds: float = 5.0,
        post: Callable[..., requests.Response] = requests.post,
    ):
        self._ingest_url = ingest_url
        self._device_id = device_id
        self._device_secret = device_secret
        self._anon_key = supabase_anon_key
        self._queue_path = queue_path
        self._battery_pct_provider = battery_pct_provider
        self._timeout = timeout_seconds
        self._post_impl = post
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)

    def send(self, fix: Fix) -> None:
        """Sends one fix, queueing it locally on any failure."""
        self._flush_queue()
        body = self._fix_body(fix)
        if self._post(body):
            return
        self._enqueue(body)

    def checkin(self, status: GPSStatus) -> bool:
        """Tells the backend the collar is online without a fix. Not queued on failure."""
        return self._post(
            {"type": "checkin", "satellites_in_view": status.satellites_in_view, "gps_locked": status.locked}
        )

    def _flush_queue(self) -> None:
        if not self._queue_path.exists() or self._queue_path.stat().st_size == 0:
            return
        remaining = []
        for line in self._queue_path.read_text().splitlines():
            if not line.strip():
                continue
            if not self._post(json.loads(line)):
                remaining.append(line)
        self._queue_path.write_text("\n".join(remaining) + ("\n" if remaining else ""))
        if remaining:
            logger.info("%d queued fix(es) still pending", len(remaining))

    def _post(self, body: dict) -> bool:
        payload = {"device_id": self._device_id, "device_secret": self._device_secret, **body}
        try:
            response = self._post_impl(
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
            logger.warning("Ingest rejected message: %s %s", response.status_code, response.text)
            return False
        except requests.RequestException as exc:
            logger.info("Ingest unreachable: %s", exc)
            return False

    def _enqueue(self, body: dict) -> None:
        with self._queue_path.open("a") as f:
            f.write(json.dumps(body) + "\n")

    def _fix_body(self, fix: Fix) -> dict:
        battery_pct: Optional[int] = self._battery_pct_provider() if self._battery_pct_provider else None
        return {
            "lat": fix.lat,
            "lng": fix.lng,
            "speed_kmh": round(fix.speed_kmh, 1),
            "battery_pct": battery_pct,
            "satellites": fix.satellites,
            "recorded_at": datetime.fromtimestamp(fix.fix_time, tz=timezone.utc).isoformat(),
        }
