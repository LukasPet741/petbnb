// Ingest endpoint the physical collar's WiFi uplink POSTs to. Validates the
// device's secret against its stored hash (via verify_collar_device, which never
// returns the hash itself) and, if it checks out, inserts the fix into
// collar_locations using the service role -- so the collar never holds a key that
// could read/write anything beyond "insert one location for the device it is."
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
  const { device_id, device_secret, lat, lng, speed_kmh, battery_pct, recorded_at } =
    validated.value;

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: device, error: deviceError } = await supabase
    .rpc("verify_collar_device", { p_device_id: device_id, p_secret: device_secret })
    .single();

  if (deviceError || !device) {
    return json({ error: "Unknown device or bad secret" }, 401);
  }

  const { error: insertError } = await supabase.from("collar_locations").insert({
    device_id,
    lat,
    lng,
    speed_kmh,
    battery_pct,
    recorded_at: recorded_at ?? new Date().toISOString(),
  });

  if (insertError) {
    return json({ error: insertError.message }, 500);
  }

  return json({ ok: true }, 201);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
