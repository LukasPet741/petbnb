# Showcase 1/3 — Collar backend + Pi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collars get registered before anyone owns them and are paired by a sticker code; the Pi reports "online, N satellites" even without a GPS fix and never re-sends a stale position; collar-ingest records those check-ins and rejects impossible data; the database can replay a recorded walk.

**Architecture:** One additive migration (new columns, a recordings table, Realtime on the collar tables, four `security definer` functions) that keeps today's Profile collar panel working; collar-ingest v6 with a check-in payload and tightened validation; Pi code split so the GPS reader and the per-tick logic are testable on a laptop; a `provision.py` script that registers a collar and writes the Pi's `.env`. Plan 2 builds the web on top; its cleanup migration removes the old pairing path.

**Tech Stack:** Supabase Postgres (pgcrypto in schema `extensions`), Supabase Edge Functions (Deno; pure helpers tested with vitest's `edge` project), Python 3.11+ (pynmea2, requests, bcrypt, pytest), Supabase MCP tools for prod.

**Spec:** `docs/superpowers/specs/2026-09-26-showcase-collar-smartid-design.md` (sections "Database", "collar-ingest v6", "The Pi"). Approved mockups: `docs/superpowers/specs/2026-09-26-showcase-mockups/`.

## Global Constraints

- Supabase project `jktykrbvwgagcjyuxypo` is production. **Every prod write needs Lukas's explicit yes first**: `apply_migration`, `deploy_edge_function`, any `insert`/`update`/`delete` SQL (a rolled-back check transaction included).
- Git: never `git add -A` or `git add .`; add explicit paths. Never commit `src/app/dev/` or `docs/security/`. Commit messages are a plain sentence (repo style), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- The migration in this plan is **additive only**: `register_collar_device`, the `for all` policy on `collar_devices` and the Profile "My collars" panel must keep working until plan 2's cleanup migration.
- New SQL functions: `security definer`, `set search_path = ''`, fully qualified names (`public.…`, `extensions.crypt`), `revoke all … from public, anon`, `grant execute … to authenticated`. plpgsql functions that `return table` start with `#variable_conflict use_column`.
- Pair codes: 8 Crockford base-32 characters `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (no I, L, O, U), stored uppercase without a dash, shown `XXXX-XXXX`; cleanup = uppercase, O→0, I→1, L→1, drop anything not `[0-9A-Z]`.
- Pi timing: `FIX_INTERVAL_SECONDS` = 15. Satellites: integer 0–64. Battery is never read (`read_battery_pct()` stays `None`).
- Bcrypt hashes made outside Postgres use the `$2a$` prefix, cost 10.
- Nothing secret is committed: no pair code, device id, secret or `.env`.

## Review Focus

- **A fix older than the queue's reach or from the future** (Pi clock wrong, queue flushed days later): `recorded_at` more than 5 min ahead or more than 7 days old is refused with 400 — pinned in Task 2.
- **A collar that loses lock mid-walk** must stop sending positions and start sending check-ins, not repeat its last fix — pinned in Task 3 (`test_never_returns_a_stale_fix`) and Task 4 (`test_tick_without_fix_sends_a_checkin`).
- **Two accounts typing the same sticker code** — the second gets `taken`, and nobody but the owner can replay into or unpair the collar — pinned in Task 1's check transaction.
- **A pair code typed sloppily** (`7k3q 9d2m`, `7K3Q-9D2M`, `O` for `0`) resolves to the same collar — pinned in Task 1 (`clean_pair_code` via `already_yours`) and Task 5 (alphabet test).
- **The Pi's offline queue on disk** must not contain the device secret — pinned in Task 4 (`test_queue_never_stores_the_secret`).

---

### Task 1: Additive collar migration (registration, check-in columns, recordings, replay)

**Files:**
- Create: `supabase/migrations/20260926200000_collar_showcase.sql` (renamed in Step 6 to the version prod records)
- Modify: `src/lib/database.types.ts` (regenerated, never hand-edited)

**Interfaces:**
- Produces (SQL, used by plan 2 and Task 2):
  - `collar_devices`: `owner_id uuid null`, `pair_code text unique`, `claimed_at timestamptz`, `is_demo boolean not null default false`, `last_seen_at timestamptz`, `gps_locked boolean`, `gps_satellites smallint`
  - `collar_locations.source text not null default 'collar'` (`'collar' | 'replay'`)
  - `collar_recordings(id, name, recorded_on, points jsonb, created_at)`
  - `public.clean_pair_code(p_code text) returns text`
  - `public.claim_collar(p_code text, p_label text default null) returns table (device_id uuid, result text)` — result ∈ `paired | already_yours | not_found | taken`
  - `public.unpair_collar(p_device_id uuid) returns void` — raises `not_your_collar`
  - `public.create_demo_collar() returns uuid`
  - `public.replay_collar_point(p_device_id uuid, p_index int) returns table (lat double precision, lng double precision, speed_kmh double precision, idx int, total int)` — raises `not_your_collar`, `no_recording`, `out_of_range`

- [ ] **Step 1: Branch**

The spec commit sits on `feat/demo-polish`; build on top of it.

```bash
cd C:/Users/lkspe/petbnb && git switch feat/demo-polish && git switch -c feat/showcase
```

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260926200000_collar_showcase.sql`:

```sql
-- Showcase (spec 2026-09-26-showcase-collar-smartid-design.md), part 1 of 2.
-- Collars are registered before anyone owns them and paired with the code on their sticker; the
-- Pi reports in even without a GPS fix; a recorded walk can be replayed into collar_locations.
-- ADDITIVE ONLY: register_collar_device and the "for all" policy stay, so today's Profile collar
-- panel keeps working until the web release applies the cleanup migration.

alter table public.collar_devices
  alter column owner_id drop not null,
  add column pair_code text unique check (pair_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  add column claimed_at timestamptz,
  add column is_demo boolean not null default false,
  add column last_seen_at timestamptz,
  add column gps_locked boolean,
  add column gps_satellites smallint check (gps_satellites between 0 and 64);

-- One demo collar per account: create_demo_collar is get-or-create.
create unique index collar_devices_one_demo_per_owner on public.collar_devices (owner_id) where is_demo;

alter table public.collar_locations
  add column source text not null default 'collar' check (source in ('collar', 'replay'));

create index collar_locations_device_source_recorded_idx
  on public.collar_locations (device_id, source, recorded_at desc);

create table public.collar_recordings (
  id int generated always as identity primary key,
  name text not null,
  recorded_on date not null,
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) > 0),
  created_at timestamptz not null default now()
);
-- RLS on and no policies: only replay_collar_point (security definer) reads recordings.
alter table public.collar_recordings enable row level security;

alter publication supabase_realtime add table public.collar_locations, public.collar_devices;

-- The same forgiving cleanup the browser does: case, dashes, spaces, O/I/L typos.
create function public.clean_pair_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(translate(upper(coalesce(p_code, '')), 'OIL', '011'), '[^0-9A-Z]', '', 'g');
$$;

create function public.claim_collar(p_code text, p_label text default null)
returns table (device_id uuid, result text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_device public.collar_devices%rowtype;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_device
  from public.collar_devices d
  where d.pair_code = public.clean_pair_code(p_code)
  for update;

  if not found then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  if v_device.owner_id = v_uid then
    return query select v_device.id, 'already_yours'::text;
    return;
  end if;
  if v_device.owner_id is not null then
    return query select null::uuid, 'taken'::text;
    return;
  end if;

  update public.collar_devices d
  set owner_id = v_uid,
      claimed_at = now(),
      label = coalesce(nullif(btrim(p_label), ''), d.label)
  where d.id = v_device.id;

  return query select v_device.id, 'paired'::text;
end;
$$;

-- Removing a real collar frees its sticker code and deletes its history; a demo collar just goes.
create function public.unpair_collar(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.collar_devices%rowtype;
begin
  select * into v_device
  from public.collar_devices d
  where d.id = p_device_id and d.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'not_your_collar' using errcode = '42501';
  end if;

  if v_device.is_demo then
    delete from public.collar_devices d where d.id = v_device.id;
  else
    delete from public.collar_locations l where l.device_id = v_device.id;
    update public.collar_devices d
    set owner_id = null, claimed_at = null, label = null
    where d.id = v_device.id;
  end if;
end;
$$;

create function public.create_demo_collar()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select d.id into v_id from public.collar_devices d where d.owner_id = v_uid and d.is_demo;
  if v_id is not null then
    return v_id;
  end if;

  -- The secret is thrown away: a demo collar never uplinks, it only receives replays.
  insert into public.collar_devices (owner_id, device_secret_hash, label, is_demo, claimed_at)
  values (v_uid, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), 'Recorded walk', true, now())
  returning id into v_id;
  return v_id;
end;
$$;

-- One point of the newest recording, stamped now and marked as a replay. The page calls this
-- every 2 s with the next index; nothing is stored about the replay itself.
create function public.replay_collar_point(p_device_id uuid, p_index int)
returns table (lat double precision, lng double precision, speed_kmh double precision, idx int, total int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_points jsonb;
  v_total int;
  v_point jsonb;
  v_lat double precision;
  v_lng double precision;
  v_speed double precision;
begin
  if not exists (
    select 1 from public.collar_devices d where d.id = p_device_id and d.owner_id = auth.uid()
  ) then
    raise exception 'not_your_collar' using errcode = '42501';
  end if;

  select r.points into v_points from public.collar_recordings r order by r.id desc limit 1;
  if v_points is null then
    raise exception 'no_recording' using errcode = 'P0002';
  end if;

  v_total := jsonb_array_length(v_points);
  if p_index is null or p_index < 0 or p_index >= v_total then
    raise exception 'out_of_range' using errcode = '22003';
  end if;

  v_point := v_points -> p_index;
  v_lat := (v_point ->> 'lat')::double precision;
  v_lng := (v_point ->> 'lng')::double precision;
  v_speed := nullif(v_point ->> 'speed_kmh', '')::double precision;

  insert into public.collar_locations (device_id, lat, lng, speed_kmh, recorded_at, source)
  values (p_device_id, v_lat, v_lng, v_speed, now(), 'replay');

  return query select v_lat, v_lng, v_speed, p_index, v_total;
end;
$$;

revoke all on function public.clean_pair_code(text) from public, anon;
grant execute on function public.clean_pair_code(text) to authenticated, service_role;
revoke all on function public.claim_collar(text, text) from public, anon;
grant execute on function public.claim_collar(text, text) to authenticated;
revoke all on function public.unpair_collar(uuid) from public, anon;
grant execute on function public.unpair_collar(uuid) to authenticated;
revoke all on function public.create_demo_collar() from public, anon;
grant execute on function public.create_demo_collar() to authenticated;
revoke all on function public.replay_collar_point(uuid, int) from public, anon;
grant execute on function public.replay_collar_point(uuid, int) to authenticated;
```

- [ ] **Step 3: Ask Lukas for the prod yes**

Say exactly what will happen: "Apply migration `collar_showcase` to prod (additive: new columns, a recordings table, Realtime on the two collar tables, four functions), then run one check transaction that ends in ROLLBACK." Wait for an explicit yes. Do not continue without it.

- [ ] **Step 4: Apply**

Call `mcp__claude_ai_Supabase__apply_migration` with `project_id: "jktykrbvwgagcjyuxypo"`, `name: "collar_showcase"`, `query:` the file's full contents.
Expected: success, no error.

- [ ] **Step 5: Run the check transaction (writes are rolled back)**

Call `mcp__claude_ai_Supabase__execute_sql` with this query:

```sql
begin;
select set_config('t.a', (select id::text from public.profiles order by created_at limit 1), true),
       set_config('t.b', (select id::text from public.profiles order by created_at offset 1 limit 1), true);
insert into public.collar_devices (id, owner_id, device_secret_hash, pair_code)
values ('00000000-0000-4000-8000-0000000c0111', null, extensions.crypt('check-secret', extensions.gen_salt('bf')), '7K3Q9D2M');
insert into public.collar_recordings (name, recorded_on, points)
values ('check', current_date, '[{"lat":54.683,"lng":25.233,"speed_kmh":4.2},{"lat":54.684,"lng":25.234,"speed_kmh":3.9}]');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.a'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select result from public.claim_collar('ZZZZ-ZZZZ')) <> 'not_found' then raise exception 'claim: unknown code should be not_found'; end if;
  if (select result from public.claim_collar('7k3q-9d2m', 'Reksas')) <> 'paired' then raise exception 'claim: expected paired'; end if;
  if (select result from public.claim_collar('7K3Q 9D2M')) <> 'already_yours' then raise exception 'claim: expected already_yours'; end if;
  if (select label from public.collar_devices where id = '00000000-0000-4000-8000-0000000c0111') <> 'Reksas' then raise exception 'claim: label not saved'; end if;
  if (select total from public.replay_collar_point('00000000-0000-4000-8000-0000000c0111', 1)) <> 2 then raise exception 'replay: expected total 2'; end if;
  if not exists (select 1 from public.collar_locations where device_id = '00000000-0000-4000-8000-0000000c0111' and source = 'replay') then raise exception 'replay: owner cannot see the row'; end if;
  begin
    perform public.replay_collar_point('00000000-0000-4000-8000-0000000c0111', 2);
    raise exception 'replay: index 2 should be out_of_range';
  exception when others then
    if sqlerrm <> 'out_of_range' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.b'), 'role', 'authenticated')::text, true);
do $$ begin
  if (select result from public.claim_collar('7K3Q9D2M')) <> 'taken' then raise exception 'claim: a second account should get taken'; end if;
  begin
    perform public.replay_collar_point('00000000-0000-4000-8000-0000000c0111', 0);
    raise exception 'replay: another account must be refused';
  exception when others then
    if sqlerrm <> 'not_your_collar' then raise; end if;
  end;
  if public.create_demo_collar() <> public.create_demo_collar() then raise exception 'demo: second call should return the same collar'; end if;
end $$;

select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.a'), 'role', 'authenticated')::text, true);
do $$ begin perform public.unpair_collar('00000000-0000-4000-8000-0000000c0111'); end $$;
reset role;
do $$ begin
  if (select owner_id from public.collar_devices where id = '00000000-0000-4000-8000-0000000c0111') is not null then raise exception 'unpair: owner not cleared'; end if;
  if exists (select 1 from public.collar_locations where device_id = '00000000-0000-4000-8000-0000000c0111') then raise exception 'unpair: history not deleted'; end if;
  if has_function_privilege('anon', 'public.claim_collar(text, text)', 'execute')
     or has_function_privilege('anon', 'public.unpair_collar(uuid)', 'execute')
     or has_function_privilege('anon', 'public.create_demo_collar()', 'execute')
     or has_function_privilege('anon', 'public.replay_collar_point(uuid, integer)', 'execute')
  then raise exception 'grants: anon can execute a collar function'; end if;
  if (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('collar_locations', 'collar_devices')) <> 2 then raise exception 'realtime: collar tables missing'; end if;
end $$;
rollback;
select 'all collar checks passed' as result;
```

Expected: one row `all collar checks passed` (the tool returns the last statement's result; any failed check aborts the batch with its message instead). Any `raise exception` text names the failed check; fix the migration with a follow-up migration (never edit an applied one), apply it with a new yes, and rerun.

Then confirm nothing leaked: `select count(*) from public.collar_devices;` → `0`, and `select count(*) from public.collar_recordings;` → `0`.

- [ ] **Step 6: Match the file name to the recorded version**

Call `mcp__claude_ai_Supabase__list_migrations`; find `collar_showcase` and its version (14 digits). Rename:

```bash
cd C:/Users/lkspe/petbnb && git mv -f supabase/migrations/20260926200000_collar_showcase.sql supabase/migrations/<version>_collar_showcase.sql 2>/dev/null || mv supabase/migrations/20260926200000_collar_showcase.sql supabase/migrations/<version>_collar_showcase.sql
```

(`<version>` is the value `list_migrations` returned, e.g. `20260926201533`.)

- [ ] **Step 7: Regenerate the database types**

Call `mcp__claude_ai_Supabase__generate_typescript_types` with `project_id: "jktykrbvwgagcjyuxypo"`. Write the returned text to `src/lib/database.types.ts`, replacing the whole file.
Check: `grep -n "claim_collar\|replay_collar_point\|gps_satellites\|collar_recordings" src/lib/database.types.ts` shows all four.

- [ ] **Step 8: Typecheck and test**

Run: `cd C:/Users/lkspe/petbnb && npm run typecheck && npm test`
Expected: tsc exits 0; vitest all green (the count from before plus none new).

- [ ] **Step 9: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add supabase/migrations/*_collar_showcase.sql src/lib/database.types.ts && git commit -F - <<'EOF'
Let collars be registered before they have an owner and paired by sticker code

Adds check-in columns, a replay source on positions, a recordings table,
Realtime on the collar tables, and claim/unpair/demo/replay functions.
Additive: the old Profile collar panel keeps working until the cleanup.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: collar-ingest v6 — check-ins, paired-only positions, strict validation

**Files:**
- Modify: `iot-collar/supabase/functions/collar-ingest/lib.ts` (whole file)
- Modify: `iot-collar/supabase/functions/collar-ingest/lib.test.ts` (flip the pinned bugs, add check-ins)
- Modify: `iot-collar/supabase/functions/collar-ingest/index.ts` (whole file)

**Interfaces:**
- Consumes: Task 1's `collar_devices.last_seen_at/gps_locked/gps_satellites`, `collar_locations.source`, `verify_collar_device(p_device_id, p_secret) → (owner_id)`.
- Produces: `validateIngestPayload(body: IngestPayload, now?: number): ValidationResult` where the value is `ValidatedFix` (`kind: "fix"`) or `ValidatedCheckin` (`kind: "checkin"`); exported `REQUIRED_FIELDS_ERROR`, `INVALID_FIELDS_ERROR`, `MAX_FUTURE_MS`, `MAX_AGE_MS`. HTTP contract used by Task 4's Pi code: position → `201` (stored) or `202 {ok:true, stored:false, reason:"unpaired"}`; check-in `{type:"checkin", satellites_in_view, gps_locked}` → `200`; bad input `400`; unknown device/secret `401`.

- [ ] **Step 1: Rewrite the tests (they fail against today's lib.ts)**

Replace the whole of `iot-collar/supabase/functions/collar-ingest/lib.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  validateIngestPayload,
  REQUIRED_FIELDS_ERROR,
  INVALID_FIELDS_ERROR,
  MAX_FUTURE_MS,
  MAX_AGE_MS,
  type IngestPayload,
} from "./lib.ts";

/**
 * Validation for the collar ingest endpoint (v6, 2026-09-26). v5 pinned its gaps as BUG tests;
 * v6 closes them, so those tests now assert rejection. Anything that passes here is written with
 * the service role and drawn on the owner's map as their pet's position.
 */

const NOW = Date.parse("2026-09-26T12:00:00Z");

const valid = (over: Partial<IngestPayload> = {}): IngestPayload => ({
  device_id: "collar-1",
  device_secret: "s3cret",
  lat: 54.6872,
  lng: 25.2797,
  ...over,
});

const checkin = (over: Partial<IngestPayload> = {}): IngestPayload => ({
  device_id: "collar-1",
  device_secret: "s3cret",
  type: "checkin",
  satellites_in_view: 3,
  gps_locked: false,
  ...over,
});

const check = (body: IngestPayload) => validateIngestPayload(body, NOW);

describe("accepted positions", () => {
  it("accepts a well-formed fix and marks it as a fix", () => {
    const result = check(valid());
    expect(result.ok).toBe(true);
    if (result.ok && result.value.kind === "fix") {
      expect(result.value.lat).toBe(54.6872);
      expect(result.value.lng).toBe(25.2797);
      expect(result.value.device_id).toBe("collar-1");
    } else {
      throw new Error("expected a fix");
    }
  });

  it("treats an explicit type of fix like no type at all", () => {
    const result = check(valid({ type: "fix" }));
    expect(result.ok && result.value.kind).toBe("fix");
  });

  it("defaults speed, battery and satellites to null when the keys are absent", () => {
    const result = check(valid());
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBeNull();
    expect(result.value.battery_pct).toBeNull();
    expect(result.value.satellites).toBeNull();
  });

  it("preserves a supplied speed, battery and satellite count", () => {
    const result = check(valid({ speed_kmh: 4.2, battery_pct: 87, satellites: 7 }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBe(4.2);
    expect(result.value.battery_pct).toBe(87);
    expect(result.value.satellites).toBe(7);
  });

  it("preserves a zero speed rather than coercing it to null", () => {
    // A stationary pet is real data; a truthiness check here would erase it.
    const result = check(valid({ speed_kmh: 0, battery_pct: 0 }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBe(0);
    expect(result.value.battery_pct).toBe(0);
  });

  it("leaves recorded_at undefined so the caller can stamp the server time", () => {
    const result = check(valid());
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.recorded_at).toBeUndefined();
  });

  it("keeps an explicit null speed as null", () => {
    const result = check(valid({ speed_kmh: null }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.speed_kmh).toBeNull();
  });

  it("accepts a fix from yesterday, as a flushed offline queue sends", () => {
    const yesterday = new Date(NOW - 24 * 60 * 60_000).toISOString();
    const result = check(valid({ recorded_at: yesterday }));
    if (!result.ok || result.value.kind !== "fix") throw new Error("expected a fix");
    expect(result.value.recorded_at).toBe(yesterday);
  });
});

describe("accepted check-ins", () => {
  it("accepts a check-in without a position", () => {
    const result = check(checkin());
    expect(result).toEqual({
      ok: true,
      value: { kind: "checkin", device_id: "collar-1", device_secret: "s3cret", satellites_in_view: 3, gps_locked: false },
    });
  });

  it("defaults a missing satellite count to null and a missing lock flag to false", () => {
    const result = check({ device_id: "collar-1", device_secret: "s3cret", type: "checkin" });
    expect(result).toEqual({
      ok: true,
      value: { kind: "checkin", device_id: "collar-1", device_secret: "s3cret", satellites_in_view: null, gps_locked: false },
    });
  });
});

describe("rejected payloads", () => {
  it("rejects an empty object", () => {
    expect(check({})).toEqual({ ok: false, error: REQUIRED_FIELDS_ERROR });
  });

  it.each([
    ["device_id", { device_id: undefined }],
    ["device_secret", { device_secret: undefined }],
    ["lat", { lat: undefined }],
    ["lng", { lng: undefined }],
  ])("rejects a payload missing %s", (_label, over) => {
    expect(check(valid(over)).ok).toBe(false);
  });

  it.each([
    ["device_id", { device_id: "" }],
    ["device_secret", { device_secret: "" }],
  ])("rejects an empty-string %s", (_label, over) => {
    expect(check(valid(over)).ok).toBe(false);
  });

  it.each([
    ["a string", "54.7"],
    ["null", null],
    ["a boolean", true],
    ["an object", {}],
  ])("rejects a latitude given as %s", (_label, lat) => {
    expect(check(valid({ lat: lat as number })).ok).toBe(false);
  });

  it("rejects an unknown payload type", () => {
    expect(check(valid({ type: "reboot" }))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });
});

describe("impossible data is refused (v5's pinned bugs, fixed)", () => {
  it.each([
    ["a NaN latitude", { lat: NaN }],
    ["a NaN longitude", { lng: NaN }],
    ["an infinite latitude", { lat: Infinity }],
    ["a negative infinite latitude", { lat: -Infinity }],
    ["latitude 91", { lat: 91 }],
    ["latitude -91", { lat: -91 }],
    ["longitude 181", { lng: 181 }],
    ["longitude -5000", { lng: -5000 }],
    ["null island", { lat: 0, lng: 0 }],
    ["a non-numeric speed", { speed_kmh: "fast" as unknown as number }],
    ["a negative speed", { speed_kmh: -1 }],
    ["a speed over 200 km/h", { speed_kmh: 250 }],
    ["a battery above 100", { battery_pct: 9999 }],
    ["a negative battery", { battery_pct: -5 }],
    ["a fractional battery", { battery_pct: 50.5 }],
    ["65 satellites", { satellites: 65 }],
    ["a fractional satellite count", { satellites: 3.5 }],
  ])("rejects %s", (_label, over) => {
    expect(check(valid(over))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });

  it.each([
    ["an unparseable timestamp", "not-a-timestamp"],
    ["a timestamp from 1999", "1999-01-01T00:00:00Z"],
    ["a far-future timestamp", "2099-01-01T00:00:00Z"],
    ["a timestamp just past the future limit", new Date(NOW + MAX_FUTURE_MS + 1000).toISOString()],
    ["a timestamp just past the age limit", new Date(NOW - MAX_AGE_MS - 1000).toISOString()],
  ])("rejects %s", (_label, recorded_at) => {
    expect(check(valid({ recorded_at }))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });

  it.each([
    ["65 satellites in view", { satellites_in_view: 65 }],
    ["a negative satellite count", { satellites_in_view: -1 }],
    ["a lock flag that is not a boolean", { gps_locked: "yes" as unknown as boolean }],
  ])("rejects a check-in with %s", (_label, over) => {
    expect(check(checkin(over))).toEqual({ ok: false, error: INVALID_FIELDS_ERROR });
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run --project edge`
Expected: FAIL — `INVALID_FIELDS_ERROR` is not exported, and the "refused" tests see `ok: true`.

- [ ] **Step 3: Rewrite `lib.ts`**

Replace the whole of `iot-collar/supabase/functions/collar-ingest/lib.ts` with:

```ts
// Pure payload validation for the collar-ingest Edge Function (v6, 2026-09-26).
//
// Split out of index.ts so it can be unit-tested: index.ts calls Deno.serve at module scope and
// imports npm: specifiers, so importing it from a test would start a server. This file touches
// nothing outside its arguments.
//
// Two payloads share the device credentials. A position (no type, or type "fix") carries lat/lng;
// a check-in (type "checkin") says the collar is online and how many satellites it can see, which
// is what the site shows indoors, where the GPS never locks.

export interface IngestPayload {
  type?: string;
  device_id?: string;
  device_secret?: string;
  lat?: number;
  lng?: number;
  speed_kmh?: number | null;
  battery_pct?: number | null;
  satellites?: number | null;
  recorded_at?: string;
  satellites_in_view?: number | null;
  gps_locked?: boolean;
}

export interface ValidatedFix {
  kind: "fix";
  device_id: string;
  device_secret: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  battery_pct: number | null;
  satellites: number | null;
  recorded_at: string | undefined;
}

export interface ValidatedCheckin {
  kind: "checkin";
  device_id: string;
  device_secret: string;
  satellites_in_view: number | null;
  gps_locked: boolean;
}

export type ValidationResult =
  | { ok: true; value: ValidatedFix | ValidatedCheckin }
  | { ok: false; error: string };

export const REQUIRED_FIELDS_ERROR = "device_id, device_secret, lat, lng are required";
export const INVALID_FIELDS_ERROR = "a field is missing or out of range";

/** A Pi clock a little ahead is fine; minutes ahead is a broken clock. */
export const MAX_FUTURE_MS = 5 * 60_000;
/** The Pi's offline queue can hold a walk for a while, not for weeks. */
export const MAX_AGE_MS = 7 * 24 * 60 * 60_000;

const MAX_SPEED_KMH = 200;

const invalid = { ok: false as const, error: INVALID_FIELDS_ERROR };

function optionalNumber(value: unknown, ok: (n: number) => boolean): number | null | "bad" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || !ok(value)) return "bad";
  return value;
}

const satelliteCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= 64;

export function validateIngestPayload(body: IngestPayload, now: number = Date.now()): ValidationResult {
  const { type, device_id, device_secret } = body;
  if (!device_id || !device_secret || typeof device_id !== "string" || typeof device_secret !== "string") {
    return { ok: false, error: REQUIRED_FIELDS_ERROR };
  }

  if (type === "checkin") {
    const satellites_in_view = optionalNumber(body.satellites_in_view, satelliteCount);
    if (satellites_in_view === "bad") return invalid;
    const locked = body.gps_locked ?? false;
    if (typeof locked !== "boolean") return invalid;
    return { ok: true, value: { kind: "checkin", device_id, device_secret, satellites_in_view, gps_locked: locked } };
  }
  if (type !== undefined && type !== "fix") return invalid;

  const { lat, lng, recorded_at } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return { ok: false, error: REQUIRED_FIELDS_ERROR };
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return invalid;
  // The Pi drops an empty NMEA position as 0,0; the server now agrees.
  if (lat === 0 && lng === 0) return invalid;

  const speed_kmh = optionalNumber(body.speed_kmh, (n) => n >= 0 && n <= MAX_SPEED_KMH);
  const battery_pct = optionalNumber(body.battery_pct, (n) => Number.isInteger(n) && n >= 0 && n <= 100);
  const satellites = optionalNumber(body.satellites, satelliteCount);
  if (speed_kmh === "bad" || battery_pct === "bad" || satellites === "bad") return invalid;

  if (recorded_at !== undefined) {
    const at = typeof recorded_at === "string" ? Date.parse(recorded_at) : NaN;
    if (Number.isNaN(at) || at > now + MAX_FUTURE_MS || at < now - MAX_AGE_MS) return invalid;
  }

  return {
    ok: true,
    value: { kind: "fix", device_id, device_secret, lat, lng, speed_kmh, battery_pct, satellites, recorded_at },
  };
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run --project edge`
Expected: PASS, all tests in `lib.test.ts`.

- [ ] **Step 5: Rewrite `index.ts`**

Replace the whole of `iot-collar/supabase/functions/collar-ingest/index.ts` with:

```ts
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
```

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add iot-collar/supabase/functions/collar-ingest/lib.ts iot-collar/supabase/functions/collar-ingest/lib.test.ts iot-collar/supabase/functions/collar-ingest/index.ts && git commit -F - <<'EOF'
Accept collar check-ins and refuse impossible positions in collar-ingest

A collar that cannot see the sky now says so instead of going silent, and
positions from collars nobody has paired are not stored. Closes the v5
validation gaps the tests had pinned: NaN, out-of-range and 0,0 positions,
bad speed, battery and satellite values, and timestamps outside a week.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 7: Ask Lukas for the deploy yes, then deploy**

Ask: "Deploy collar-ingest v6 to prod (Task 1's migration must already be applied)?" On yes, call `mcp__claude_ai_Supabase__deploy_edge_function` with `project_id: "jktykrbvwgagcjyuxypo"`, `name: "collar-ingest"`, `entrypoint_path: "index.ts"`, `verify_jwt: true`, and `files`: `index.ts` and `lib.ts` with their full contents.
Expected: the result shows version 6, status ACTIVE.

- [ ] **Step 8: Smoke-test the live function (no rows are written)**

```bash
cd C:/Users/lkspe/petbnb && ANON=$(grep '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' .env.local | cut -d= -f2-) && URL=https://jktykrbvwgagcjyuxypo.supabase.co/functions/v1/collar-ingest && \
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"device_id":"00000000-0000-4000-8000-000000000000","device_secret":"x","type":"checkin","satellites_in_view":3,"gps_locked":false}' && \
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$URL" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" -d '{"device_id":"x","device_secret":"y","lat":91,"lng":0}'
```

Expected: `401` (unknown device) then `400` (impossible latitude).

---

### Task 3: GPS reader — no stale fixes, satellites in view, testable on the laptop

**Files:**
- Modify: `iot-collar/collar/gps_reader.py` (whole file)
- Create: `iot-collar/tests/__init__.py` (empty), `iot-collar/tests/nmea.py`, `iot-collar/tests/test_gps_reader.py`
- Create: `iot-collar/pytest.ini`, `iot-collar/requirements-dev.txt`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `Fix(lat, lng, speed_kmh, satellites, fix_time)` (unchanged), new `GPSStatus(locked: bool, satellites_in_view: int)`, `GPSReader(port: str | None = None, baud_rate: int = 9600, timeout: float = 2.0, source: LineSource | None = None)`, `GPSReader.read_fix(max_attempts: int = 50) -> Fix | None` (None when no fresh fix, never the previous one), `GPSReader.status() -> GPSStatus`, `GPSReader.close()`. Test helper `tests.nmea.sentence(body: str) -> bytes` and `FakeSource(lines: list[bytes])`.

- [ ] **Step 1: A Python for the laptop**

Run: `py -3 --version || python --version`
If neither prints a version, ask Lukas: "Install Python 3.12 on this PC with winget (needed for the collar tests and provision.py)?" On yes:

```bash
winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements
```

Then use the full path from here on if the shell has not picked up PATH: `"$LOCALAPPDATA/Programs/Python/Python312/python.exe"` (below: `PY`).

- [ ] **Step 2: Test environment files**

Create `iot-collar/requirements-dev.txt` (laptop only — `requirements.txt` has bluezero, which is Linux-only):

```
pyserial==3.5
pynmea2==1.19.0
requests==2.32.3
python-dotenv==1.0.1
bcrypt==4.2.0
pytest==8.3.3
```

Create `iot-collar/pytest.ini`:

```ini
[pytest]
testpaths = tests
pythonpath = .
```

Append to `.gitignore`:

```
iot-collar/.venv/
iot-collar/.pytest_cache/
iot-collar/queue.jsonl
```

Create the venv and install:

```bash
cd C:/Users/lkspe/petbnb/iot-collar && "$PY" -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
```

Expected: ends with `Successfully installed … pytest-8.3.3 …`.

- [ ] **Step 3: NMEA test helpers**

Create `iot-collar/tests/__init__.py` as an empty file.

Create `iot-collar/tests/nmea.py`:

```python
"""Builds NMEA lines with correct checksums, and a fake serial port that plays them back."""
from __future__ import annotations


def sentence(body: str) -> bytes:
    """'GPGGA,…' -> b'$GPGGA,…*hh\\r\\n' with the XOR checksum a real module sends."""
    checksum = 0
    for char in body:
        checksum ^= ord(char)
    return f"${body}*{checksum:02X}\r\n".encode("ascii")


# 54°41.000' N, 25°14.000' E — Vingis Park, Vilnius.
GGA_FIX = sentence("GPGGA,123519,5441.000,N,02514.000,E,1,07,0.9,120.0,M,26.0,M,,")
GGA_NO_FIX = sentence("GPGGA,123520,,,,,0,00,,,M,,M,,")
RMC_ACTIVE = sentence("GPRMC,123519,A,5441.000,N,02514.000,E,2.3,054.7,260926,,")
RMC_VOID = sentence("GPRMC,123520,V,,,,,,,260926,,")
GSV_SEVEN = sentence("GPGSV,2,1,07,01,40,083,46,02,17,308,41,12,07,344,39,14,22,228,45")
GSV_THREE = sentence("GPGSV,1,1,03,01,40,083,46,02,17,308,41,12,07,344,39")


class FakeSource:
    """Stands in for serial.Serial: readline() returns the next line, then b'' like a timeout."""

    def __init__(self, lines: list[bytes]):
        self._lines = list(lines)
        self.closed = False

    def readline(self) -> bytes:
        return self._lines.pop(0) if self._lines else b""

    def close(self) -> None:
        self.closed = True
```

- [ ] **Step 4: Write the failing tests**

Create `iot-collar/tests/test_gps_reader.py`:

```python
from collar.gps_reader import GPSReader, GPSStatus
from tests.nmea import (
    GGA_FIX, GGA_NO_FIX, GSV_SEVEN, GSV_THREE, RMC_ACTIVE, RMC_VOID, FakeSource,
)


def reader(*lines: bytes) -> GPSReader:
    return GPSReader(source=FakeSource(list(lines)))


def test_returns_a_fix_from_gga_with_its_satellite_count():
    gps = reader(GSV_SEVEN, GGA_FIX)
    fix = gps.read_fix(max_attempts=5)
    assert fix is not None
    assert round(fix.lat, 4) == 54.6833
    assert round(fix.lng, 4) == 25.2333
    assert fix.satellites == 7
    assert gps.status() == GPSStatus(locked=True, satellites_in_view=7)


def test_rmc_speed_is_converted_from_knots_to_kmh():
    fix = reader(RMC_ACTIVE).read_fix(max_attempts=3)
    assert fix is not None
    assert round(fix.speed_kmh, 2) == 4.26


def test_never_returns_a_stale_fix():
    # v5 returned the previous fix when no new one arrived, so a collar that lost lock kept
    # re-sending its last position every tick.
    gps = reader(GGA_FIX, GGA_NO_FIX, GGA_NO_FIX, GGA_NO_FIX)
    assert gps.read_fix(max_attempts=1) is not None
    assert gps.read_fix(max_attempts=3) is None
    assert gps.status().locked is False


def test_counts_satellites_in_view_without_a_fix():
    gps = reader(GSV_THREE, GGA_NO_FIX, RMC_VOID)
    assert gps.read_fix(max_attempts=3) is None
    assert gps.status() == GPSStatus(locked=False, satellites_in_view=3)


def test_ignores_garbage_and_bad_checksums():
    gps = reader(b"garbage\r\n", b"$GPGGA,1,2,3*00\r\n", b"")
    assert gps.read_fix(max_attempts=3) is None


def test_close_closes_the_source():
    source = FakeSource([])
    GPSReader(source=source).close()
    assert source.closed is True
```

- [ ] **Step 5: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -m pytest -q`
Expected: FAIL — `ImportError: cannot import name 'GPSStatus'`.

- [ ] **Step 6: Rewrite `gps_reader.py`**

Replace the whole of `iot-collar/collar/gps_reader.py` with:

```python
"""Reads NMEA sentences from a serial GPS module (e.g. NEO-6M): fixes, and satellites in view."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from typing import Optional, Protocol

import pynmea2

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Fix:
    lat: float
    lng: float
    speed_kmh: float
    satellites: int
    fix_time: float  # time.time() when the fix was read


@dataclass(frozen=True)
class GPSStatus:
    """What a check-in reports when there is no fix: indoors the module sees satellites but no lock."""

    locked: bool
    satellites_in_view: int


class LineSource(Protocol):
    def readline(self) -> bytes: ...

    def close(self) -> None: ...


class GPSReader:
    """Parses GGA (position + satellites used), RMC (position + speed) and GSV (satellites in view).

    read_fix() returns a fix only if one arrived during this call. It used to fall back to the last
    fix, which made a collar that lost lock re-send a stale position every tick.
    """

    def __init__(
        self,
        port: Optional[str] = None,
        baud_rate: int = 9600,
        timeout: float = 2.0,
        source: Optional[LineSource] = None,
    ):
        if source is None:
            import serial  # the real port; tests pass a FakeSource instead

            source = serial.Serial(port, baudrate=baud_rate, timeout=timeout)
        self._source = source
        self._speed_kmh = 0.0
        self._satellites_used = 0
        self._satellites_in_view = 0
        self._locked = False

    def close(self) -> None:
        self._source.close()

    def status(self) -> GPSStatus:
        return GPSStatus(locked=self._locked, satellites_in_view=self._satellites_in_view)

    def read_fix(self, max_attempts: int = 50) -> Optional[Fix]:
        """Reads up to max_attempts lines; returns the first fresh fix, or None."""
        for _ in range(max_attempts):
            line = self._read_line()
            if line is None:
                continue
            fix = self._parse_line(line)
            if fix is not None:
                return fix
        return None

    def _read_line(self) -> Optional[str]:
        try:
            raw = self._source.readline()
        except Exception as exc:  # serial.SerialException on the Pi; anything from a flaky port
            logger.warning("GPS serial read failed: %s", exc)
            return None
        if not raw:
            return None
        return raw.decode("ascii", errors="ignore").strip()

    def _parse_line(self, line: str) -> Optional[Fix]:
        if not line.startswith("$"):
            return None
        try:
            msg = pynmea2.parse(line)
        except pynmea2.ParseError:
            return None

        if isinstance(msg, pynmea2.types.talker.GSV):
            self._satellites_in_view = int(msg.num_sv_in_view or 0)
            return None

        if isinstance(msg, pynmea2.types.talker.GGA):
            if msg.gps_qual == 0 or msg.latitude == 0 or msg.longitude == 0:
                self._locked = False
                return None
            self._locked = True
            self._satellites_used = int(msg.num_sats or 0)
            self._satellites_in_view = max(self._satellites_in_view, self._satellites_used)
            return Fix(
                lat=msg.latitude,
                lng=msg.longitude,
                speed_kmh=self._speed_kmh,
                satellites=self._satellites_used,
                fix_time=time.time(),
            )

        if isinstance(msg, pynmea2.types.talker.RMC):
            if msg.status != "A" or msg.latitude == 0 or msg.longitude == 0:
                self._locked = False
                return None
            self._locked = True
            self._speed_kmh = float(msg.spd_over_grnd or 0.0) * 1.852  # knots -> km/h
            return Fix(
                lat=msg.latitude,
                lng=msg.longitude,
                speed_kmh=self._speed_kmh,
                satellites=self._satellites_used,
                fix_time=time.time(),
            )

        return None
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -m pytest -q`
Expected: `6 passed`.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add .gitignore iot-collar/requirements-dev.txt iot-collar/pytest.ini iot-collar/tests/__init__.py iot-collar/tests/nmea.py iot-collar/tests/test_gps_reader.py iot-collar/collar/gps_reader.py && git commit -F - <<'EOF'
Stop the collar re-sending its last position after it loses GPS lock

read_fix() now returns only fresh fixes, and the reader tracks satellites
in view from GSV so a check-in can say how close it is to a lock. The
reader takes an injectable line source, so it is tested on the laptop.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Check-ins from the Pi, and a queue without the secret

**Files:**
- Modify: `iot-collar/collar/wifi_uplink.py` (whole file)
- Create: `iot-collar/collar/loop.py`
- Modify: `iot-collar/collar/main.py` (whole file)
- Create: `iot-collar/tests/test_uplink_and_loop.py`

**Interfaces:**
- Consumes: Task 3's `Fix`, `GPSStatus`, `GPSReader.read_fix()`, `GPSReader.status()`; Task 2's HTTP contract.
- Produces: `WiFiUplink(ingest_url, device_id, device_secret, supabase_anon_key, queue_path, battery_pct_provider=None, timeout_seconds=5.0, post=requests.post)` with `send(fix) -> None` (queues on failure) and `checkin(status) -> bool` (never queued); `collar.loop.tick(gps, uplink, ble=None) -> None`.

- [ ] **Step 1: Write the failing tests**

Create `iot-collar/tests/test_uplink_and_loop.py`:

```python
import json
from pathlib import Path

from collar.gps_reader import Fix, GPSStatus
from collar.loop import tick
from collar.wifi_uplink import WiFiUplink


class FakeResponse:
    def __init__(self, status_code: int):
        self.status_code = status_code
        self.ok = 200 <= status_code < 300
        self.text = ""


class FakePost:
    """Records every POST; answers with the queued status codes (default 201)."""

    def __init__(self, *codes: int):
        self.codes = list(codes)
        self.calls: list[dict] = []

    def __call__(self, url, json=None, headers=None, timeout=None):
        self.calls.append(json)
        return FakeResponse(self.codes.pop(0) if self.codes else 201)


FIX = Fix(lat=54.6833, lng=25.2333, speed_kmh=4.2, satellites=7, fix_time=1_790_400_000.0)


def uplink(tmp_path: Path, post: FakePost) -> WiFiUplink:
    return WiFiUplink(
        ingest_url="https://example.test/collar-ingest",
        device_id="dev-1",
        device_secret="s3cret",
        supabase_anon_key="anon",
        queue_path=tmp_path / "queue.jsonl",
        post=post,
    )


def test_a_position_carries_its_satellites_and_the_credentials(tmp_path):
    post = FakePost(201)
    uplink(tmp_path, post).send(FIX)
    body = post.calls[0]
    assert body["device_id"] == "dev-1" and body["device_secret"] == "s3cret"
    assert body["lat"] == 54.6833 and body["satellites"] == 7
    assert "type" not in body


def test_queue_never_stores_the_secret(tmp_path):
    post = FakePost(503)
    up = uplink(tmp_path, post)
    up.send(FIX)
    queued = (tmp_path / "queue.jsonl").read_text()
    assert "s3cret" not in queued
    assert json.loads(queued.splitlines()[0])["lat"] == 54.6833


def test_a_queued_position_is_sent_with_credentials_once_back_online(tmp_path):
    post = FakePost(503, 201, 201)
    up = uplink(tmp_path, post)
    up.send(FIX)  # fails, queued
    up.send(FIX)  # flushes the queue first, then sends
    assert post.calls[1]["device_secret"] == "s3cret"
    assert (tmp_path / "queue.jsonl").read_text() == ""


def test_a_checkin_is_sent_but_never_queued(tmp_path):
    post = FakePost(503)
    up = uplink(tmp_path, post)
    assert up.checkin(GPSStatus(locked=False, satellites_in_view=3)) is False
    assert post.calls[0] == {
        "device_id": "dev-1",
        "device_secret": "s3cret",
        "type": "checkin",
        "satellites_in_view": 3,
        "gps_locked": False,
    }
    assert not (tmp_path / "queue.jsonl").exists() or (tmp_path / "queue.jsonl").read_text() == ""


class FakeGPS:
    def __init__(self, fix, status):
        self._fix, self._status = fix, status

    def read_fix(self):
        return self._fix

    def status(self):
        return self._status


class FakeUplink:
    def __init__(self):
        self.sent, self.checkins = [], []

    def send(self, fix):
        self.sent.append(fix)

    def checkin(self, status):
        self.checkins.append(status)
        return True


class FakeBLE:
    def __init__(self):
        self.fixes = []

    def update_fix(self, fix):
        self.fixes.append(fix)


def test_tick_with_a_fix_sends_it_and_updates_ble():
    up, ble = FakeUplink(), FakeBLE()
    tick(FakeGPS(FIX, GPSStatus(True, 7)), up, ble)
    assert up.sent == [FIX] and up.checkins == [] and ble.fixes == [FIX]


def test_tick_without_fix_sends_a_checkin():
    up = FakeUplink()
    tick(FakeGPS(None, GPSStatus(False, 2)), up, None)
    assert up.sent == [] and up.checkins == [GPSStatus(False, 2)]
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -m pytest -q tests/test_uplink_and_loop.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'collar.loop'`.

- [ ] **Step 3: Rewrite `wifi_uplink.py`**

Replace the whole of `iot-collar/collar/wifi_uplink.py` with:

```python
"""Posts GPS fixes and no-fix check-ins to the collar-ingest Supabase Edge Function over WiFi.

Fixes that fail to send (no WiFi, backend unreachable) are appended to a local JSONL queue and
retried on the next tick, so a walk out of WiFi range arrives late instead of never. The queue
holds only the position fields: the device secret is added when a request is sent, so the file
on disk never contains it. Check-ins are not queued; a stale "I was online" is worth nothing.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

import requests

from .gps_reader import Fix, GPSStatus

logger = logging.getLogger(__name__)


class WiFiUplink:
    def __init__(
        self,
        ingest_url: str,
        device_id: str,
        device_secret: str,
        supabase_anon_key: str,
        queue_path: Path,
        battery_pct_provider: Optional[Callable[[], Optional[int]]] = None,
        timeout_seconds: float = 5.0,
        post: Callable[..., requests.Response] = requests.post,
    ):
        self._ingest_url = ingest_url
        self._device_id = device_id
        self._device_secret = device_secret
        self._anon_key = supabase_anon_key
        self._queue_path = queue_path
        self._battery_pct_provider = battery_pct_provider
        self._timeout = timeout_seconds
        self._post_impl = post
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)

    def send(self, fix: Fix) -> None:
        """Sends one fix, queueing it locally on any failure."""
        self._flush_queue()
        body = self._fix_body(fix)
        if self._post(body):
            return
        self._enqueue(body)

    def checkin(self, status: GPSStatus) -> bool:
        """Tells the backend the collar is online without a fix. Not queued on failure."""
        return self._post(
            {"type": "checkin", "satellites_in_view": status.satellites_in_view, "gps_locked": status.locked}
        )

    def _flush_queue(self) -> None:
        if not self._queue_path.exists() or self._queue_path.stat().st_size == 0:
            return
        remaining = []
        for line in self._queue_path.read_text().splitlines():
            if not line.strip():
                continue
            if not self._post(json.loads(line)):
                remaining.append(line)
        self._queue_path.write_text("\n".join(remaining) + ("\n" if remaining else ""))
        if remaining:
            logger.info("%d queued fix(es) still pending", len(remaining))

    def _post(self, body: dict) -> bool:
        payload = {"device_id": self._device_id, "device_secret": self._device_secret, **body}
        try:
            response = self._post_impl(
                self._ingest_url,
                json=payload,
                headers={
                    "apikey": self._anon_key,
                    "Authorization": f"Bearer {self._anon_key}",
                    "Content-Type": "application/json",
                },
                timeout=self._timeout,
            )
            if response.ok:
                return True
            logger.warning("Ingest rejected message: %s %s", response.status_code, response.text)
            return False
        except requests.RequestException as exc:
            logger.info("Ingest unreachable: %s", exc)
            return False

    def _enqueue(self, body: dict) -> None:
        with self._queue_path.open("a") as f:
            f.write(json.dumps(body) + "\n")

    def _fix_body(self, fix: Fix) -> dict:
        battery_pct: Optional[int] = self._battery_pct_provider() if self._battery_pct_provider else None
        return {
            "lat": fix.lat,
            "lng": fix.lng,
            "speed_kmh": round(fix.speed_kmh, 1),
            "battery_pct": battery_pct,
            "satellites": fix.satellites,
            "recorded_at": datetime.fromtimestamp(fix.fix_time, tz=timezone.utc).isoformat(),
        }
```

- [ ] **Step 4: Create `loop.py`**

Create `iot-collar/collar/loop.py`:

```python
"""One tick of the collar: a fresh fix goes out as a position, otherwise as a check-in.

Kept apart from main.py so it can be tested without bluezero (Linux-only) or a serial port.
"""
from __future__ import annotations

import logging

logger = logging.getLogger("collar.loop")


def tick(gps, uplink, ble=None) -> None:
    fix = gps.read_fix()
    if fix is None:
        status = gps.status()
        logger.info("No GPS fix: %d satellite(s) in view", status.satellites_in_view)
        uplink.checkin(status)
        return
    logger.info("Fix: %.6f, %.6f @ %.1f km/h, %d satellites", fix.lat, fix.lng, fix.speed_kmh, fix.satellites)
    if ble is not None:
        ble.update_fix(fix)
    uplink.send(fix)
```

- [ ] **Step 5: Rewrite `main.py`**

Replace the whole of `iot-collar/collar/main.py` with:

```python
"""Collar entry point: reads GPS, serves it over BLE, and reports to PetBnB over WiFi.

Run directly for testing (`python -m collar.main`) or via the systemd unit in
../systemd/petbnb-collar.service for headless boot-time start on the Pi.

Every FIX_INTERVAL_SECONDS the collar sends either a position or, without a fix, a check-in
("online, N satellites in view") — indoors the GPS may never lock, and the site should say so
rather than go quiet.
"""
from __future__ import annotations

import logging
import time

from .config import load_config
from .gps_reader import GPSReader
from .loop import tick
from .wifi_uplink import WiFiUplink

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("collar.main")


def read_battery_pct() -> int | None:
    """Placeholder for a fuel-gauge read (e.g. an I2C MAX17048 HAT). None: no gauge is fitted."""
    return None


def run() -> None:
    config = load_config()

    gps = GPSReader(config.gps_serial_port, config.gps_baud_rate)
    uplink = WiFiUplink(
        ingest_url=config.ingest_url,
        device_id=config.device_id,
        device_secret=config.device_secret,
        supabase_anon_key=config.supabase_anon_key,
        queue_path=config.offline_queue_path,
        battery_pct_provider=read_battery_pct,
    )

    # BLE is a nice-to-have; a Pi without Bluetooth set up still tracks over WiFi. Imported here so
    # the rest of the package stays importable where bluezero is not installed.
    ble = None
    try:
        from .ble_service import BLELocationService

        ble = BLELocationService()
        ble.start()
    except Exception:
        logger.warning("BLE unavailable, continuing without it", exc_info=True)

    logger.info("Collar running, reporting every %ss", config.fix_interval_seconds)

    try:
        while True:
            started = time.monotonic()
            tick(gps, uplink, ble)
            elapsed = time.monotonic() - started
            time.sleep(max(0.0, config.fix_interval_seconds - elapsed))
    except KeyboardInterrupt:
        pass
    finally:
        gps.close()


if __name__ == "__main__":
    run()
```

- [ ] **Step 6: Run all Pi tests**

Run: `cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -m pytest -q`
Expected: `12 passed`.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add iot-collar/collar/wifi_uplink.py iot-collar/collar/loop.py iot-collar/collar/main.py iot-collar/tests/test_uplink_and_loop.py && git commit -F - <<'EOF'
Have the collar check in without a GPS fix, and keep its secret off disk

Each tick now sends a position or an "online, N satellites" check-in, so
indoors the site shows the collar searching instead of silent. Positions
carry their satellite count; the offline queue no longer stores the
device secret.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: `provision.py` — register a collar, print its sticker, write the Pi's `.env`

**Files:**
- Create: `iot-collar/tools/__init__.py` (empty), `iot-collar/tools/provision.py`
- Create: `iot-collar/tests/test_provision.py`
- Modify: `iot-collar/README.md` (sections "Provisioning a collar", "Testing on the laptop", "At the defence", "Recording a walk")

**Interfaces:**
- Consumes: Task 1's table columns (`id`, `owner_id`, `device_secret_hash`, `pair_code`).
- Produces: `ALPHABET`, `new_pair_code(randbelow=secrets.randbelow) -> str`, `format_pair_code(code) -> str`, `hash_secret(secret, rounds=10) -> str`, `registration_sql(device_id, secret_hash, pair_code) -> str`, `write_env(env_path, example_path, device_id, secret) -> None`, `main(argv=None) -> int`.

- [ ] **Step 1: Write the failing tests**

Create `iot-collar/tools/__init__.py` as an empty file. Create `iot-collar/tests/test_provision.py`:

```python
import re

import bcrypt

from tools.provision import (
    ALPHABET, format_pair_code, hash_secret, new_pair_code, registration_sql, write_env,
)


def test_alphabet_is_crockford_without_confusable_letters():
    assert len(ALPHABET) == 32
    assert not set("ILOU") & set(ALPHABET)


def test_pair_codes_are_eight_characters_from_the_alphabet():
    for _ in range(200):
        code = new_pair_code()
        assert re.fullmatch(r"[0-9A-HJKMNP-TV-Z]{8}", code)


def test_pair_code_uses_the_random_source():
    assert new_pair_code(randbelow=lambda n: 0) == "00000000"
    assert new_pair_code(randbelow=lambda n: 31) == "ZZZZZZZZ"


def test_format_adds_the_dash():
    assert format_pair_code("7K3Q9D2M") == "7K3Q-9D2M"


def test_hash_is_2a_bcrypt_that_verifies():
    hashed = hash_secret("s3cret", rounds=4)
    assert hashed.startswith("$2a$04$")
    assert bcrypt.checkpw(b"s3cret", hashed.encode())


def test_registration_sql_registers_an_unowned_collar():
    sql = registration_sql("11111111-2222-4333-8444-555555555555", "$2a$10$abc", "7K3Q9D2M")
    assert "insert into public.collar_devices (id, owner_id, device_secret_hash, pair_code)" in sql
    assert "values ('11111111-2222-4333-8444-555555555555', null, '$2a$10$abc', '7K3Q9D2M');" in sql


def test_write_env_replaces_identity_and_keeps_the_rest(tmp_path):
    env = tmp_path / ".env"
    env.write_text("DEVICE_ID=old\nDEVICE_SECRET=old\nSUPABASE_ANON_KEY=keep-me\n")
    write_env(env, tmp_path / "missing.example", "new-id", "new-secret")
    text = env.read_text()
    assert "DEVICE_ID=new-id\n" in text and "DEVICE_SECRET=new-secret\n" in text
    assert "SUPABASE_ANON_KEY=keep-me\n" in text
    assert "old" not in text


def test_write_env_starts_from_the_example_when_there_is_no_env(tmp_path):
    example = tmp_path / ".env.example"
    example.write_text("DEVICE_ID=0000\nDEVICE_SECRET=change-me\nFIX_INTERVAL_SECONDS=15\n")
    env = tmp_path / ".env"
    write_env(env, example, "new-id", "new-secret")
    assert env.read_text() == "DEVICE_ID=new-id\nDEVICE_SECRET=new-secret\nFIX_INTERVAL_SECONDS=15\n"
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -m pytest -q tests/test_provision.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'tools.provision'`.

- [ ] **Step 3: Write `provision.py`**

Create `iot-collar/tools/provision.py`:

```python
"""Registers a new PetBnB collar.

Run on the laptop, once per collar:

    .venv/Scripts/python -m tools.provision            (Windows)
    .venv/bin/python -m tools.provision                (macOS/Linux)

It prints the SQL that registers the collar (paste it into the Supabase SQL editor — a prod write,
so only with Lukas's yes) and the text for the collar's sticker, and it writes the collar's
identity into the Pi's .env (default: iot-collar/.env, which is gitignored; copy it to the Pi).

The plain secret exists only in that .env: Supabase stores a bcrypt hash. The hash uses the $2a$
prefix, which pgcrypto's crypt() verifies.
"""
from __future__ import annotations

import argparse
import secrets
import sys
import uuid
from pathlib import Path
from typing import Callable

import bcrypt

# Crockford base-32: no I, L, O or U, so a code read off a sticker cannot be misread.
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
HERE = Path(__file__).resolve().parent.parent


def new_pair_code(randbelow: Callable[[int], int] = secrets.randbelow) -> str:
    return "".join(ALPHABET[randbelow(len(ALPHABET))] for _ in range(8))


def format_pair_code(code: str) -> str:
    return f"{code[:4]}-{code[4:]}"


def hash_secret(secret: str, rounds: int = 10) -> str:
    return bcrypt.hashpw(secret.encode(), bcrypt.gensalt(rounds=rounds, prefix=b"2a")).decode()


def registration_sql(device_id: str, secret_hash: str, pair_code: str) -> str:
    return (
        "insert into public.collar_devices (id, owner_id, device_secret_hash, pair_code)\n"
        f"values ('{device_id}', null, '{secret_hash}', '{pair_code}');"
    )


def write_env(env_path: Path, example_path: Path, device_id: str, secret: str) -> None:
    if env_path.exists():
        lines = env_path.read_text().splitlines()
    elif example_path.exists():
        lines = example_path.read_text().splitlines()
    else:
        lines = []
    wanted = {"DEVICE_ID": device_id, "DEVICE_SECRET": secret}
    out, seen = [], set()
    for line in lines:
        key = line.split("=", 1)[0].strip()
        if key in wanted:
            out.append(f"{key}={wanted[key]}")
            seen.add(key)
        else:
            out.append(line)
    for key, value in wanted.items():
        if key not in seen:
            out.append(f"{key}={value}")
    env_path.write_text("\n".join(out) + "\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Register a new PetBnB collar.")
    parser.add_argument("--env", type=Path, default=HERE / ".env", help="the Pi's .env to write")
    parser.add_argument("--example", type=Path, default=HERE / ".env.example")
    args = parser.parse_args(argv)

    device_id = str(uuid.uuid4())
    secret = secrets.token_urlsafe(32)
    code = new_pair_code()

    write_env(args.env, args.example, device_id, secret)

    print("1. Run this in the Supabase SQL editor (prod write: needs Lukas's yes):\n")
    print(registration_sql(device_id, hash_secret(secret), code))
    print("\n2. Print this on the collar's sticker:\n")
    print(f"   PETBNB COLLAR · PAIRING CODE {format_pair_code(code)}")
    print(f"\n3. Copy {args.env} to the Pi (scp) and restart the collar service.")
    print("\nThe secret is only in that file. Don't commit it, and don't paste it anywhere.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -m pytest -q`
Expected: `20 passed`.

- [ ] **Step 5: Check pgcrypto accepts the hash (read-only query)**

```bash
cd C:/Users/lkspe/petbnb/iot-collar && .venv/Scripts/python -c "from tools.provision import hash_secret; print(hash_secret('throwaway-check'))"
```

Call `mcp__claude_ai_Supabase__execute_sql` with `select extensions.crypt('throwaway-check', '<printed hash>') = '<printed hash>' as ok;`
Expected: `ok = true`. (If false, pgcrypto rejects `$2a$` cost 10 — stop and tell Lukas; the fallback is hashing in SQL with `extensions.crypt(secret, extensions.gen_salt('bf'))`.)

- [ ] **Step 6: Update the README**

In `iot-collar/README.md`, replace the whole section `## Provisioning a collar (once per device)` (up to the next `##`) with:

````markdown
## Provisioning a collar (once per device)

Collars are registered before anyone owns them. The owner pairs one in the app by typing the code
from its sticker (Collar → Pair a collar).

On the laptop:

```bash
cd iot-collar
.venv/Scripts/python -m tools.provision      # Windows; .venv/bin/python on macOS/Linux
```

It writes `DEVICE_ID`/`DEVICE_SECRET` into `iot-collar/.env` (fill in `SUPABASE_ANON_KEY` once),
prints an `insert` for the Supabase SQL editor, and prints the sticker text
(`PETBNB COLLAR · PAIRING CODE 7K3Q-9D2M`). Run the insert (a prod write), print the sticker, then
copy the `.env` to the Pi:

```bash
scp .env <your-username>@petbnb-collar.local:~/petbnb-collar/.env
ssh <your-username>@petbnb-collar.local 'sudo systemctl restart petbnb-collar'
```

The plain secret lives only in that `.env`; Supabase keeps a bcrypt hash. Removing the collar in
the app unpairs it (its history is deleted) and the sticker code works again.

## Testing on the laptop

```bash
cd iot-collar
py -3.12 -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest -q
```

`requirements-dev.txt` leaves out bluezero (Linux-only); the tests never import it.

## At the defence

- Put the Pi on a phone hotspot: eduroam-style university WiFi is hard for a Pi.
- Indoors the GPS usually cannot lock. The collar still checks in, and the site shows
  "Online · looking for satellites"; play the recorded walk for movement.
- Switch the Pi off when not demoing: while on it calls collar-ingest about 5,800 times a day.

## Recording a walk

Walk the paired collar outdoors for 30–40 minutes, starting and ending somewhere public. Then, with
Lukas's yes, copy that window into `collar_recordings` (newest recording is the one replayed):

```sql
insert into public.collar_recordings (name, recorded_on, points)
select 'Vingis Park', min(recorded_at)::date,
       jsonb_agg(jsonb_build_object('lat', lat, 'lng', lng, 'speed_kmh', speed_kmh) order by recorded_at)
from public.collar_locations
where device_id = '<collar id>' and source = 'collar'
  and recorded_at between '<walk start>' and '<walk end>';
```
````

Also in the README's "Running it" section, replace this sentence (4 lines):

```markdown
You should see log lines like `Fix: 54.898500, 23.903600 @ 0.0 km/h` once the
GPS gets a lock, `BLE peripheral advertising as GATT service …`, and either
silence (uplink succeeded) or a warning + queued-fix message if WiFi/the
backend is unreachable.
```

with:

```markdown
You should see log lines like `Fix: 54.683300, 25.233300 @ 4.2 km/h, 7 satellites` once the GPS
locks, or `No GPS fix: 3 satellite(s) in view` before that (each one is sent as a check-in), and
`BLE peripheral advertising as GATT service …`.
```

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add iot-collar/tools/__init__.py iot-collar/tools/provision.py iot-collar/tests/test_provision.py iot-collar/README.md && git commit -F - <<'EOF'
Add a provisioning script that registers a collar and prints its sticker

provision.py writes the collar's identity into the Pi's .env, prints the
registration insert (bcrypt hash only) and the pairing code for the
sticker. The README covers provisioning, laptop tests, the defence setup
and how to store a recorded walk.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

- [ ] **Step 8: Final checks for this plan**

Run: `cd C:/Users/lkspe/petbnb && npm run typecheck && npm test && (cd iot-collar && .venv/Scripts/python -m pytest -q)`
Expected: tsc 0; vitest all green; pytest `20 passed`. Record the counts in the checkpoint.
