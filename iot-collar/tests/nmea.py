"""Builds NMEA lines with correct checksums, and a fake serial port that plays them back."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def sentence(body: str) -> bytes:
    """'GPGGA,…' -> b'$GPGGA,…*hh\\r\\n' with the XOR checksum a real module sends."""
    checksum = 0
    for char in body:
        checksum ^= ord(char)
    return f"${body}*{checksum:02X}\r\n".encode("ascii")


# 54°41.000' N, 25°14.000' E — Vingis Park, Vilnius.
GGA_FIX = sentence("GPGGA,123519,5441.000,N,02514.000,E,1,07,0.9,120.0,M,26.0,M,,")
GGA_NO_FIX = sentence("GPGGA,123520,,,,,0,00,,,M,,M,,")
RMC_ACTIVE = sentence("GPRMC,123519,A,5441.000,N,02514.000,E,2.3,054.7,260926,,")
RMC_VOID = sentence("GPRMC,123520,V,,,,,,,260926,,")
GSV_SEVEN = sentence("GPGSV,2,1,07,01,40,083,46,02,17,308,41,12,07,344,39,14,22,228,45")
GSV_THREE = sentence("GPGSV,1,1,03,01,40,083,46,02,17,308,41,12,07,344,39")


class FakeSource:
    """Stands in for serial.Serial: readline() returns the next line, then b'' like a timeout."""

    def __init__(self, lines: list[bytes]):
        self._lines = list(lines)
        self.closed = False

    def readline(self) -> bytes:
        return self._lines.pop(0) if self._lines else b""

    def close(self) -> None:
        self.closed = True


def _minutes(value: float) -> str:
    """41.0 -> '41.000': the minutes part of an NMEA ddmm.mmm coordinate."""
    return f"{value:06.3f}"


class LiveSource:
    """A GPS module that keeps talking whether or not anyone reads, like the real NEO-6M: every
    simulated second it appends that second's 7 sentences to a buffer (the kernel's serial buffer),
    and readline() hands out the OLDEST line first. reset_input_buffer() drops the backlog, as
    pyserial's does. The latitude creeps north 0.001' a second, so a fix tells which second it is from.
    """

    START = datetime(2026, 9, 26, 12, 0, 0, tzinfo=timezone.utc)

    def __init__(self) -> None:
        self.elapsed = 0
        self._buffer: list[bytes] = []
        self.closed = False

    @property
    def now(self) -> datetime:
        return self.START + timedelta(seconds=self.elapsed)

    @staticmethod
    def second_of(lat: float) -> int:
        return round(((lat - 54) * 60 - 41) / 0.001)

    def advance(self, seconds: int) -> None:
        for _ in range(seconds):
            self.elapsed += 1
            t, north = self.now, _minutes(41 + self.elapsed * 0.001)
            self._buffer += [
                sentence(f"GPRMC,{t:%H%M%S},A,54{north},N,02514.000,E,2.3,054.7,{t:%d%m%y},,"),
                sentence("GPVTG,054.7,T,034.4,M,2.3,N,4.3,K"),
                sentence(f"GPGGA,{t:%H%M%S},54{north},N,02514.000,E,1,07,0.9,120.0,M,26.0,M,,"),
                sentence("GPGSA,A,3,01,02,12,14,,,,,,,,,1.5,0.9,1.2"),
                GSV_SEVEN,
                GSV_SEVEN,
                sentence(f"GPGLL,54{north},N,02514.000,E,{t:%H%M%S},A"),
            ]

    def readline(self) -> bytes:
        if not self._buffer:
            self.advance(1)  # a blocking read waits for the module's next second
        return self._buffer.pop(0)

    def reset_input_buffer(self) -> None:
        self._buffer.clear()

    def close(self) -> None:
        self.closed = True
