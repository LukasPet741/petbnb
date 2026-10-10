import { supabase } from "@/lib/supabase";

/**
 * "Download my data" (GDPR art. 15 access and art. 20 portability): everything the signed-in
 * person can read about themselves, as one JSON file made in the browser. Row-level security
 * already limits each query to what is theirs; the filters below say which rows that is.
 * Left out on purpose: a collar's secret hash and pairing code (they would let a copy of the
 * file impersonate the collar), and the Smart-ID demo's rate-limit log, which the app cannot read.
 */

/** The API hands back at most this many rows per request. */
export const EXPORT_PAGE = 1000;

type Rows = Record<string, unknown>[];
type Page = PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Every row a query matches, a page at a time. */
async function all(query: () => { range(from: number, to: number): Page }): Promise<Rows> {
  const rows: Rows = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    const { data, error } = await query().range(from, from + EXPORT_PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Rows;
    rows.push(...page);
    if (page.length < EXPORT_PAGE) return rows;
  }
}

export interface MyData {
  format: "petbnb-my-data/1";
  exportedAt: string;
  account: { id: string; email: string | null };
  profile: unknown;
  pets: Rows;
  bookings: Rows;
  /** Chat lines and price offers on those bookings, both sides', since they are the booking's record. */
  messages: Rows;
  reviews: Rows;
  savedSitters: Rows;
  notifications: Rows;
  daysOff: Rows;
  collars: Rows;
  collarLocations: Rows;
}

export async function collectMyData(user: { id: string; email?: string | null }, now = new Date()): Promise<MyData> {
  const uid = user.id;

  const { data: profile, error: profileError } = await supabase.from("my_profile").select("*").maybeSingle();
  if (profileError) throw new Error(profileError.message);

  const pets = await all(() => supabase.from("pets").select("*").eq("owner_id", uid).order("created_at"));
  const bookings = await all(() =>
    supabase.from("bookings").select("*").or(`owner_id.eq.${uid},sitter_id.eq.${uid}`).order("created_at"),
  );
  const bookingIds = bookings.map((b) => String(b.id));
  const messages = bookingIds.length
    ? await all(() => supabase.from("messages").select("*").in("booking_id", bookingIds).order("created_at"))
    : [];
  const reviews = await all(() =>
    supabase.from("reviews").select("*").or(`author_id.eq.${uid},subject_id.eq.${uid}`).order("created_at"),
  );
  const savedSitters = await all(() =>
    supabase.from("favorites").select("sitter_id,created_at").eq("user_id", uid).order("created_at"),
  );
  const notifications = await all(() =>
    supabase.from("notifications").select("id,booking_id,type,read_at,created_at").eq("user_id", uid).order("created_at"),
  );
  const daysOff = await all(() => supabase.from("sitter_days_off").select("day,created_at").eq("sitter_id", uid).order("day"));
  const collars = await all(() =>
    supabase
      .from("collar_devices")
      .select("id,label,is_demo,created_at,claimed_at,last_seen_at")
      .eq("owner_id", uid)
      .order("created_at"),
  );
  const collarIds = collars.map((c) => String(c.id));
  const collarLocations = collarIds.length
    ? await all(() =>
        supabase
          .from("collar_locations")
          .select("device_id,lat,lng,speed_kmh,battery_pct,recorded_at,source")
          .in("device_id", collarIds)
          .order("recorded_at"),
      )
    : [];

  return {
    format: "petbnb-my-data/1",
    exportedAt: now.toISOString(),
    account: { id: uid, email: user.email ?? null },
    profile,
    pets,
    bookings,
    messages,
    reviews,
    savedSitters,
    notifications,
    daysOff,
    collars,
    collarLocations,
  };
}

export function exportFilename(now = new Date()): string {
  return `petbnb-my-data-${now.toISOString().slice(0, 10)}.json`;
}
