import json
from pathlib import Path

from collar.gps_reader import Fix, GPSStatus
from collar.loop import tick
from collar.wifi_uplink import WiFiUplink


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = ""


class FakePost:
    """Records every POST; answers with the queued status codes (default 201)."""

    def __init__(self, *codes: int):
        self.codes = list(codes)
        self.calls: list[dict] = []

    def __call__(self, url, json=None, headers=None, timeout=None):
        self.calls.append(json)
        return FakeResponse(self.codes.pop(0) if self.codes else 201)


FIX = Fix(lat=54.6833, lng=25.2333, speed_kmh=4.2, satellites=7, fix_time=1_790_400_000.0)


def uplink(tmp_path: Path, post: FakePost) -> WiFiUplink:
    return WiFiUplink(
        ingest_url="https://example.test/collar-ingest",
        device_id="dev-1",
        device_secret="s3cret",
        supabase_anon_key="anon",
        queue_path=tmp_path / "queue.jsonl",
        post=post,
    )


def test_a_position_carries_its_satellites_and_the_credentials(tmp_path):
    post = FakePost(201)
    uplink(tmp_path, post).send(FIX)
    body = post.calls[0]
    assert body["device_id"] == "dev-1" and body["device_secret"] == "s3cret"
    assert body["lat"] == 54.6833 and body["satellites"] == 7
    assert "type" not in body


def test_queue_never_stores_the_secret(tmp_path):
    post = FakePost(503)
    up = uplink(tmp_path, post)
    up.send(FIX)
    queued = (tmp_path / "queue.jsonl").read_text()
    assert "s3cret" not in queued
    assert json.loads(queued.splitlines()[0])["lat"] == 54.6833


def test_a_queued_position_is_sent_with_credentials_once_back_online(tmp_path):
    post = FakePost(503, 201, 201)
    up = uplink(tmp_path, post)
    up.send(FIX)  # fails, queued
    up.send(FIX)  # flushes the queue first, then sends
    assert post.calls[1]["device_secret"] == "s3cret"
    assert (tmp_path / "queue.jsonl").read_text() == ""


def test_a_checkin_is_sent_but_never_queued(tmp_path):
    post = FakePost(503)
    up = uplink(tmp_path, post)
    assert up.checkin(GPSStatus(locked=False, satellites_in_view=3)) is False
    assert post.calls[0] == {
        "device_id": "dev-1",
        "device_secret": "s3cret",
        "type": "checkin",
        "satellites_in_view": 3,
        "gps_locked": False,
    }
    assert not (tmp_path / "queue.jsonl").exists() or (tmp_path / "queue.jsonl").read_text() == ""


class FakeGPS:
    def __init__(self, fix, status):
        self._fix, self._status = fix, status

    def read_fix(self):
        return self._fix

    def status(self):
        return self._status


class FakeUplink:
    def __init__(self):
        self.sent, self.checkins = [], []

    def send(self, fix):
        self.sent.append(fix)

    def checkin(self, status):
        self.checkins.append(status)
        return True


class FakeBLE:
    def __init__(self):
        self.fixes = []

    def update_fix(self, fix):
        self.fixes.append(fix)


def test_tick_with_a_fix_sends_it_and_updates_ble():
    up, ble = FakeUplink(), FakeBLE()
    tick(FakeGPS(FIX, GPSStatus(True, 7)), up, ble)
    assert up.sent == [FIX] and up.checkins == [] and ble.fixes == [FIX]


def test_tick_without_fix_sends_a_checkin():
    up = FakeUplink()
    tick(FakeGPS(None, GPSStatus(False, 2)), up, None)
    assert up.sent == [] and up.checkins == [GPSStatus(False, 2)]
