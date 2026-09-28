import json
from dataclasses import replace
from pathlib import Path

import requests

from collar.gps_reader import Fix, GPSStatus
from collar.loop import tick
from collar import wifi_uplink
from collar.wifi_uplink import WiFiUplink


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = ""


class FakePost:
    """Records every POST; answers with the queued status codes (default 201). None: no network."""

    def __init__(self, *codes: int):
        self.codes = list(codes)
        self.calls: list[dict] = []

    def __call__(self, url, json=None, headers=None, timeout=None):
        self.calls.append(json)
        code = self.codes.pop(0) if self.codes else 201
        if code is None:
            raise requests.ConnectionError("no route to host")
        return FakeResponse(code)


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


def queued(tmp_path: Path) -> list[dict]:
    path = tmp_path / "queue.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()] if path.exists() else []


def test_a_fix_the_server_refuses_is_dropped_not_queued(tmp_path):
    # A 4xx never succeeds on a retry; re-sending it every tick only burns Edge Function calls
    # (review I1, 2026-09-26: a wrong secret or a deleted collar grew the queue forever).
    for code in (400, 401):
        post = FakePost(code)
        uplink(tmp_path, post).send(FIX)
        assert queued(tmp_path) == []


def test_queued_fixes_the_server_refuses_are_dropped(tmp_path):
    post = FakePost(503, 401, 201)
    up = uplink(tmp_path, post)
    up.send(FIX)  # 503: queued
    up.send(FIX)  # the queued one is refused (401) and dropped; the new one is sent
    assert queued(tmp_path) == [] and len(post.calls) == 3


def test_server_errors_and_rate_limits_are_retried(tmp_path):
    for code in (500, 503, 429):
        (tmp_path / "queue.jsonl").unlink(missing_ok=True)
        uplink(tmp_path, FakePost(code)).send(FIX)
        assert len(queued(tmp_path)) == 1


def test_a_network_error_stops_the_flush_and_keeps_the_queue_in_order(tmp_path):
    # Offline, every queued fix would otherwise wait for its own timeout on every tick.
    lines = [json.dumps({"lat": 50 + i, "lng": 25.0}) for i in range(5)]
    (tmp_path / "queue.jsonl").write_text("".join(line + chr(10) for line in lines))
    post = FakePost(None, None)
    uplink(tmp_path, post).send(FIX)
    assert len(post.calls) == 1
    assert [q["lat"] for q in queued(tmp_path)] == [50, 51, 52, 53, 54, 54.6833]


def test_a_corrupt_queue_line_is_dropped_not_fatal(tmp_path):
    # Review M7: one half-written line raised on every tick, so the collar never sent again.
    (tmp_path / "queue.jsonl").write_text('{"lat": 50.0, "lng": 25.0' + chr(10) + json.dumps({"lat": 51.0, "lng": 25.0}) + chr(10))
    post = FakePost()
    uplink(tmp_path, post).send(FIX)
    assert [c["lat"] for c in post.calls] == [51.0, 54.6833]
    assert queued(tmp_path) == []


def test_an_old_queue_line_cannot_send_old_credentials(tmp_path):
    # Review M7: v5 queued the whole payload, credentials included, and the body overrode them.
    old = {"lat": 51.0, "lng": 25.0, "device_id": "old-dev", "device_secret": "old-secret"}
    (tmp_path / "queue.jsonl").write_text(json.dumps(old) + chr(10))
    post = FakePost()
    uplink(tmp_path, post).send(FIX)
    assert all(c["device_id"] == "dev-1" and c["device_secret"] == "s3cret" for c in post.calls)


def test_the_queue_keeps_only_the_newest_fixes(tmp_path, monkeypatch):
    monkeypatch.setattr(wifi_uplink, "MAX_QUEUED_FIXES", 3)
    up = uplink(tmp_path, FakePost(*([None] * 10)))
    for i in range(5):
        up.send(replace(FIX, lat=50.0 + i))
    assert [q["lat"] for q in queued(tmp_path)] == [52.0, 53.0, 54.0]
