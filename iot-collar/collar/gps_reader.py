"""Reads NMEA sentences from a serial GPS module (e.g. NEO-6M): fixes, and satellites in view."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional, Protocol

import pynmea2

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Fix:
    lat: float
    lng: float
    speed_kmh: float
    satellites: int
    fix_time: float  # time.time() when the fix was read


@dataclass(frozen=True)
class GPSStatus:
    """What a check-in reports when there is no fix: indoors the module sees satellites but no lock."""

    locked: bool
    satellites_in_view: int


class LineSource(Protocol):
    def readline(self) -> bytes: ...

    def close(self) -> None: ...


class GPSReader:
    """Parses GGA (position + satellites used), RMC (position + speed) and GSV (satellites in view).

    read_fix() returns a fix only if one arrived during this call. It used to fall back to the last
    fix, which made a collar that lost lock re-send a stale position every tick.
    """

    def __init__(
        self,
        port: Optional[str] = None,
        baud_rate: int = 9600,
        timeout: float = 2.0,
        source: Optional[LineSource] = None,
    ):
        if source is None:
            import serial  # the real port; tests pass a FakeSource instead

            source = serial.Serial(port, baudrate=baud_rate, timeout=timeout)
        self._source = source
        self._speed_kmh = 0.0
        self._satellites_used = 0
        self._satellites_in_view = 0
        self._locked = False

    def close(self) -> None:
        self._source.close()

    def status(self) -> GPSStatus:
        return GPSStatus(locked=self._locked, satellites_in_view=self._satellites_in_view)

    def read_fix(self, max_attempts: int = 50) -> Optional[Fix]:
        """Reads up to max_attempts lines; returns the first fresh fix, or None."""
        for _ in range(max_attempts):
            line = self._read_line()
            if line is None:
                continue
            fix = self._parse_line(line)
            if fix is not None:
                return fix
        return None

    def _read_line(self) -> Optional[str]:
        try:
            raw = self._source.readline()
        except Exception as exc:  # serial.SerialException on the Pi; anything from a flaky port
            logger.warning("GPS serial read failed: %s", exc)
            return None
        if not raw:
            return None
        return raw.decode("ascii", errors="ignore").strip()

    def _parse_line(self, line: str) -> Optional[Fix]:
        if not line.startswith("$"):
            return None
        try:
            msg = pynmea2.parse(line)
        except pynmea2.ParseError:
            return None

        if isinstance(msg, pynmea2.types.talker.GSV):
            self._satellites_in_view = int(msg.num_sv_in_view or 0)
            return None

        if isinstance(msg, pynmea2.types.talker.GGA):
            if msg.gps_qual == 0 or msg.latitude == 0 or msg.longitude == 0:
                self._locked = False
                return None
            self._locked = True
            self._satellites_used = int(msg.num_sats or 0)
            self._satellites_in_view = max(self._satellites_in_view, self._satellites_used)
            return Fix(
                lat=msg.latitude,
                lng=msg.longitude,
                speed_kmh=self._speed_kmh,
                satellites=self._satellites_used,
                fix_time=time.time(),
            )

        if isinstance(msg, pynmea2.types.talker.RMC):
            if msg.status != "A" or msg.latitude == 0 or msg.longitude == 0:
                self._locked = False
                return None
            self._locked = True
            self._speed_kmh = float(msg.spd_over_grnd or 0.0) * 1.852  # knots -> km/h
            return Fix(
                lat=msg.latitude,
                lng=msg.longitude,
                speed_kmh=self._speed_kmh,
                satellites=self._satellites_used,
                fix_time=time.time(),
            )

        return None
