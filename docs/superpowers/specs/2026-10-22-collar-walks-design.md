# Collar walks — Start / Stop, watched live, kept as a short history

Status: APPROVED by Lukas 2026-10-22 ("do the whole thing": both the owner and the sitter part). Brainstormed in chat with Lukas.
Changes an APPROVED flow (`/collar`, see the 2026-09-26 showcase spec): approving this document
approves that change.

## Why

The collar sends a position about every 15 s whenever it is powered, but nothing on the site says
"this stretch was a walk". Today a walk only exists if an agent copies a time window into
`collar_recordings` by hand with SQL. Lukas wants the real marketplace version of it:

- **Lukas's words:** a sitter presses Start on the phone, walks the dog, comes back and presses
  Stop; the owner watches it live; the walk is stored so owners and sitters can look back at it;
  only the last 1–3 walks are shown. The owner can start a walk too.
- **It is a product feature, not a demo path.** Nothing in it is special-cased for the defence.
  At the defence Lukas starts a walk himself (as the owner) with the GPS antenna at a window and
  shows it live; if the GPS does not lock, he replays a saved walk.

## Goals

1. A **sitter** on a running booking can Start and Stop a walk with the owner's collar, from the phone.
2. The **owner** can Start and Stop a walk on their own collar at any time.
3. While a walk runs, the **owner watches it live** on `/collar` (map, time, distance), and the
   sitter sees the same on their walk screen.
4. A stopped walk is **saved** with its route, start, end, duration and distance.
5. Saved walks show as a short history: the **last 3**. Tapping one draws its route and can
   **replay** it (the dot moving along the route).

## Non-goals

- No change to the Pi or to `collar-ingest`: Start and Stop only mark a time window on the site.
- No email for walks (prod sends real mail; Resend free tier). In-app notices only.
- No pet ↔ collar link, no walk photos, no notes, no ratings of walks, no export.
- No "all walks" archive page. Older walks are kept in the database but not shown.
- No paid services and no new infrastructure beyond Supabase free tier + Vercel.

## Anti-goals (would be a failure even if it works)

- A sitter can see an owner's collar **outside their own running walk** (the dog's home, other
  stays, other days).
- A walk that was never stopped stays "live" forever.
- The defence flow needs a hidden switch, a seeded walk, or a special demo account.

## Who sees what

| Who | Live position | Saved walks |
|---|---|---|
| Owner | always, own collar (as today) | every walk on their collar, sitter's and own; last 3 shown |
| Sitter | only during a walk they started, from its start time on | only walks they started; last 3 shown |
| Anyone else | never | never |

## Lukas's decisions (from the chat, 2026-10-22)

- The sitter presses Start; the owner watches live.
- The owner can start a walk too, without a booking.
- Show the last 1–3 walks (3 chosen, see calls below); storage is not a concern
  (30 min ≈ 150 points ≈ 15 KB; the free database is 500 MB).
- It must work live; no demo-only behaviour.

## How it behaves

### Sitter
- On a booking where the viewer is the sitter, status is `signed`, the service is not `grooming`,
  now is within `start_at − 1 h` … `end_at`, and the owner has a paired real collar, the booking
  card shows **Start walk**.
- Start opens a walk screen: live map with the dot and the trail since Start, elapsed time,
  distance, the collar's status in words (searching for GPS / live), and **Stop walk**.
- If the owner has more than one real collar, the sitter picks one by its name before starting.
- The booking also lists that sitter's last 3 walks on this owner's collar (date, duration, distance);
  tapping one opens its route with Replay.

### Owner
- `/collar` gets **Start walk** next to the existing controls (real collars only, not the demo collar).
- While any walk runs on the collar (own or sitter's), `/collar` shows a "Walk in progress" strip:
  who is walking, elapsed time, distance, and **Stop walk** (the owner may stop a sitter's walk).
- A **Recent walks** card shows the last 3 walks on the selected collar: date, who walked
  (you / the sitter's name), duration, distance. Tapping one opens the walk screen with its route; **Replay**
  animates it. Back returns to the live view.
- The booking card's "Live location" link (branch `agent/booking-live-location`, in review) is the
  owner's way in from a booking.

### Rules
- **One running walk per collar.** Start is refused while another walk runs on that collar.
- **Auto-stop:** a walk ends by itself 2 h after Start, or when the collar has sent no position for
  10 min. Its end time is then the last position's time, not the moment it was noticed.
- **Empty walks are dropped:** fewer than 2 real (`source = 'collar'`) positions → not saved.
- **Only real fixes count:** replay points (`source = 'replay'`) never enter a walk.
- **Notices:** for a sitter's walk, the owner gets an in-app notice at Start ("<sitter> started a
  walk") and at the end ("Walk finished · 32 min · 2.1 km"). No notice for the owner's own walk.
  New notification types are not in `booking-notify`'s emailed list, so it already marks them
  `skipped`; only the `notifications_type_check` constraint needs the new types.
- **Deletion:** unpairing a collar deletes its walks (as it deletes its positions today);
  "Delete my account" removes the owner's collars' walks; a deleted sitter's walks stay on the
  owner's collar with the walker shown as "Someone" (as notifications already do).
- LT and EN strings for everything new.

### Calls made by Claude, not by Lukas (check these)
- Walks allowed on `walking`, `boarding`, `daycare`; not `grooming`. Start window: `start_at − 1 h`
  … `end_at`; a walk already running may run past `end_at` until it stops.
- The owner may stop a sitter's walk.
- A sitter keeps seeing their own saved walks after the stay ends.
- Start is allowed while the collar is still searching or offline; the walk screen says so. If no
  position arrives, the 10-min rule ends it and it is dropped as empty.
- The finish notice reads "<sitter> finished a walk"; duration and distance in it are optional
  (notifications carry no payload today; add a walk link only if it is cheap).
- One walk screen, `/walks/<id>`, for everyone: live while the walk runs, the saved route with
  Replay after. The owner's Recent walks and the sitter's booking both open it; Back returns.
  It never changes the collar's status state on `/collar` (the one tested status rule stays as is).
- Replay of a saved walk runs at 400 ms a point (a 30-min walk plays in about a minute).
- "Download my data" includes the walks the user started and the walks on their collars.

## Constraints

- Next.js in this repo is a newer version than training data: read `node_modules/next/dist/docs/`
  before writing route or page code (AGENTS.md).
- Supabase RLS on every table; privileged steps in `security definer` functions with
  `search_path` set, following `claim_collar` / `unpair_collar`.
- The sitter reads the collar only through `security definer` functions bound to their walk, polled
  every 5 s. No new RLS on `collar_devices` / `collar_locations`: a policy there would put the
  owner's collar into the sitter's own collar list (the app-wide collar context) and expose the
  collar's secret hash and pair code.
- Sitters cannot read `collar_devices` or `collar_locations` today (owner-only RLS). The sitter
  needs, during their own walk only: the walked collar's name and status fields, its positions from
  the walk's start, and (to pick a collar) the owner's real collar names on a running booking.
  Every read is bounded by the 2 h cap even if an expired walk has not been closed yet.
- Unpair and "Delete my account" both clear `collar_devices.owner_id`; a trigger on that change
  deletes the collar's walks, so neither function needs rewriting.
- Prod migrations need Lukas's explicit yes. Build on an `agent/…` branch in a worktree, never
  in Lukas's checkout; never push or merge to `main` (DRIVE.md).
- Phone width first (390 px): the sitter presses Start outdoors on a phone.

## Left to the builder

- Table shape. Suggested: `collar_walks` (device, owner, started_by, optional booking, started_at,
  ended_at, end_reason, distance, duration, and the route snapshotted as a jsonb points array when
  the walk ends), so a saved walk does not depend on `collar_locations` rows and the sitter's
  read rule on saved walks is a plain row rule.
- How auto-stop runs without paid infrastructure: lazily (closed by whichever read or ingest sees
  it expired) or `pg_cron` (free on Supabase). Either is fine if a stale walk never shows as live.
- Where the sitter's walk screen lives (a route under the booking, or a full-screen sheet).
- Replay of a saved walk: client-side animation of the stored points is enough; it must not write
  to `collar_locations` (the existing demo replay does, for the demo collar only).
- Distance: reuse `routeStats` in `src/lib/collar/stats.ts`; GPS jitter while standing still may
  need a small minimum-step filter. The builder decides if it is needed after looking at real data.

## Follow-ups (not in this build)

- Copy Lukas's first good walk into `collar_recordings` so a user with no collar can still play
  the demo walk (yes already given; today the table is empty).
- Delete the 56 home fixes from 2026-10-22 14:23–14:39 UTC (needs his yes).
