"""Collar entry point: reads GPS, serves it over BLE, and reports to PetBnB over WiFi.

Run directly for testing (`python -m collar.main`) or via the systemd unit in
../systemd/petbnb-collar.service for headless boot-time start on the Pi.

Every FIX_INTERVAL_SECONDS the collar sends either a position or, without a fix, a check-in
("online, N satellites in view") — indoors the GPS may never lock, and the site should say so
rather than go quiet.
"""
from __future__ import annotations

import logging
import time

from .config import load_config
from .gps_reader import GPSReader
from .loop import tick
from .wifi_uplink import WiFiUplink

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("collar.main")


def read_battery_pct() -> int | None:
    """Placeholder for a fuel-gauge read (e.g. an I2C MAX17048 HAT). None: no gauge is fitted."""
    return None


def run() -> None:
    config = load_config()

    gps = GPSReader(config.gps_serial_port, config.gps_baud_rate)
    uplink = WiFiUplink(
        ingest_url=config.ingest_url,
        device_id=config.device_id,
        device_secret=config.device_secret,
        supabase_anon_key=config.supabase_anon_key,
        queue_path=config.offline_queue_path,
        battery_pct_provider=read_battery_pct,
    )

    # BLE is a nice-to-have; a Pi without Bluetooth set up still tracks over WiFi. Imported here so
    # the rest of the package stays importable where bluezero is not installed.
    ble = None
    try:
        from .ble_service import BLELocationService

        ble = BLELocationService()
        ble.start()
    except Exception:
        logger.warning("BLE unavailable, continuing without it", exc_info=True)

    logger.info("Collar running, reporting every %ss", config.fix_interval_seconds)

    try:
        while True:
            started = time.monotonic()
            tick(gps, uplink, ble)
            elapsed = time.monotonic() - started
            time.sleep(max(0.0, config.fix_interval_seconds - elapsed))
    except KeyboardInterrupt:
        pass
    finally:
        gps.close()


if __name__ == "__main__":
    run()
