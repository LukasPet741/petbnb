# Sitter availability — days off, enforced by the database

**Date:** 2026-09-16 · **Status:** approved by Lukas, not yet implemented
**Why now:** every competitor answers "is this sitter free?" and petbnb cannot. Nothing stops two
owners booking the same sitter for the same week. See `competitive-gap-analysis` (memory).

## Decisions (Lukas, 2026-09-16)

1. **Days off, not days on.** Everyone is available by default; a sitter taps the days they cannot
   take. The 25 seeded sitters stay bookable with no backfill, and a sitter who never opens the
   calendar never vanishes from browse.
2. **The database refuses clashes.** Same posture as `enforce_booking_rules` and the offer rules:
   the browser is not a boundary.
3. Out of scope: recurring weekly patterns, times of day, per-service availability, instant book,
   auto-decline.

## Facts this rests on (checked 2026-09-16)

- `bookings` holds `start_at`/`end_at` as `timestamptz`; `enforce_booking_rules`
  (`20260914193216`) already gates INSERT and every status edge, skipping `postgres`,
  `supabase_admin` and `service_role`, `security invoker`, `search_path = ''`.
- A booking counts as real only once it is `signed`. Two `pending` requests may overlap: the clash
  matters when the sitter accepts one.
- `bookings` has no DELETE policy; cancelling is how a booking ends, so a `cancelled` row must not
  keep blocking dates.
- Browse is behind login, so availability needs to be readable by `authenticated` only.
- `src/lib/pricing.ts` mirrors the price rules the database enforces; availability follows that
  pattern rather than inventing a second one.

## Database (one migration)

**Table**

```sql
create table public.sitter_days_off (
  sitter_id uuid not null references public.profiles(id) on delete cascade,
  day       date not null,
  created_at timestamptz not null default now(),
  primary key (sitter_id, day)
);
```

RLS on. Policies: `select` for `authenticated`; `insert`/`delete` where `auth.uid() = sitter_id`.
No `update` — a day is on or off, so toggling is an insert or a delete. Index: the primary key
already serves `(sitter_id, day)` lookups.

**The one truth function**

```sql
public.sitter_is_free(p_sitter uuid, p_start timestamptz, p_end timestamptz) returns boolean
```

False when any date in the stay is in `sitter_days_off`, or when a `signed` booking for that sitter
overlaps `[p_start, p_end)`. `security definer` (it must see days off and bookings that the caller
may not read), `search_path = ''`, execute granted to `authenticated` only. Half-open comparison, so
a stay that ends the morning another begins does not clash. Dates are compared in **Europe/Vilnius**,
because a day off is a calendar day to a person, not a UTC window.

**Enforcement** — a new trigger function `public.enforce_sitter_availability()`, `security invoker`,
`search_path = ''`, skipping the three trusted roles, running `before insert or update on bookings`:

- **INSERT** (always `pending`): refuse when `sitter_is_free` is false.
- **UPDATE to `signed`**: re-check, because another request may have been accepted since.
- Errors carry `errcode = 'check_violation'` and a hint the UI maps to a sentence:
  `sitter_unavailable` (a day off) and `already_booked` (an accepted booking overlaps). The existing
  code already reads hints this way for prices (`price_changed`).
- Excluding the booking's own row on UPDATE, so accepting never trips over itself.

`create_booking_request` (the RPC that inserts request + first offer) inherits this automatically,
since the trigger fires on the insert it performs.

**Two read RPCs**, because RLS on `bookings` means an owner cannot see another sitter's accepted
bookings, and must not be able to:

- `sitter_busy_days(p_sitter uuid, p_from date, p_to date) returns setof date` — the days off and
  the days covered by accepted bookings, merged into one list. It says a day is taken, never by
  whom or why, so the read-only calendar leaks nothing.
- `sitters_unavailable_between(p_start date, p_end date) returns setof uuid` — the sitters browse
  must hide for a date range, in one call per page load.

Both `security definer`, `search_path = ''`, execute to `authenticated` only.

## App

**`src/lib/availability.ts`** (pure, mirrors the database):
`daysInStay(start, end)` → the calendar days a stay covers; `hasDayOffClash(days, daysOff)`;
`hasBookingClash(start, end, signedBookings)`; `availabilityProblem(...)` →
`null | "sitter_unavailable" | "already_booked"`.

**`src/components/AvailabilityCalendar.tsx`** — two months, Monday-first, Lithuanian and English
month names through the existing `formatDate` helpers. Three day states: free, away (tap to toggle),
booked (from accepted bookings, not toggleable). Past days disabled. Read-only mode for viewers.
44px tap targets; checked at 390px.

**Where it appears**

- `/profile`, inside Sitter mode: the editable calendar, reading `sitter_busy_days` for the booked
  days and their own `sitter_days_off` rows for what they may toggle. Writes are one insert or one
  delete.
- `/browse/[id]`: the same component, read-only, fed by `sitter_busy_days`, so an owner sees which
  days are taken before asking — and learns nothing about the bookings behind them.
- `/browse`: `?from=&to=` in the filter bar with a chip and the result count; sitters returned by
  `sitters_unavailable_between` are hidden. One call per page load, not per card.
- `/bookings/new`: the mirrored rule shows the clash inline before submit, and the two new hints map
  to `appPages.bookingsNew.sitterUnavailable` / `.alreadyBooked` if the database still refuses.

**i18n:** every new string in EN and LT, pinned by the existing parity test.

## Testing

1. **Pure functions first** (TDD, watched failing): day expansion across month ends, half-open
   boundaries, a stay wholly inside a day off, a cancelled booking not blocking.
2. **Components:** calendar toggle and read-only mode; browse date filter; the booking form's inline
   clash.
3. **Database, by impersonation, rolled back:** an owner cannot insert over a day off; cannot insert
   over an accepted booking; a sitter cannot accept a second overlapping request; a cancelled
   booking frees the dates; `service_role` still bypasses. Verified against catalogs
   (`pg_trigger`, `pg_proc`, policies), never a success flag.
4. Full suite, `tsc`, `next build`, then the calendar at 1280 and 390 in both languages from a
   `/dev` sandbox.

## Risks

- **Time zones.** Comparing a `timestamptz` stay against a `date` is where this breaks; the
  Europe/Vilnius conversion is stated once, in `sitter_is_free`, and mirrored in TS.
- **Seed data.** No seeded sitter has days off, so browse looks unchanged until the demo adds some —
  the demo story should mark a few sitters away.
- **Prod migration** needs Lukas's explicit yes, as every prod write does.
