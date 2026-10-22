# Collar walks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners and sitters Start/Stop a walk with the owner's GPS collar; the owner watches it live; the last 3 saved walks show and replay.

**Architecture:** One table `collar_walks` marks a time window on a collar and, at the end, snapshots the real fixes in it. Every write and every sitter read goes through `security definer` RPCs bound to the caller's walk; expired walks are closed lazily by whichever RPC touches the collar. One client screen `/walks/[walkId]` serves live and saved walks for both roles; `/collar` gets a Walks card, the sitter's booking card a walk slot.

**Tech Stack:** Next.js (repo version; client pages use `useParams`), React, Supabase (Postgres RPC + RLS), Leaflet via `LazyCollarMap`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-22-collar-walks-design.md`

## Global Constraints

- Auto-stop: 2 h after Start, or 10 min with no real fix; end time = last fix's time.
- Walks only on `walking`, `boarding`, `daycare`; sitter Start window `start_at − 1 h` … `end_at`, booking `signed`.
- Fewer than 2 real (`source = 'collar'`) fixes → the walk is deleted, not saved.
- One running walk per collar (partial unique index); demo collars never get walks.
- Last 3 walks shown; all kept. Notices in-app only, sitter walks only: `walk_started`, `walk_finished`.
- No new RLS on `collar_devices` / `collar_locations`. Sitter reads only via RPCs, polled every 5 s.
- LT + EN for every string (parity test). Phone width 390 px first.
- No prod writes (the migration) without Lukas's yes in chat. Never `git add -A`; never push or merge.

## Review Focus

1. A walk opened after it expired (nobody pressed Stop) shows as saved or gone, never "live" → `get_collar_walk` closes it first; WalkScreen test with `ended_at` set renders the saved view.
2. Owner and sitter press Start at the same time → one walk; the other sees "A walk is already running on this collar." → `walkErrorKey` test maps `walk_running`; WalksCard test shows the toast text.
3. GPS never locks during a walk → Stop says "No positions arrived, so this walk was not saved." → WalkScreen test on `dropped`.
4. A stranger opens `/walks/<id>` → "This walk isn't available.", no crash → `loadWalk` returns null on `null` data; WalkScreen test.
5. Sitter's phone sleeps mid-walk → on wake the poll resumes and shows the current trail → WalkScreen polls while `ended_at` is null (fake-timer test: second load after 5 s).

---

### Task 1: Migration `collar_walks`

**Files:**
- Create: `supabase/migrations/20261022160000_collar_walks.sql`
- Modify: `src/lib/database.types.ts` (table + 5 RPCs, hand-written in the generated shape)

**Produces (RPCs, all `security definer`, `search_path = ''`, granted to `authenticated` only):**
- `start_collar_walk(p_device_id uuid, p_booking_id uuid default null) returns uuid` — errors `not_allowed` (42501), `walk_running` (P0001).
- `stop_collar_walk(p_walk_id uuid) returns text` — `'saved' | 'dropped'`; error `not_your_walk` (42501).
- `collar_walks_for_device(p_device_id uuid) returns jsonb` — owner only: `{running: Walk|null, recent: Walk[≤3]}`.
- `collar_walks_for_booking(p_booking_id uuid) returns jsonb` — sitter only: `{collars: [{id,label}], running: Walk|null, recent: Walk[≤3]}`; `collars` empty outside the Start window.
- `get_collar_walk(p_walk_id uuid) returns jsonb` — owner or walker, else `null`: `{walk: Walk, collar: {label,last_seen_at,gps_locked,gps_satellites}|null, pet_name, is_owner, can_stop}`.
- Walk JSON: `{id, device_id, booking_id, walker_id, walker_name, walked_by_me, started_at, ended_at, end_reason, points: [{lat,lng,speed_kmh,recorded_at}]}`; running walks carry live points (bounded by the 2 h cap).

- [ ] Table with checks (`ended_at`/`end_reason` both null or both set; saved points ≥ 2), partial unique index, FK indexes, RLS select for `owner_id` or `walker_id`.
- [ ] Internal helpers (execute revoked from everyone): `_collar_walk_points`, `_collar_walk_json`, `_finish_collar_walk(p_walk_id, p_reason, p_end) returns text`, `_close_expired_collar_walks(p_device_id)`.
- [ ] Trigger on `collar_devices` owner change → delete that collar's walks (covers unpair + erase).
- [ ] `notifications_type_check` gains `walk_started`, `walk_finished`.
- [ ] Verify: `npx tsc --noEmit` passes with the new types. SQL itself is verified in Task 7.
- [ ] Commit.

### Task 2: `src/lib/collar/walks.ts`

**Files:** Create `src/lib/collar/walks.ts`, `src/lib/collar/__tests__/walks.test.ts`

**Produces:**
- Constants `WALK_MAX_MS = 7_200_000`, `WALK_SILENCE_MS = 600_000`, `WALK_EARLY_START_MS = 3_600_000`, `WALK_SERVICES = ["walking","boarding","daycare"]`, `WALK_POLL_MS = 5000`, `WALK_REPLAY_MS = 400`.
- Types `WalkPoint`, `CollarWalk`, `WalkCollarStatus`, `WalkDetail`, `DeviceWalks`, `BookingWalks`, `WalkEndReason`, `WalkLiveState = "live"|"searching"|"offline"|"ended"`.
- `parseWalk(raw: unknown): CollarWalk`, `walkStats(walk, now): {distanceKm, durationMin}`, `bookingAllowsWalk(b, now): boolean`, `walkLiveState(detail, now): WalkLiveState`, `walkErrorKey(e): "walk_running"|"not_allowed"|"failed"`.
- `startWalk(deviceId, bookingId?)`, `stopWalk(walkId)`, `loadDeviceWalks(deviceId)`, `loadBookingWalks(bookingId)`, `loadWalk(walkId): Promise<WalkDetail|null>`.

- [ ] Tests first: window edges (exactly `start − 1 h` allowed, `end_at` refused, grooming refused, pending refused); stats use `ended_at` when set, `now` otherwise, distance via `routeStats`; live state uses `LIVE_MAX_AGE_MS`/`SEEN_MAX_AGE_MS`; RPC names + args; `loadWalk` null on null data; error mapping.
- [ ] Implement; tests green; commit.

### Task 3: Notifications

**Files:** Modify `src/lib/types.ts`, `src/lib/notification-text.ts` (+ `notificationHref`), `src/components/NotificationBell.tsx`, `src/components/dashboard/ActivityFeed.tsx`, `src/lib/i18n/{en,lt}/messages.ts`, tests in `src/lib/__tests__/notification-text.test.ts`.

- [ ] `notificationHref(n): string | null` — walk types → `/collar`; else `booking_id ? /messages/<id> : null`. Test both.
- [ ] Strings: EN `"{actor} started a walk"`, `"{actor} finished a walk"`; LT `"{actor} pradėjo pasivaikščiojimą"`, `"{actor} baigė pasivaikščiojimą"`.
- [ ] Commit.

### Task 4: Walk screen `/walks/[walkId]`

**Files:** Create `src/app/(app)/walks/[walkId]/page.tsx`, `src/components/collar/WalkScreen.tsx`, `src/components/collar/useWalkReplay.ts`, tests `src/components/collar/__tests__/WalkScreen.test.tsx`.

- [ ] Tests: running walk shows elapsed + distance + Stop; polls again after `WALK_POLL_MS`; Stop → `dropped` shows the not-saved line; ended walk shows "Saved walk · <date>" + Replay and stops polling; `null` → not available.
- [ ] `useWalkReplay(points) → {index: number|null, play(), stop()}` at `WALK_REPLAY_MS`.
- [ ] Back link: `/collar` when `is_owner`, else `/bookings`. Commit.

### Task 5: Owner Walks card on `/collar`

**Files:** Create `src/components/collar/WalksCard.tsx`, `src/components/collar/useDeviceWalks.ts`, test `src/components/collar/__tests__/WalksCard.test.tsx`; modify `src/components/collar/CollarPage.tsx`, `src/lib/i18n/{en,lt}/appPages.ts` (`appPages.collar.walks.*`).

- [ ] Tests: Start calls `startWalk(deviceId, null)`; running strip names "You" / walker, Stop calls `stopWalk`; recent shows ≤ 3 rows linking `/walks/<id>`; `walk_running` error shows its text.
- [ ] Render for real collars only, above `WeekCard`; refresh every 15 s. Commit.

### Task 6: Sitter walk slot on the booking card

**Files:** Create `src/components/BookingWalks.tsx`, test `src/components/__tests__/BookingWalks.test.tsx`; modify `src/components/BookingCard.tsx` (`walkSlot?: React.ReactNode`), `src/app/(app)/bookings/page.tsx` (sitter view, `signed` or `completed`).

- [ ] Tests: collars `[]` + no recent → renders nothing; one collar → Start → `startWalk(c1, bookingId)` → `router.push("/walks/<id>")`; two collars → a picker; running → "Open walk" link; recent ≤ 3.
- [ ] Commit.

### Task 7: Export, monitor dot, verification, prod migration

**Files:** Modify `src/lib/data-export.ts` (+ test), `tools/monitor/features.mjs`.

- [ ] Export gains `collarWalks` (rows where the user is owner or walker).
- [ ] Monitor dot `collar-walks` before `collar` in `FEATURES`.
- [ ] `npx tsc --noEmit` 0 errors; `npx vitest run` all green (one heavy process at a time).
- [ ] With Lukas's yes: apply the migration; smoke-test in SQL inside `begin … rollback` (start, double start refused, stop with 0 fixes → dropped, expired walk closed by a read).
- [ ] `agent.mjs step` / `note` with results; checkpoint in project notes.
