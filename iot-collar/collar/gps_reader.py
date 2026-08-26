"""Reads NMEA sentences from a serial GPS module (e.g. NEO-6M) and exposes the latest fix."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional

import pynmea2
import serial

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Fix:
    lat: float
    lng: float
    speed_kmh: float
    satellites: int
    fix_time: float  # time.time() when the fix was read


class GPSReader:
    """Wraps a serial connection to a GPS module and parses GGA/RMC sentences.

    A NEO-6M (or similar) module streams NMEA text lines continuously once powered.
    GGA gives position + satellite count; RMC gives position + ground speed. We keep
    the most recent fix from either sentence type.
    """

    def __init__(self, port: str, baud_rate: int, timeout: float = 2.0):
        self._serial = serial.Serial(port, baudrate=baud_rate, timeout=timeout)
        self._last_fix: Optional[Fix] = None

    def close(self) -> None:
        self._serial.close()

    def read_fix(self, max_attempts: int = 50) -> Optional[Fix]:
        """Reads lines until a fresh fix with a valid position is found, or gives up."""
        for _ in range(max_attempts):
            line = self._read_line()
            if line is None:
                continue
            fix = self._parse_line(line)
            if fix is not None:
                self._last_fix = fix
                return fix
        return self._last_fix

    def _read_line(self) -> Optional[str]:
        try:
            raw = self._serial.readline()
        except serial.SerialException as exc:
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

        if isinstance(msg, pynmea2.types.talker.GGA):
            if msg.gps_qual == 0 or msg.latitude == 0 or msg.longitude == 0:
                return None
            speed = self._last_fix.speed_kmh if self._last_fix else 0.0
            return Fix(
                lat=msg.latitude,
                lng=msg.longitude,
                speed_kmh=speed,
                satellites=int(msg.num_sats or 0),
                fix_time=time.time(),
            )

        if isinstance(msg, pynmea2.types.talker.RMC):
            if msg.status != "A" or msg.latitude == 0 or msg.longitude == 0:
                return None
            satellites = self._last_fix.satellites if self._last_fix else 0
            return Fix(
                lat=msg.latitude,
                lng=msg.longitude,
                speed_kmh=float(msg.spd_over_grnd or 0.0) * 1.852,  # knots -> km/h
                satellites=satellites,
                fix_time=time.time(),
            )

        return None
