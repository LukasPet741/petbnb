from collar.gps_reader import GPSReader, GPSStatus
from tests.nmea import (
    GGA_FIX, GGA_NO_FIX, GSV_SEVEN, GSV_THREE, RMC_ACTIVE, RMC_VOID, FakeSource,
)


def reader(*lines: bytes) -> GPSReader:
    return GPSReader(source=FakeSource(list(lines)))


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
