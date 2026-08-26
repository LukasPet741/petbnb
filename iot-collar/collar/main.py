"""Collar entry point: reads GPS, serves it over BLE, and uplinks it over WiFi.

Run directly for testing (`python -m collar.main`) or via the systemd unit in
../systemd/petbnb-collar.service for headless boot-time start on the Pi.

Duty-cycles on FIX_INTERVAL_SECONDS: the GPS module and radios draw the most
current of anything on the collar, so a longer interval trades location
freshness for battery life. 15s is a reasonable default for a walk; raise it
for long boarding stays where the dog is mostly stationary.
"""
from __future__ import annotations

import logging
import time

from .ble_service import BLELocationService
from .config import load_config
from .gps_reader import GPSReader
from .wifi_uplink import WiFiUplink

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("collar.main")


def read_battery_pct() -> int | None:
    """Placeholder for a fuel-gauge read (e.g. an I2C MAX17048 HAT).

    Returns None when no fuel gauge is wired up; the backend just stores null.
    """
    return None


def run() -> None:
    config = load_config()

    gps = GPSReader(config.gps_serial_port, config.gps_baud_rate)
    ble = BLELocationService()
    uplink = WiFiUplink(
        ingest_url=config.ingest_url,
        device_id=config.device_id,
        device_secret=config.device_secret,
        supabase_anon_key=config.supabase_anon_key,
        queue_path=config.offline_queue_path,
        battery_pct_provider=read_battery_pct,
    )

    ble.start()
    logger.info("Collar running, fix every %ss", config.fix_interval_seconds)

    try:
        while True:
            tick_started = time.monotonic()
            fix = gps.read_fix()
            if fix is None:
                logger.warning("No GPS fix yet (cold start can take up to a minute outdoors)")
            else:
                logger.info("Fix: %.6f, %.6f @ %.1f km/h", fix.lat, fix.lng, fix.speed_kmh)
                ble.update_fix(fix)
                uplink.send(fix)

            elapsed = time.monotonic() - tick_started
            time.sleep(max(0.0, config.fix_interval_seconds - elapsed))
    except KeyboardInterrupt:
        pass
    finally:
        gps.close()


if __name__ == "__main__":
    run()
