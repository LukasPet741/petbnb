"""BLE GATT peripheral that broadcasts the collar's latest GPS fix to nearby phones.

This is the short-range leg of the collar: a companion phone app (or any BLE
central, e.g. `nRF Connect` for testing) can connect directly to the collar and
read/subscribe to its location without needing WiFi or the backend at all --
useful when the dog is nearby but off the home WiFi network.

Requires BlueZ running in peripheral mode on the Pi (`bluetoothd` with
experimental features, which `bluezero` configures for you).
"""
from __future__ import annotations

import json
import logging
import threading
from typing import Optional

from bluezero import adapter, peripheral

from .gps_reader import Fix

logger = logging.getLogger(__name__)

# Locally-generated random UUIDs -- unique to this project, not a standard BLE profile.
LOCATION_SERVICE_UUID = "7b1e8a10-2f4a-4d3e-9c3e-6f1a8b2e9a01"
LOCATION_CHAR_UUID = "7b1e8a11-2f4a-4d3e-9c3e-6f1a8b2e9a01"


class BLELocationService:
    """Owns a bluezero Peripheral advertising the current fix as a GATT characteristic."""

    def __init__(self, local_name: str = "PetBnB Collar"):
        self._latest_fix: Optional[Fix] = None
        self._thread: Optional[threading.Thread] = None

        adapter_address = list(adapter.Adapter.available())[0].address
        self._peripheral = peripheral.Peripheral(adapter_address, local_name=local_name)
        self._peripheral.add_service(srv_id=1, uuid=LOCATION_SERVICE_UUID, primary=True)
        self._peripheral.add_characteristic(
            srv_id=1,
            chr_id=1,
            uuid=LOCATION_CHAR_UUID,
            value=self._encode(None),
            notifying=False,
            flags=["read", "notify"],
            read_callback=self._on_read,
            notify_callback=self._on_notify_toggle,
        )

    def start(self) -> None:
        """Runs the peripheral's GLib event loop in a background thread (blocks otherwise)."""
        self._thread = threading.Thread(target=self._peripheral.publish, daemon=True)
        self._thread.start()
        logger.info("BLE peripheral advertising as GATT service %s", LOCATION_SERVICE_UUID)

    def update_fix(self, fix: Fix) -> None:
        self._latest_fix = fix
        characteristic = self._peripheral.characteristics[0]
        characteristic.set_value(self._encode(fix))

    def _on_read(self) -> list[int]:
        return self._encode(self._latest_fix)

    def _on_notify_toggle(self, notifying: bool, characteristic) -> None:
        logger.info("BLE central %s notifications", "subscribed to" if notifying else "unsubscribed from")

    @staticmethod
    def _encode(fix: Optional[Fix]) -> list[int]:
        payload = (
            {"lat": fix.lat, "lng": fix.lng, "speed_kmh": round(fix.speed_kmh, 1), "t": fix.fix_time}
            if fix
            else {}
        )
        return list(json.dumps(payload).encode("utf-8"))
