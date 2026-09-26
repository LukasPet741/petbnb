"""Builds NMEA lines with correct checksums, and a fake serial port that plays them back."""
from __future__ import annotations


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
