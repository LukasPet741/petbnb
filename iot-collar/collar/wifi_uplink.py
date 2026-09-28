"""Posts GPS fixes and no-fix check-ins to the collar-ingest Supabase Edge Function over WiFi.

Fixes that fail to send (no WiFi, backend unreachable) are appended to a local JSONL queue and
retried on the next tick, so a walk out of WiFi range arrives late instead of never. The queue
holds only the position fields: the device secret is added when a request is sent, so the file
on disk never contains it. Check-ins are not queued; a stale "I was online" is worth nothing.

Only failures that can succeed later are retried: no network, a 5xx, 408 or 429. Any other 4xx
(a refused position, an unknown device) is logged and dropped: retrying it every tick used to
grow the queue forever and burn Edge Function calls (review I1, 2026-09-26). A queued line that
is not a JSON object (power cut mid-write) is dropped, and the credentials always come from this
collar's .env, never from a queued line (review M7).
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

from .gps_reader import Fix, GPSStatus

logger = logging.getLogger(__name__)

MAX_QUEUED_FIXES = 2880  # 12 hours at one fix per 15 s; the oldest are dropped first

_SENT, _RETRY, _REFUSED = "sent", "retry", "refused"


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
        """Sends one fix after any queued ones; queues it if it can succeed later."""
        body = self._fix_body(fix)
        if not self._flush_queue():
            self._enqueue(body)  # still offline: don't wait for another timeout
            return
        if self._post(body) == _RETRY:
            self._enqueue(body)

    def checkin(self, status: GPSStatus) -> bool:
        """Tells the backend the collar is online without a fix. Not queued on failure."""
        return self._post(
            {"type": "checkin", "satellites_in_view": status.satellites_in_view, "gps_locked": status.locked}
        ) == _SENT

    def _flush_queue(self) -> bool:
        """Sends queued fixes, oldest first. False if it stopped on a failure worth retrying."""
        lines = self._queued_lines()
        for index, line in enumerate(lines):
            body = _parse(line)
            if body is None:
                logger.warning("Dropping a corrupt queued fix: %r", line[:80])
                continue
            if self._post(body) == _RETRY:
                self._write_queue(lines[index:])
                logger.info("%d queued fix(es) still pending", len(lines) - index)
                return False
        if lines:
            self._write_queue([])
        return True

    def _post(self, body: dict) -> str:
        payload = {**body, "device_id": self._device_id, "device_secret": self._device_secret}
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
                return _SENT
            if response.status_code in (408, 429) or response.status_code >= 500:
                logger.warning("Ingest failed, will retry: %s %s", response.status_code, response.text)
                return _RETRY
            logger.error("Ingest refused message, dropping it: %s %s", response.status_code, response.text)
            return _REFUSED
        except requests.RequestException as exc:
            logger.info("Ingest unreachable: %s", exc)
            return _RETRY

    def _queued_lines(self) -> list[str]:
        if not self._queue_path.exists():
            return []
        return [line for line in self._queue_path.read_text().splitlines() if line.strip()]

    def _enqueue(self, body: dict) -> None:
        lines = self._queued_lines() + [json.dumps(body)]
        if len(lines) > MAX_QUEUED_FIXES:
            logger.warning("Offline queue full: dropping the %d oldest fix(es)", len(lines) - MAX_QUEUED_FIXES)
            lines = lines[-MAX_QUEUED_FIXES:]
        self._write_queue(lines)

    def _write_queue(self, lines: list[str]) -> None:
        # Written aside, then swapped in: pulling the power mid-write leaves the old file whole.
        temp = self._queue_path.with_suffix(".tmp")
        temp.write_text("".join(line + "\n" for line in lines))
        os.replace(temp, self._queue_path)

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


def _parse(line: str) -> Optional[dict]:
    try:
        body = json.loads(line)
    except ValueError:
        return None
    return body if isinstance(body, dict) else None
