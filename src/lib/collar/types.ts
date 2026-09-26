/** Shapes the collar feature passes around; rows come from collar_devices and collar_locations. */

export interface CollarDevice {
  id: string;
  label: string | null;
  is_demo: boolean;
  claimed_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  gps_locked: boolean | null;
  gps_satellites: number | null;
}

export type PositionSource = "collar" | "replay";

export interface CollarPosition {
  device_id: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  recorded_at: string;
  source: PositionSource;
}

export type CollarState = "no_collar" | "replaying" | "demo_idle" | "live" | "searching" | "waiting" | "offline";
