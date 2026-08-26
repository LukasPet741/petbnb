# Next Session

## Project
PetBnB — pet sitter marketplace. Next.js 16, React 19, Tailwind v4, Supabase, Framer Motion.
Working directory: `C:\Users\lkspe\petbnb` — run with `npm run dev` (port 3000).

⚠️ This is a modified Next.js 16 — read `node_modules/next/dist/docs/` before writing framework code (see AGENTS.md).

## Design system (redesigned — "calm & modern sage")
Tokens live in `src/app/globals.css` (CSS vars + Tailwind v4 `@theme inline`):
- `bg-canvas` `#FBFAF8`, `bg-surface` `#FFFFFF`, `bg-surface-2` `#F4F2EE`
- `brand` `#2F6F5E`, `brand-strong` `#265A4C` (hover), `brand-soft` `#E8F0EC`, `brand-softer` `#F1F6F3`
- `ink` `#1A1F1D`, `ink-soft` `#5B635F`
- Fonts: **Fraunces** (`font-display`, headings) + **Inter** (`font-sans`, body), wired in `src/app/layout.tsx`.
- Use `text-ink/ink-soft`, `bg-brand/brand-soft`, `border-black/5`. Neutral greys use Tailwind `stone-*`.
- Currency is **EUR `€`** everywhere (`formatCurrency` → EUR in `src/lib/utils.ts`).

## Supabase
Project ID: `jktykrbvwgagcjyuxypo` (eu-central-1, active).
Tables: `profiles`, `pets`, `bookings`, `favorites` — all RLS. `profiles` SELECT = `true` (anon can read → public landing shows real sitters).
`favorites(user_id default auth.uid(), sitter_id → profiles, created_at)` — own-row select/insert/delete RLS. Insert with just `{ sitter_id }`.
**Note:** the logged-in demo account is **`cb66f14a…` "Lukas Petkevicius"** (owner, pet "bis"), NOT the dummy sitter `d2abd1c6…` "Lukas". Seed demo rows for `cb66f14a…`.
Storage buckets exist (`pet-images`, `users-avatars`) but no upload UI is built yet.
Credentials in `.env.local` (not committed). Auth trigger auto-creates an empty profile row on signup.

## Photos (seeded into DB)
All `avatar_url` / `photo_url` were null; now seeded with verified external URLs:
- 10 sitters + 5 owners → gender-matched `randomuser.me` portraits.
- 10 dummy pets (`aaaaaaaa-…`) → type/breed-keyworded `loremflickr.com` photos (the real user pet "bis" left null → shows icon fallback).
- Landing/auth imagery → curated Unsplash URLs in `src/lib/images.ts`.
- Rendered with plain `<img>` (no `next/image` remote config). New users without a photo get an initials `Avatar`.

## Accounts
| Email | Password | Notes |
|---|---|---|
| lkspet@gmail.com | PetBnB2026! | Main test account (Lukas, Kaunas, sitter mode ON) |

Email confirmation is enabled — disable in Supabase Dashboard → Auth → Providers → Email if needed.

## Dummy Data (kept)
10 sitter profiles (Jonas, Laura, Marius, Agnė, Tomas, Eglė, Dovilė, Paulius, Rūta, Viktorija) across Vilnius, Kaunas, Klaipėda, Šiauliai, Panevėžys. Rates €10–25. Bios in Lithuanian.
5 dummy owner profiles with 10 pets and 12 bookings. IDs: sitters `11111111-…`, owners `22222222-…`, pets `aaaaaaaa-…`.
**UI chrome is English; user-written content (bios, pet names) stays Lithuanian.**

## Code structure
- `src/lib/types.ts` — shared types + `SERVICE_LABELS`, `PET_TYPE_LABELS`, `STATUS_CONFIG`. (Replaced the old `mock-data.ts`, which is deleted along with all fake arrays.)
- `src/lib/images.ts` — curated marketing/auth imagery.
- `src/components/` — `Avatar`, `SitterCard`, `PetCard`, `Badge`, `Nav`, `Footer`, **`PageHeader`** (display title + subtitle + one optional action), **`EmptyState`** (icon tile + title + description + one CTA). (`StarRating` deleted.)
- Auth: `src/context/AuthContext.tsx`, `src/hooks/useProfile.ts`; profile-completion guard in `src/app/(app)/layout.tsx`.

## Logged-in app shell (added)
- `(app)/layout.tsx` = guard + `FavoritesProvider` + **ambient background** (fixed sage/amber radial blooms) + **`Sidebar`** + `lg:pl-64` content. No top `Nav`/`Footer` in the app (both deleted).
- **`Sidebar.tsx`** — fixed left rail on `lg` (nav incl. **Saved**, one "Find a sitter" CTA, user card + sign out); slide-over drawer on mobile via a top bar + hamburger.
- **Right rail** (`RightRail.tsx`, `hidden lg:block`) on Dashboard/Bookings/Pets: Next booking · Sitter spotlight · Pet-care tip. Pass `showNextBooking={false}` on the Bookings page. Page bodies use `grid lg:grid-cols-[minmax(0,1fr)_19rem]`.
- **Saved sitters feature:** `FavoritesContext` (loads the user's sitter_id set, optimistic toggle) → `FavoriteButton` heart on `SitterCard` (`showFavorite` prop) + sitter profile header → `/saved` page. Verified end-to-end (heart on Browse persists to `/saved` under RLS).
- **Widgets/content:** `SitterMini` (compact sitter card — "Sitters near you", spotlight), `TipCard` + `lib/tips.ts` (curated pet-care tips, reuse verified images), Dashboard welcome **photo banner**.

## Information architecture (de-duplicated — keep it this way)
The booking funnel is **Browse → Sitter profile → "Book {name}" → `/bookings/new?sitter=id`**. `/bookings/new` is the confirm-details step and is reached *only* from a sitter (a bare "New booking" button dead-ends).
- The single top-level action is **"Find a sitter" → /browse**, surfaced once per page (Dashboard quick actions, Bookings header, empty states).
- **Nav has no booking CTA** (it duplicated the Browse link); nav = links + avatar only.
- **One primary action per page** (in `PageHeader` or the empty state). Don't reintroduce duplicate "New booking" / "Book now" buttons.
- App pages share a layout rhythm: `py-10 sm:py-14`, `max-w-{6xl dashboard·browse / 4xl bookings·pets / 2xl profile / xl forms}`, cards `bg-surface rounded-2xl border border-black/5 shadow-sm`, titles `font-display`, neutrals `ink`/`ink-soft`.

## What's Built
- Landing — sage, photography-forward; hero, cities strip, services, **real-sitter showcase (live DB fetch)**, how-it-works, become-a-sitter, FAQ, CTA. No fake stats/reviews.
- Login / signup — photography side panels, honest copy (no fake testimonials).
- Dashboard, Browse (search + city/service/€-rate filters, photo cards), Sitter profile (honest — About, Services & rates, booking CTA; no reviews/credentials), My Pets (photos), Bookings (tabbed, sitter accept/decline/complete), New booking, Profile (personal + sitter settings), Terms.

## De-faked (removed this redesign)
Fake stats (12k/2.4k/4.9★), all fake testimonials/reviews, "ID-verified / DBS background-check" badges, "PetBnB Guarantee", "since 2024", £ currency, UK placeholders, the non-functional profile camera button, `StarRating`/`rating`/`review_count`.

## Kursinis (IoT dog collar) — new track
Graduation has two deliverables done in tandem: this website (bakalauras) and an IoT GPS
dog collar on a Raspberry Pi (kursinis). Collar code lives in `iot-collar/` (separate
Python project, not part of the Next.js app) and talks to the **same Supabase project**.
A collar belongs to a **user account**, not a specific pet — pairing/tracking lives on
the **Profile page** ("My Collars"), independent of the Pets feature.
- **Data path:** GPS module (serial/NMEA) → Pi → BLE GATT peripheral (local pairing) +
  WiFi POST to a `collar-ingest` Edge Function → `collar_locations` table.
- **Security model:** the Pi only knows a per-device `DEVICE_ID`/`DEVICE_SECRET` (bcrypt
  hash checked server-side via `verify_collar_device`); it never holds the service role
  key. `register_collar_device` RPC provisions a new collar for the **calling user**
  (`owner_id` comes from `auth.uid()`, never client input).
- **Supabase objects (live):** tables `collar_devices` (`owner_id → profiles.id`),
  `collar_locations` (`device_id → collar_devices.id`), both RLS owner-scoped SELECT;
  functions `register_collar_device`, `verify_collar_device`; deployed Edge Function
  `collar-ingest` (currently v2).
- **Website integration (done):** Profile → **"My collars"** tab (`src/components/CollarsPanel.tsx`) —
  add-a-collar modal (shows the generated secret once, client-generates it via
  `crypto.randomUUID()`), one card per collar with a `CollarMap.tsx` (Leaflet +
  OpenStreetMap tiles, no API key/billing needed) showing the latest fix, polls every
  30s. Verified end-to-end in the browser: created a collar, POSTed a fix through the
  live `collar-ingest` function via curl (simulating the Pi), confirmed the marker
  rendered with correct last-seen/speed/battery. `tsc --noEmit` and `next build` both
  clean (had to add `iot-collar` to `tsconfig.json`'s `exclude` — its Deno edge function
  file isn't part of the Next.js TS project).
- **Status:** Pi-side code written (`gps_reader.py`, `ble_service.py`, `wifi_uplink.py`,
  `main.py`, systemd unit) and backend deployed + smoke-tested. Not yet run on the
  actual Pi/GPS hardware — see `iot-collar/README.md`. Next real-world step (per the
  user): get the Pi's WiFi uplink talking to the site over a phone hotspot while
  developing, before deploying to the collar full-time.

## What's Next (suggested)
- Real avatar / pet photo **upload** (buckets already exist) → would replace seeded URLs for real users.
- Reviews & ratings system (needs a `reviews` table) — intentionally omitted to stay honest.
- Push to GitHub.
- Map view on browse (Leaflet/Mapbox), sitter availability calendar, email notifications, payments.
- Optional: silence the dev "multiple lockfiles" warning (delete the stray `C:\Users\lkspe\package-lock.json` or set `turbopack.root`).
