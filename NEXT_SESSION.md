# Next Session

> **SUPERSEDED — kept for history, do not plan from this file.**
>
> Written before the test suite, CI and the live deployment existed, and before the current
> design system replaced the one it describes. Concretely: §2 says "zero automated test
> coverage" (there are now 1092 tests), "no CI pipeline, no live deployment" (CI runs on
> every push and the site is live at petbnb.lt), and §3's "Pine, Slate & Bone" palette and
> `FeaturedSitterHero` have both since been replaced.
>
> For setup on a new machine, read `SETUP.md`. For where the project actually stands, read
> the project notes in the Claude memory directory (`SETUP.md` §5 explains how to restore
> them) — or ask Lukas.

Six sections: orientation, graduation readiness, what this session did, what's next, reference data, known issues. This file replaces the previous version (old sage-green palette / old accounts / old dummy-data IDs are all gone — do not trust anything from git history before this rewrite).

---

## 1. Orientation

PetBnB — pet sitter marketplace. Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, Supabase, Framer Motion.
Working directory: `C:\Users\lkspe\petbnb` — run with `npm run dev` (port 3000; kill any stale process on that port first if it warns).
This is a modified Next.js — read `node_modules/next/dist/docs/` before writing framework code (see `AGENTS.md`).

Two graduation deliverables in tandem, per `PRODUCT.md`: this website is the **bakalauras**, and a Raspberry Pi GPS dog collar (`iot-collar/`, separate Python project, same Supabase backend) is the **kursinis**.

## 2. Graduation readiness — honest assessment

**Where it's strong:** the site now has a coherent, deliberate visual identity (not a generic template look), a working two-language UI, and a booking flow whose card design actually reflects the product's own "sitter confirms every booking" mechanic instead of a flat data table. That's a real, defensible design story for a defense.

**Where it's genuinely thin, if your committee cares about it:**
- **Zero automated test coverage.** No unit tests, no E2E tests, nothing. If "how did you verify correctness" comes up, the honest answer right now is "manual testing + `tsc`/`next build`."
- **No CI pipeline, no live deployment.** Everything only runs on this machine (`localhost:3000`). Worth at minimum a Vercel deploy with the real Supabase project before a defense — examiners usually want to click something.
- **The Smart-ID verification system is unexplained** (see §6) — a professor poking at the schema will find `is_verified`/`smart_id_session_id` columns with zero UI. Have an answer ready either way.
- **Kursinis hardware status is unconfirmed from this session** — per the pre-rewrite notes, the Pi software was written and backend smoke-tested but not yet run on real Pi/GPS hardware. Confirm this is resolved before assuming the IoT deliverable is done.

You told me there's no fixed rubric, just "features and look and feel" — so treat the above as *optional* hardening, not requirements. But if you don't know your committee's expectations yet, testing + a live deploy are the cheapest credibility wins.

## 3. What this session did

**Visual redesign (full site re-skin).** Palette moved twice: first to a terracotta/clay/cream direction, then — after running the installed `design-taste-frontend` anti-slop skill against it and finding that palette matched a named "banned AI premium-consumer palette" almost hex-for-hex — pivoted to the current **"Pine, Slate & Bone"** system:
- `--canvas:#f4f6f4` `--surface:#fff` `--surface-2:#e9ede8`
- `--brand:#1f5c47` (pine) `--brand-strong:#153f2f` `--brand-soft:#dfe9e2` `--brand-softer:#eef3ef`
- `--ink:#131a17` `--ink-soft:#56635c`
- `--amber:#dc9a35` (sparing accent only — live markers, small highlights)
- `--slate:#3f6472` / `--slate-soft:#e4eaec` (secondary cool accent, reserved for the collar/map "instrument" system)
- Tinted shadow scale `--shadow-sm/md/lg` (always derived from `--ink`, never pure black), `--radius-card:16px`, `--radius-input:12px` — one shape system everywhere.
- Fonts: **Bricolage Grotesque** (`font-display`, replaced Fraunces — also flagged as an overused AI-default serif), **Inter** (`font-sans`, unchanged), **Caveat** (`font-script`, exactly one controlled use: the featured sitter's signed name in the hero — not a general display font).
- New **B-monogram logo** (`src/components/Logo.tsx`) replacing the generic lucide `PawPrint` icon everywhere (header/footer/sidebar).
- New **Atmosphere** component (`src/components/Atmosphere.tsx`) — a fixed, pointer-events-none gradient+grain layer mounted once in `layout.tsx`, giving the app quiet background depth instead of a flat fill.
- Homepage hero rebuilt as `FeaturedSitterHero.tsx` — a "real sitter spotlight": pulls one real sitter from Supabase (highest experience, must have a non-empty bio), shows their actual photo and an excerpt of their real bio as the quote, never fabricated copy. Falls back to an honest generic headline if no eligible sitter exists.
- Collar map (`CollarMap.tsx`, `CollarsPanel.tsx`) got real design attention: custom pulsing live-position marker, two-stroke route line (slate casing + pine line) replacing the default Leaflet pin and a hardcoded hex.

**Full Lithuanian/English i18n.** `src/context/LanguageContext.tsx` (`useLanguage()` hook, `t(key, vars)` with dot-path lookup + `{var}` interpolation, persisted to `localStorage`). Dictionaries in `src/lib/i18n/{en,lt}.ts`, each merging namespaced files (`en|lt/{home,auth,sitters,appShell,appPages,tips}.ts`). Every static string across all 16 routes and shared components is wired — done via 5 parallel subagents extracting/wiring, then every Lithuanian translation written by hand in one pass for tone consistency. `LanguageSwitcher.tsx` lives in `PublicHeader` (marketing pages) **and** `Sidebar` (in-app, both the desktop rail and the mobile top bar — this was missing initially, added after you flagged it). Pet-care tips (`src/lib/tips.ts`) also translated — each tip now has a stable `id`, looked up via `tips.<id>.{tag,title,body}`.

**Standardized booking card system.** Explored 3 directions via the visual companion (photo-split-by-state, ticket-stub, decision-first); you picked **Direction A**. Built `src/components/BookingCard.tsx`: a **pending** booking renders as a large elevated photo-split card (pet photo, dates as the dominant headline, exactly the 1–2 buttons relevant to who's viewing) since it's a real decision; anything **resolved** (signed/completed/declined/cancelled) collapses to a flat, quiet compact row, with a sitter+signed booking getting one small inline "mark completed" action. Wired into `src/app/(app)/bookings/page.tsx`, replacing one giant inline block that used to render all four possible buttons regardless of relevance. Query extended to fetch `pet.photo_url`.

**Database wiped and reseeded** (Supabase project `jktykrbvwgagcjyuxypo`). See §5 for the full account/data reference.

## 4. What's next (not started, in rough priority order)

- **Confirm kursinis hardware status** — was the Pi ever run on real GPS hardware? Not resolved in any session I have context on.
- **Deploy live** (Vercel + this Supabase project) and wire a basic CI workflow (lint/typecheck/build on push) — cheapest credibility win if a committee cares about process.
- **Decide on the Smart-ID verification system** (§6) — build it out, or explicitly scope it as "future work" in the paper. Don't leave it silently unexplained.
- **Feature depth discussed but not started:** in-app messaging between owner/sitter (nothing exists beyond a notes field on the booking), sitter availability calendar (sitters currently just accept/decline ad hoc, no calendar of when they're free), turning raw collar GPS data into computed insights (weekly distance/activity trends — currently it's just a live dot and a route replay).
- **General polish not started:** notification center, a short onboarding flow after signup, dark mode, a settings page beyond the Profile tabs.
- **Apply `next/image`** instead of raw `<img>` across the app — quick, real performance story (LCP, lazy loading) for a defense.
- Minor: silence the dev "multiple lockfiles" warning (stray `C:\Users\lkspe\package-lock.json`, or set `turbopack.root`).

## 5. Reference data

**Supabase project:** `jktykrbvwgagcjyuxypo` (eu-central-1, active). Tables: `profiles`, `pets`, `bookings`, `favorites`, `collar_devices`, `collar_locations` — all RLS. Credentials in `.env.local` (not committed).

**Your real login — untouched, never modify its password from a session:** `lukas.pet210@go.kauko.lt`, id `cb66f14a-eb64-446e-a83d-2e4b675d2116`, full name "Lukas Petkevičius", city Kaunas. Now **is_sitter=true, is_verified=true**, rate €15/hr, offers walking+daycare — flipped this session so you can toggle sitter mode and see every booking-card state. Has 8 bookings seeded: 4 as owner (pending/signed/completed/declined) + 4 as sitter (pending/signed/completed/cancelled) — full coverage of every `BookingCard` variant.

**Second real account, untouched:** `lukas.pet@gmail.com`, id `b21f3610-5878-4dc3-a6e8-d8cd6cf1df41` — incomplete profile (no name/city set), left exactly as found.

**Dummy data (all fresh this session):** 24 sitters + 16 owners = 40 synthetic accounts, emails `firstname.lastname@petbnb.test`, real-feeling Lithuanian names/bios across all 5 cities, rates €13–26. Auth passwords are random unusable hashes — these accounts are fixture data, not meant to be logged into. 34 pets (types/names/bios/weights; dogs have real photos via verified Unsplash URLs, other types use the app's icon fallback rather than mismatched stock photos). Only 8 bookings exist total, all on your account (see above) — no dummy-to-dummy bookings were seeded, since that wasn't asked for.

**Collar hardware data:** 1 `collar_devices` row + 43 `collar_locations` rows, untouched by this session's reseed (real test data from earlier hardware work).

**No passwords are stored in this file.** The previous version of this file had a plaintext password table — don't repeat that pattern; check your password manager or the Supabase Auth dashboard instead.

## 6. Known issues / things to watch

- **Smart-ID verification trigger, undocumented in the app.** `public.bookings` has a `check_sitter_verified` trigger that blocks *any* booking insert (even pending) unless the sitter's profile has `is_sitter=true AND is_verified=true`. Backing columns exist (`is_verified`, `verified_at`, `verified_full_name`, `smart_id_session_id`) suggesting a Lithuanian Smart-ID e-identity flow was planned — but there is no UI anywhere that sets these fields. This directly tensions with `PRODUCT.md`'s stated positioning ("no verification-badge theater, trust through mechanics"). Every seeded sitter this session has `is_verified` force-set to `true` to make bookings work at all — that's a workaround, not a real verification flow. Decide what to do with this before a defense.
- **In-app pages not visually re-verified after this session's changes** (dashboard, bookings, pets, profile, collars) — I don't log in (credential handling policy), so all of this session's in-app work (BookingCard, Sidebar language switcher, tips translation) is verified by `tsc`/`next build` passing, not by seeing it render. Log in and click through before trusting it fully.
- **`.superpowers/` directory** in the repo root holds visual-companion mockup HTML from this session's design exploration (logo concepts, hero directions, card-system comparisons) — already gitignored, safe to delete if you want to reclaim space, or keep for reference.
- Untracked in git as of this session: `.agents/`, `.claude/`, `.impeccable/`, `PRODUCT.md`, `skills-lock.json`, `src/app/sitters/`, `src/components/Public{Header,Footer}.tsx` — some of these (the sitters route, PublicHeader/Footer) are real shipped code that should probably be committed; worth a deliberate `git add` pass rather than a blanket one.
