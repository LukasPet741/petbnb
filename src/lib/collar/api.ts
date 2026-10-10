import { supabase } from "@/lib/supabase";
import type { CollarDevice, CollarPosition, PositionSource } from "./types";
import type { LatestPair } from "./positions";

/**
 * Every read and write the collar feature makes. Failures throw Error(message) with the database's
 * message, so callers can tell "no_recording" from a dropped connection.
 */

const DEVICE_COLUMNS = "id, label, is_demo, claimed_at, created_at, last_seen_at, gps_locked, gps_satellites";
const POSITION_COLUMNS = "device_id, lat, lng, speed_kmh, recorded_at, source";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function pickDevice(row: Record<string, unknown>): CollarDevice {
  return {
    id: row.id as string,
    label: (row.label as string | null) ?? null,
    is_demo: Boolean(row.is_demo),
    claimed_at: (row.claimed_at as string | null) ?? null,
    created_at: row.created_at as string,
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    gps_locked: (row.gps_locked as boolean | null) ?? null,
    gps_satellites: (row.gps_satellites as number | null) ?? null,
  };
}

function pickPosition(row: Record<string, unknown>): CollarPosition {
  return {
    device_id: row.device_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    speed_kmh: (row.speed_kmh as number | null) ?? null,
    recorded_at: row.recorded_at as string,
    source: row.source === "replay" ? "replay" : "collar",
  };
}

/** Real collars before the demo one; within those, the most recently seen first. */
export function sortCollars(devices: CollarDevice[]): CollarDevice[] {
  const seen = (d: CollarDevice) => Date.parse(d.last_seen_at ?? d.claimed_at ?? d.created_at);
  return [...devices].sort((a, b) => (a.is_demo === b.is_demo ? seen(b) - seen(a) : a.is_demo ? 1 : -1));
}

export async function loadCollars(): Promise<CollarDevice[]> {
  const { data, error } = await supabase.from("collar_devices").select(DEVICE_COLUMNS);
  fail(error);
  return sortCollars(((data ?? []) as Record<string, unknown>[]).map(pickDevice));
}

async function newest(deviceId: string, source?: PositionSource): Promise<CollarPosition | null> {
  let query = supabase.from("collar_locations").select(POSITION_COLUMNS).eq("device_id", deviceId);
  if (source) query = query.eq("source", source);
  const { data, error } = await query.order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  fail(error);
  return data ? pickPosition(data as Record<string, unknown>) : null;
}

export async function loadLatest(deviceIds: string[]): Promise<Record<string, LatestPair>> {
  const entries = await Promise.all(
    deviceIds.map(async (id) => [id, { latest: await newest(id), latestReal: await newest(id, "collar") }] as const),
  );
  return Object.fromEntries(entries);
}

export async function loadPositions(
  deviceId: string, fromIso: string, toIso: string, source?: PositionSource,
): Promise<CollarPosition[]> {
  let query = supabase
    .from("collar_locations")
    .select(POSITION_COLUMNS)
    .eq("device_id", deviceId)
    .gte("recorded_at", fromIso)
    .lte("recorded_at", toIso);
  if (source) query = query.eq("source", source);
  const { data, error } = await query.order("recorded_at", { ascending: true });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(pickPosition);
}

export async function loadPetNames(ownerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("pets").select("name").eq("owner_id", ownerId).is("archived_at", null).order("created_at");
  fail(error);
  return ((data ?? []) as { name: string }[]).map((p) => p.name).filter(Boolean);
}

export type ClaimOutcome = "paired" | "already_yours" | "not_found" | "taken";

export interface ClaimResult {
  deviceId: string | null;
  result: ClaimOutcome;
}

const firstRow = <T,>(data: unknown): T | undefined => (Array.isArray(data) ? data[0] : data) as T | undefined;

export async function claimCollar(code: string, label?: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_collar", { p_code: code, p_label: label });
  fail(error);
  const row = firstRow<{ device_id: string | null; result: ClaimOutcome }>(data);
  if (!row) throw new Error("empty_claim_result");
  return { deviceId: row.device_id, result: row.result };
}

export async function renameCollar(deviceId: string, label: string): Promise<void> {
  const { error } = await supabase.from("collar_devices").update({ label }).eq("id", deviceId);
  fail(error);
}

export async function unpairCollar(deviceId: string): Promise<void> {
  const { error } = await supabase.rpc("unpair_collar", { p_device_id: deviceId });
  fail(error);
}

export async function createDemoCollar(): Promise<string> {
  const { data, error } = await supabase.rpc("create_demo_collar");
  fail(error);
  return data as string;
}

export interface ReplayPoint {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  idx: number;
  total: number;
}

export async function replayCollarPoint(deviceId: string, index: number): Promise<ReplayPoint> {
  const { data, error } = await supabase.rpc("replay_collar_point", { p_device_id: deviceId, p_index: index });
  fail(error);
  const row = firstRow<ReplayPoint>(data);
  if (!row) throw new Error("empty_replay_result");
  return row;
}

export interface CollarHandlers {
  onPosition: (position: CollarPosition) => void;
  onDevice: (device: CollarDevice) => void;
  onStatus: (connected: boolean) => void;
}

/**
 * One channel for both collar tables. No row filter: collar_locations has no owner column, and
 * Realtime already applies the tables' RLS, so only the user's own rows arrive.
 */
export function subscribeCollars(userId: string, handlers: CollarHandlers): () => void {
  const channel = supabase
    .channel(`collars:${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "collar_locations" }, (payload) =>
      handlers.onPosition(pickPosition(payload.new as Record<string, unknown>)),
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "collar_devices" }, (payload) =>
      handlers.onDevice(pickDevice(payload.new as Record<string, unknown>)),
    )
    .subscribe((status) => handlers.onStatus(status === "SUBSCRIBED"));
  return () => {
    handlers.onStatus(false);
    void supabase.removeChannel(channel);
  };
}
