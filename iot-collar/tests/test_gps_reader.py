import time
from datetime import datetime, timezone

from collar.gps_reader import GPSReader, GPSStatus
from tests.nmea import (
    GGA_FIX, GGA_NO_FIX, GSV_SEVEN, GSV_THREE, RMC_ACTIVE, RMC_VOID, FakeSource, LiveSource, sentence,
)


def reader(*lines: bytes) -> GPSReader:
    return GPSReader(source=FakeSource(list(lines)))


class CountingSource(FakeSource):
    def __init__(self, lines: list[bytes]):
        super().__init__(lines)
        self.reads = 0

    def readline(self) -> bytes:
        self.reads += 1
        return super().readline()


def test_a_silent_gps_gives_up_at_the_first_timeout():
    # On the real Pi (2026-09-28) a silent module made every read wait out its 2 s timeout, 50 times:
    # each tick took 100 s, so check-ins came 100 s apart and the site showed the collar offline.
    source = CountingSource([])
    assert GPSReader(source=source).read_fix() is None
    assert source.reads == 1


def test_returns_a_fix_from_gga_with_its_satellite_count():
    gps = reader(GSV_SEVEN, GGA_FIX)
    fix = gps.read_fix(max_attempts=5)
    assert fix is not None
    assert round(fix.lat, 4) == 54.6833
    assert round(fix.lng, 4) == 25.2333
    assert fix.satellites == 7
    assert gps.status() == GPSStatus(locked=True, satellites_in_view=7)


def test_rmc_speed_is_converted_from_knots_to_kmh():
    fix = reader(RMC_ACTIVE).read_fix(max_attempts=3)
    assert fix is not None
    assert round(fix.speed_kmh, 2) == 4.26


def test_never_returns_a_stale_fix():
    # v5 returned the previous fix when no new one arrived, so a collar that lost lock kept
    # re-sending its last position every tick.
    gps = reader(GGA_FIX, GGA_NO_FIX, GGA_NO_FIX, GGA_NO_FIX)
    assert gps.read_fix(max_attempts=1) is not None
    assert gps.read_fix(max_attempts=3) is None
    assert gps.status().locked is False


def test_counts_satellites_in_view_without_a_fix():
    gps = reader(GSV_THREE, GGA_NO_FIX, RMC_VOID)
    assert gps.read_fix(max_attempts=3) is None
    assert gps.status() == GPSStatus(locked=False, satellites_in_view=3)


def test_ignores_garbage_and_bad_checksums():
    gps = reader(b"garbage\r\n", b"$GPGGA,1,2,3*00\r\n", b"")
    assert gps.read_fix(max_attempts=3) is None


def test_close_closes_the_source():
    source = FakeSource([])
    GPSReader(source=source).close()
    assert source.closed is True


def test_reads_the_newest_fix_not_the_serial_backlog():
    # The module sends ~7 lines a second whether anyone reads or not; the collar reads every 15 s.
    # Taking the oldest buffered line reported where the dog was minutes ago (review C1, 2026-09-26).
    source = LiveSource()
    gps = GPSReader(source=source)
    for _ in range(20):  # five minutes of 15-second ticks
        source.advance(15)
        fix = gps.read_fix()
        assert fix is not None
        assert source.elapsed - LiveSource.second_of(fix.lat) <= 2


def test_stamps_a_fix_with_gps_time_not_the_pi_clock():
    # The Pi has no clock battery: after days switched off it boots with a stale time until NTP
    # answers, and the ingest refuses positions more than 7 days old.
    fix = reader(RMC_ACTIVE).read_fix(max_attempts=3)
    assert fix is not None
    assert fix.fix_time == datetime(2026, 9, 26, 12, 35, 19, tzinfo=timezone.utc).timestamp()


def test_a_gga_fix_takes_its_date_from_the_last_rmc():
    # RMC_VOID has no position, but it does carry the date.
    fix = reader(RMC_VOID, GGA_FIX).read_fix(max_attempts=2)
    assert fix is not None
    assert fix.fix_time == datetime(2026, 9, 26, 12, 35, 19, tzinfo=timezone.utc).timestamp()


def test_a_gga_fix_just_after_midnight_does_not_jump_back_a_day():
    late = sentence("GPRMC,235959,V,,,,,,,260926,,")
    early_gga = sentence("GPGGA,000001,5441.000,N,02514.000,E,1,07,0.9,120.0,M,26.0,M,,")
    fix = reader(late, early_gga).read_fix(max_attempts=2)
    assert fix is not None
    assert fix.fix_time == datetime(2026, 9, 27, 0, 0, 1, tzinfo=timezone.utc).timestamp()


def test_a_gga_fix_without_any_date_falls_back_to_the_pi_clock():
    before = time.time()
    fix = reader(GGA_FIX).read_fix(max_attempts=1)
    assert fix is not None
    assert before - 1 <= fix.fix_time <= time.time() + 1
