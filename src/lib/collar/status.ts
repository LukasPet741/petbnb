import type { CollarDevice, CollarPosition, CollarState } from "./types";

/**
 * The one rule that decides what a collar is doing (spec "Status rule"). Every screen — sidebar
 * card, phone button, /collar, the pairing checklist — asks this, so they never disagree.
 */

export const LIVE_MAX_AGE_MS = 45_000; // three missed 15 s ticks
export const SEEN_MAX_AGE_MS = 90_000;
export const REPLAY_MAX_AGE_MS = 10_000; // replayed points arrive every 2 s
export const CHECKIN_TIMEOUT_MS = 90_000;

export interface StatusInput {
  device: CollarDevice | null;
  latest: CollarPosition | null;
  latestReal: CollarPosition | null;
  replayingHere: boolean;
  now: number;
}

const age = (iso: string | null | undefined, now: number) => (iso ? now - Date.parse(iso) : Infinity);

/** Collars paired before claim codes existed have no claimed_at; their row's birth is the pairing. */
export function pairedAt(device: CollarDevice): string {
  return device.claimed_at ?? device.created_at;
}

export function msSincePaired(device: CollarDevice, now: number): number {
  return now - Date.parse(pairedAt(device));
}

export function isOnline(device: CollarDevice, now: number): boolean {
  return age(device.last_seen_at, now) <= SEEN_MAX_AGE_MS;
}

export function collarState({ device, latest, latestReal, replayingHere, now }: StatusInput): CollarState {
  if (!device) return "no_collar";
  if (replayingHere || (latest?.source === "replay" && age(latest.recorded_at, now) <= REPLAY_MAX_AGE_MS)) {
    return "replaying";
  }
  if (device.is_demo) return "demo_idle";
  if (latestReal && age(latestReal.recorded_at, now) <= LIVE_MAX_AGE_MS) return "live";
  if (isOnline(device, now)) return "searching";
  if (!device.last_seen_at || Date.parse(device.last_seen_at) < Date.parse(pairedAt(device))) return "waiting";
  return "offline";
}

/**
 * The position to show for a collar: a replay's point only while it plays (and always for the demo
 * collar, whose every point is a replay); otherwise the collar's own last fix, or none. After a
 * replay on a real collar its last point is not where the collar is (review I2, 2026-09-26).
 */
export function shownPosition(
  state: CollarState,
  device: CollarDevice | null,
  latest: CollarPosition | null,
  latestReal: CollarPosition | null,
): CollarPosition | null {
  return state === "replaying" || device?.is_demo ? latest : latestReal;
}
