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
                                        (verifies device secret, resolves owner_id)
                                                            │
                                                            ▼
                                        collar_locations table (RLS: owner can SELECT)
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

## Flashing & first boot (headless, no monitor needed)

1. Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager — Lite
   has no desktop GUI, which is what you want for a headless, battery-powered
   device. In Imager, click the gear icon (Ctrl+Shift+X) **before** writing
   and set: hostname (e.g. `petbnb-collar`), enable SSH (password or your
   public key), username/password, and your WiFi SSID/password/country. This
   avoids ever needing a monitor or keyboard on the Pi itself.
2. Boot the Pi, then from your laptop:
   ```bash
   ssh <your-username>@petbnb-collar.local
   ```
   (If `.local` mDNS resolution doesn't work, find its IP in your router's
   DHCP client list instead.)
3. Update the OS:
   ```bash
   sudo apt update && sudo apt full-upgrade -y && sudo reboot
   ```

Whichever username you chose at flash time, use it everywhere below instead
of `pi` (Raspberry Pi Imager no longer defaults to a `pi` user — you set your
own). Adjust `systemd/petbnb-collar.service`'s `User=`/`WorkingDirectory=`
to match.

## Wiring the GPS module + freeing a UART for it

Pi models with built-in Bluetooth (all of Zero 2 W / 3 / 4) have a conflict:
by default Bluetooth gets the good hardware UART and GPIO14/15 only gets the
"mini UART", which is unreliable for GPS because its baud rate drifts with
CPU clock speed. Swap that around so the GPS gets the good UART instead:

1. `sudo raspi-config` → **Interface Options → Serial Port** → "login shell
   over serial?" **No**, "serial port hardware enabled?" **Yes**.
2. Edit `/boot/firmware/config.txt` (that's the path on Bookworm; older OS
   images use `/boot/config.txt`) and add:
   ```
   enable_uart=1
   dtoverlay=miniuart-bt
   ```
   This moves Bluetooth onto the mini-UART (fine for BLE) and gives
   `/dev/serial0` the full hardware UART (`ttyAMA0`) for the GPS.
3. `sudo reboot`, then confirm: `ls -l /dev/serial0` should point at
   `ttyAMA0`, not `ttyS0`.

Now wire the module to the 40-pin header:
- GPS `VCC` → Pi pin 1 (**3.3V** — check your module's datasheet; most
  common NEO-6M breakouts run fine on 3.3V and this keeps logic levels safe)
- GPS `GND` → Pi pin 6 (or any GND pin)
- GPS `TX` → Pi pin 10 (`GPIO15`/RXD — the Pi receives from the GPS here)
- GPS `RX` → Pi pin 8 (`GPIO14`/TXD — optional, only needed to configure the module)

Give it a clear view of the sky (a window ledge is enough for testing) —
cold-start satellite lock can take 30–90 seconds and won't happen indoors
away from windows at all. Sanity-check the wiring before trusting any Python:
```bash
cat /dev/serial0
```
You should see scrolling `$GPGGA`/`$GPRMC` text. Nothing at all means check
the wiring or the `dtoverlay`/raspi-config steps above; `Ctrl+C` to stop.

## Setup on the Pi

The project isn't pushed to GitHub yet, so copy the `iot-collar/` folder over
from your laptop instead of cloning (run this from your laptop, not the Pi):
```bash
scp -r iot-collar <your-username>@petbnb-collar.local:~/petbnb-collar
```

Then, on the Pi:
```bash
cd ~/petbnb-collar
sudo apt install -y python3-venv python3-dev python3-dbus python3-gi libdbus-1-dev libglib2.0-dev pkg-config build-essential
python3 -m venv venv --system-site-packages
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in DEVICE_ID, DEVICE_SECRET, SUPABASE_ANON_KEY
```
`python3-dbus`/`python3-gi` are apt packages, not pip ones — their native
extensions are already compiled for ARM there, so `--system-site-packages`
lets the venv reuse them instead of pip trying (and often failing) to build
`dbus-python` from source. The `libdbus-1-dev`/`libglib2.0-dev` headers are a
fallback in case pip still wants to compile something.

Bluetooth peripheral mode (`bluezero`) needs BlueZ's experimental features
and your user in the `bluetooth` group:
```bash
sudo usermod -aG bluetooth $USER
sudo systemctl edit bluetooth.service
```
That opens an editor for an override file — add exactly this (the blank
`ExecStart=` first is required, it clears the default before setting a new one):
```
[Service]
ExecStart=
ExecStart=/usr/lib/bluetooth/bluetoothd --experimental
```
Save and exit, then:
```bash
sudo systemctl daemon-reload && sudo systemctl restart bluetooth
```
Log out and back in (or reboot) after `usermod` for the group change to apply.

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

Run it in the foreground first so you can see what's happening before trusting
it to a systemd service:
```bash
python -m collar.main
```
You should see log lines like `Fix: 54.898500, 23.903600 @ 0.0 km/h` once the
GPS gets a lock, `BLE peripheral advertising as GATT service …`, and either
silence (uplink succeeded) or a warning + queued-fix message if WiFi/the
backend is unreachable. To confirm BLE is actually visible, scan for it from
a phone with a generic BLE scanner app (e.g. **nRF Connect** on Android/iOS)
— you should see a device named "PetBnB Collar" advertising. To confirm the
WiFi leg, check **Profile → My collars** on the site after a fix logs — the
marker should update within `FIX_INTERVAL_SECONDS`.

Once that all looks right, `Ctrl+C` it and install it as a systemd service
for headless boot-time start:
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
