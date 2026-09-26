"""One tick of the collar: a fresh fix goes out as a position, otherwise as a check-in.

Kept apart from main.py so it can be tested without bluezero (Linux-only) or a serial port.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("collar.loop")


def tick(gps, uplink, ble=None) -> None:
    fix = gps.read_fix()
    if fix is None:
        status = gps.status()
        logger.info("No GPS fix: %d satellite(s) in view", status.satellites_in_view)
        uplink.checkin(status)
        return
    logger.info("Fix: %.6f, %.6f @ %.1f km/h, %d satellites", fix.lat, fix.lng, fix.speed_kmh, fix.satellites)
    if ble is not None:
        ble.update_fix(fix)
    uplink.send(fix)
