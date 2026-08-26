# PetBnB collar

GPS dog collar on a Raspberry Pi. Reads position from a serial GPS module,
serves the latest fix over Bluetooth Low Energy for nearby devices, and
uplinks it over WiFi to the PetBnB backend so it shows up on a map on the
owner's Profile page. This is the "kursinis" (IoT) side of the project; the
backend it talks to is the same Supabase project as the PetBnB website. A
collar belongs to a user account, not to a specific pet -- pairing a device
just needs a signed-in owner, no pet record involved.

## Architecture

```
NEO-6M GPS ──UART──▶ gps_reader.py ──▶ main.py ──┬─▶ ble_service.py  (BLE GATT, local pairing)
                                                   └─▶ wifi_uplink.py (HTTPS POST, remote tracking)
                                                            │
                                                            ▼
                                        Supabase Edge Function: collar-ingest
                                        (verifies device secret, resolves pet_id)
                                                            │
                                                            ▼
                                        pet_locations table (RLS: owner can SELECT)
```

The Pi never holds the Supabase service role key. It only knows its own
`DEVICE_ID` + `DEVICE_SECRET`, which `collar-ingest` checks against a bcrypt
hash in `collar_devices` before writing anything. If the physical collar is
lost, only that one device's secret is compromised — rotate it by deleting
the `collar_devices` row and re-provisioning.

`pet_locations`/`pets` referenced in earlier notes were renamed:
`collar_locations` rows key off `device_id`, and `collar_devices.owner_id`
points straight at the account (`profiles.id`), not a pet.

## Hardware

- Raspberry Pi (Zero 2 W / 3 / 4 — anything with WiFi + Bluetooth built in)
- GPS module with UART output (e.g. NEO-6M / NEO-M8N), wired to the Pi's
  serial pins (`TX`→`RX`, `RX`→`TX`, `VCC`, `GND`)
- Battery pack sized for the target runtime (duty-cycle via
  `FIX_INTERVAL_SECONDS` to stretch it)

On the Pi, free up the serial port for the GPS module first:
```bash
sudo raspi-config   # Interface Options -> Serial Port -> login shell: No, hardware: Yes
```

## Setup on the Pi

```bash
mkdir -p ~/petbnb-collar && cd ~/petbnb-collar
# copy this iot-collar/ directory here
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DEVICE_ID, DEVICE_SECRET, SUPABASE_ANON_KEY
```

Bluetooth peripheral mode (`bluezero`) needs BlueZ's experimental features
and the pi user in the `bluetooth` group:
```bash
sudo usermod -aG bluetooth $USER
sudo sed -i 's/ExecStart=\/usr\/lib\/bluetooth\/bluetoothd/ExecStart=\/usr\/lib\/bluetooth\/bluetoothd --experimental/' /etc/systemd/system/bluetooth.target.wants/bluetooth.service
sudo systemctl daemon-reload && sudo systemctl restart bluetooth
```

## Provisioning a collar (once per device)

Provisioning now happens in the app itself: sign in, go to **Profile → My
Collars → Add a collar**, give it a label, and the app calls the
`register_collar_device` RPC for you (`owner_id` is taken from your session,
never from client input) and shows you the generated device id + secret
**once**. Copy both into the Pi's `.env` as `DEVICE_ID` / `DEVICE_SECRET`.

The plaintext secret is never stored — only its bcrypt hash — so if you lose
it, delete that collar in the UI and add a new one.

(If you need to provision without the UI, the same RPC works from the SQL
editor: `select register_collar_device(p_secret := '<random string>', p_label := 'Rex''s collar');`
while signed in as that user.)

## Running it

```bash
python -m collar.main
```

For headless boot-time start, install the systemd unit:
```bash
sudo cp systemd/petbnb-collar.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now petbnb-collar
journalctl -u petbnb-collar -f   # tail logs
```

## Testing without a live GPS fix

`gps_reader.py` returns `None` until the module gets a satellite lock, which
can take up to a minute or two outdoors on cold start (and won't happen at
all indoors). For BLE/WiFi testing before the antenna sees sky, temporarily
hardcode a `Fix(...)` in `main.py`'s loop instead of waiting on `gps.read_fix()`.

## What's stubbed for now

- `read_battery_pct()` in `main.py` returns `None` — wire up a real fuel
  gauge (e.g. an I2C MAX17048 HAT) if you want battery telemetry in the
  report's test results.
