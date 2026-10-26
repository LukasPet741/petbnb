import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards over the migration files, replayed in order as "supabase db reset" would.
 *
 * handle_new_user creates the profile row inside every signup. Without SECURITY DEFINER it
 * runs as supabase_auth_admin, which may not write public.profiles, and every signup fails
 * (prod, 2026-08-30 → 2026-10-10, after the baseline was replayed there).
 */

const DIR = path.join(process.cwd(), "supabase/migrations");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const read = (f: string) => fs.readFileSync(path.join(DIR, f), "utf8");

/** Whether handle_new_user ends up SECURITY DEFINER after the files run in order. */
function handleNewUserIsDefiner(): boolean | null {
  let definer: boolean | null = null;
  for (const file of files) {
    const sql = read(file).replace(/--.*$/gm, "");
    const re = /(create\s+or\s+replace\s+function\s+(?:public\.)?handle_new_user\s*\(\s*\)[\s\S]*?\$\$)|(alter\s+function\s+(?:public\.)?handle_new_user\s*\(\s*\)[^;]*;)/gi;
    for (const m of sql.matchAll(re)) {
      const text = m[0].toLowerCase();
      if (m[1]) definer = /security\s+definer/.test(text);
      else if (/security\s+definer/.test(text)) definer = true;
      else if (/security\s+invoker/.test(text)) definer = false;
    }
  }
  return definer;
}

describe("migrations", () => {
  it("leave the signup trigger SECURITY DEFINER, or nobody can sign up", () => {
    expect(handleNewUserIsDefiner()).toBe(true);
  });

  it("keep the warning that the baseline must never run against production", () => {
    expect(read("00000000000000_baseline_initial_schema.sql")).toMatch(/NEVER RUN IT AGAINST PRODUCTION/);
  });
});

describe("places migration", () => {
  const sql = read("20261026180000_places.sql").replace(/--.*$/gm, "").toLowerCase();
  const tables = ["places", "place_locations", "place_services"];

  it("turns on row level security for every places table", () => {
    for (const t of tables) expect(sql, t).toContain(`alter table public.${t} enable row level security`);
  });

  it("lets the API read published places and write nothing", () => {
    expect(sql).not.toMatch(/\bfor (insert|update|delete|all)\b/);
    expect(sql).toContain("revoke insert, update, delete, truncate on public.places, public.place_locations, public.place_services from anon, authenticated");
    expect(sql.match(/status = 'published'/g)).toHaveLength(3);
  });

  it("pins the search path of its trigger function", () => {
    expect(sql).toMatch(/create function public\.places_touch_updated_at\(\)[^$]*set search_path = ''/);
  });
});

describe("sitter area counts migration", () => {
  const sql = read("20261026200000_sitter_area_counts.sql").replace(/--.*$/gm, "").toLowerCase();

  it("hands out totals per city only, never a person's row", () => {
    expect(sql).toMatch(/returns table \(city text, sitters integer\)/);
    expect(sql).toMatch(/group by btrim\(p\.city\)/);
  });

  it("keeps the privacy floor of 5 in the database too", () => {
    expect(sql).toMatch(/having count\(\*\) >= 5/);
  });

  it("runs as its owner with a pinned search path, and only that function is granted", () => {
    expect(sql).toMatch(/security definer\s+set search_path = ''/);
    expect(sql).toContain("revoke all on function public.sitter_counts_by_city() from public");
    expect(sql).not.toMatch(/grant (select|insert|update|delete)/);
  });
});

describe("place community migration", () => {
  const sql = read("20261026210000_place_community.sql").replace(/--.*$/gm, "").toLowerCase();
  const tables = ["place_reviews", "place_posts", "pet_places", "content_reports"];

  it("turns on row level security for every community table", () => {
    for (const t of tables) expect(sql, t).toContain(`alter table public.${t} enable row level security`);
  });

  it("gives anon no table at all, and authors only their rating and words to change", () => {
    expect(sql).toContain("revoke all on public.place_reviews, public.place_posts, public.pet_places, public.content_reports from anon, authenticated");
    expect(sql).toContain("grant update (rating, body) on public.place_reviews to authenticated");
    expect(sql).not.toMatch(/grant (select|insert|update|delete|all)[^;]* to anon/);
  });

  it("never hides anything without a stated reason (DSA)", () => {
    expect(sql).toContain("check (status = 'visible' or hidden_reason is not null)");
    expect(sql.match(/hidden_has_reason/g)).toHaveLength(2);
  });

  it("lets nobody but an admin read reports", () => {
    expect(sql).not.toMatch(/on public\.content_reports\s+for select/);
    expect(sql).toContain("grant insert on public.content_reports to authenticated");
  });

  it("keeps pets private until their owner says otherwise", () => {
    expect(sql).toContain("add column is_public boolean not null default false");
  });

  it("reads publicly only through definer functions with a pinned search path", () => {
    expect(sql.match(/security definer\s+set search_path = ''/g)).toHaveLength(3);
    expect(sql).toContain("revoke all on function public.public_author_name(uuid) from public, anon, authenticated");
  });
});

describe("place business migration", () => {
  const sql = read("20261026220000_place_business.sql").replace(/--.*$/gm, "").toLowerCase();

  it("turns on row level security for claims and booking requests", () => {
    for (const t of ["place_claims", "place_booking_requests"]) expect(sql, t).toContain(`alter table public.${t} enable row level security`);
  });

  it("lets an owner edit only their page's words, never its tier, status, name or logo", () => {
    expect(sql).toContain("grant update (description_lt, description_en, hours_lt, hours_en, prices_note_lt, prices_note_en, website_url, accepts)");
    expect(sql).not.toMatch(/grant update \([^)]*\b(tier|status|slug|name|logo_path|consent_logo|owner_user_id)\b/);
  });

  it("never rejects a claim without a reason", () => {
    expect(sql).toContain("check (status <> 'rejected' or decided_reason is not null)");
  });

  it("changes a booking request's status only through its two functions", () => {
    expect(sql).toContain("grant select, insert on public.place_booking_requests to authenticated");
    expect(sql).not.toMatch(/grant [^;]*update[^;]* on public\.place_booking_requests/);
    expect(sql.match(/security definer\s+set search_path = ''/g)).toHaveLength(4);
  });

  it("keeps everything away from anon", () => {
    expect(sql).toContain("revoke all on public.place_claims, public.place_booking_requests from anon, authenticated");
    expect(sql).not.toMatch(/to anon/);
  });

  it("shows pet owner counts only above the floor", () => {
    expect(sql).toMatch(/having count\(distinct pr\.id\) >= 5/);
  });
});
