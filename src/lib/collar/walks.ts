import { supabase } from "@/lib/supabase";
import { routeStats } from "./stats";
import { LIVE_MAX_AGE_MS, SEEN_MAX_AGE_MS } from "./status";

/**
 * Collar walks (spec 2026-10-22-collar-walks-design): Start and Stop mark a stretch of a collar's
 * fixes. Everything goes through the walk functions in the database, which also close a walk
 * nobody stopped, so these numbers only decide what a screen offers; the database decides.
 */

export const WALK_MAX_MS = 2 * 60 * 60_000;
export const WALK_SILENCE_MS = 10 * 60_000;
export const WALK_EARLY_START_MS = 60 * 60_000;
export const WALK_SERVICES = ["walking", "boarding", "daycare"] as const;
export const WALK_POLL_MS = 5000;
export const WALK_REPLAY_MS = 400;

export type WalkEndReason = "stopped" | "time_limit" | "no_signal";
export type WalkLiveState = "live" | "searching" | "offline" | "ended";
export type WalkErrorKey = "walk_running" | "not_allowed" | "failed";

export interface WalkPoint {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  recorded_at: string;
}

export interface CollarWalk {
  id: string;
  device_id: string;
  booking_id: string | null;
  walker_id: string | null;
  walker_name: string | null;
  walked_by_me: boolean;
  started_at: string;
  ended_at: string | null;
  end_reason: WalkEndReason | null;
  points: WalkPoint[];
}

export interface WalkCollarStatus {
  label: string | null;
  last_seen_at: string | null;
  gps_locked: boolean | null;
  gps_satellites: number | null;
}

export interface WalkDetail {
  walk: CollarWalk;
  /** Null for a sitter once the walk has ended. */
  collar: WalkCollarStatus | null;
  pet_name: string | null;
  is_owner: boolean;
  can_stop: boolean;
}

export interface DeviceWalks {
  running: CollarWalk | null;
  recent: CollarWalk[];
}

export interface BookingWalks {
  /** The owner's real collars, only while a walk may start on this booking. */
  collars: { id: string; label: string | null }[];
  running: CollarWalk | null;
  recent: CollarWalk[];
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function parsePoint(raw: Raw): WalkPoint {
  return {
    lat: Number(raw.lat),
    lng: Number(raw.lng),
    speed_kmh: raw.speed_kmh == null ? null : Number(raw.speed_kmh),
    recorded_at: String(raw.recorded_at),
  };
}

export function parseWalk(raw: unknown): CollarWalk {
  const row = (raw ?? {}) as Raw;
  return {
    id: String(row.id),
    device_id: String(row.device_id),
    booking_id: str(row.booking_id),
    walker_id: str(row.walker_id),
    walker_name: str(row.walker_name),
    walked_by_me: row.walked_by_me === true,
    started_at: String(row.started_at),
    ended_at: str(row.ended_at),
    end_reason: str(row.end_reason) as WalkEndReason | null,
    points: Array.isArray(row.points) ? (row.points as Raw[]).map(parsePoint) : [],
  };
}

const parseList = (raw: unknown): CollarWalk[] => (Array.isArray(raw) ? raw.map(parseWalk) : []);
const parseMaybe = (raw: unknown): CollarWalk | null => (raw ? parseWalk(raw) : null);

/** Distance along the fixes; time from Start to the end, or to now while it runs. */
export function walkStats(walk: Pick<CollarWalk, "points" | "started_at" | "ended_at">, now: number): { distanceKm: number; durationMin: number } {
  const end = walk.ended_at ? Date.parse(walk.ended_at) : now;
  return {
    distanceKm: routeStats(walk.points)?.distanceKm ?? 0,
    durationMin: Math.max(0, (end - Date.parse(walk.started_at)) / 60_000),
  };
}

/** The sitter's Start window, as start_collar_walk checks it. */
export function bookingAllowsWalk(
  b: { status: string; service: string; start_at: string; end_at: string },
  now: number,
): boolean {
  return b.status === "signed"
    && (WALK_SERVICES as readonly string[]).includes(b.service)
    && now >= Date.parse(b.start_at) - WALK_EARLY_START_MS
    && now < Date.parse(b.end_at);
}

/** The same thresholds as the collar's own status rule (lib/collar/status). */
export function walkLiveState(detail: WalkDetail, now: number): WalkLiveState {
  if (detail.walk.ended_at) return "ended";
  const last = detail.walk.points[detail.walk.points.length - 1];
  if (last && now - Date.parse(last.recorded_at) <= LIVE_MAX_AGE_MS) return "live";
  const seen = detail.collar?.last_seen_at;
  if (seen && now - Date.parse(seen) <= SEEN_MAX_AGE_MS) return "searching";
  return "offline";
}

export function walkErrorKey(error: unknown): WalkErrorKey {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("walk_running")) return "walk_running";
  if (message.includes("not_allowed")) return "not_allowed";
  return "failed";
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function startWalk(deviceId: string, bookingId: string | null = null): Promise<string> {
  const { data, error } = await supabase.rpc(
    "start_collar_walk",
    bookingId ? { p_device_id: deviceId, p_booking_id: bookingId } : { p_device_id: deviceId },
  );
  fail(error);
  return String(data);
}

export async function stopWalk(walkId: string): Promise<"saved" | "dropped"> {
  const { data, error } = await supabase.rpc("stop_collar_walk", { p_walk_id: walkId });
  fail(error);
  return data === "dropped" ? "dropped" : "saved";
}

export async function loadDeviceWalks(deviceId: string): Promise<DeviceWalks> {
  const { data, error } = await supabase.rpc("collar_walks_for_device", { p_device_id: deviceId });
  fail(error);
  const row = (data ?? {}) as Raw;
  return { running: parseMaybe(row.running), recent: parseList(row.recent) };
}

export async function loadBookingWalks(bookingId: string): Promise<BookingWalks> {
  const { data, error } = await supabase.rpc("collar_walks_for_booking", { p_booking_id: bookingId });
  fail(error);
  const row = (data ?? {}) as Raw;
  const collars = Array.isArray(row.collars)
    ? (row.collars as Raw[]).map((c) => ({ id: String(c.id), label: str(c.label) }))
    : [];
  return { collars, running: parseMaybe(row.running), recent: parseList(row.recent) };
}

/** Null when the walk is gone or is not the caller's. */
export async function loadWalk(walkId: string): Promise<WalkDetail | null> {
  const { data: raw, error } = await supabase.rpc("get_collar_walk", { p_walk_id: walkId });
  fail(error);
  const data = raw as Raw | null;
  if (!data) return null;
  const collar = data.collar as Raw | null;
  return {
    walk: parseWalk(data.walk),
    collar: collar
      ? {
          label: str(collar.label),
          last_seen_at: str(collar.last_seen_at),
          gps_locked: typeof collar.gps_locked === "boolean" ? collar.gps_locked : null,
          gps_satellites: typeof collar.gps_satellites === "number" ? collar.gps_satellites : null,
        }
      : null,
    pet_name: str(data.pet_name),
    is_owner: data.is_owner === true,
    can_stop: data.can_stop === true,
  };
}
