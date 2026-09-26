// Ingest endpoint the physical collar's WiFi uplink POSTs to (v6, 2026-09-26). Checks the
// device's secret against its stored hash (via verify_collar_device, which never returns the hash
// itself), records that the collar checked in, and stores positions only for collars that belong
// to someone. Writes use the service role, so the collar never holds a key that could read or
// write anything beyond "I am this device, here is where I am".
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateIngestPayload, type IngestPayload } from "./lib.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let body: IngestPayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const validated = validateIngestPayload(body);
  if (!validated.ok) {
    return json({ error: validated.error }, 400);
  }
  const payload = validated.value;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: device, error: deviceError } = await supabase
    .rpc("verify_collar_device", { p_device_id: payload.device_id, p_secret: payload.device_secret })
    .maybeSingle();

  if (deviceError || !device) {
    return json({ error: "Unknown device or bad secret" }, 401);
  }

  // Every authenticated message counts as "seen", paired or not: a collar switched on before its
  // owner types the code shows as online the moment it is paired.
  const status = payload.kind === "fix"
    ? { last_seen_at: new Date().toISOString(), gps_locked: true, gps_satellites: payload.satellites }
    : { last_seen_at: new Date().toISOString(), gps_locked: payload.gps_locked, gps_satellites: payload.satellites_in_view };

  const { error: statusError } = await supabase.from("collar_devices").update(status).eq("id", payload.device_id);
  if (statusError) {
    // No database text in the response: the caller is a device, and the message would leak schema.
    return json({ error: "Could not record the check-in" }, 500);
  }

  if (payload.kind === "checkin") {
    return json({ ok: true }, 200);
  }

  // A registered collar nobody has paired yet: its positions belong to no one, so none are kept.
  if ((device as { owner_id: string | null }).owner_id === null) {
    return json({ ok: true, stored: false, reason: "unpaired" }, 202);
  }

  const { error: insertError } = await supabase.from("collar_locations").insert({
    device_id: payload.device_id,
    lat: payload.lat,
    lng: payload.lng,
    speed_kmh: payload.speed_kmh,
    battery_pct: payload.battery_pct,
    recorded_at: payload.recorded_at ?? new Date().toISOString(),
    source: "collar",
  });

  if (insertError) {
    return json({ error: "Could not store the position" }, 500);
  }

  return json({ ok: true }, 201);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
