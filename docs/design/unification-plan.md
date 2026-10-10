# PetBnB unification plan

_2026-10-10 · status: phases 0, 1 and 3 built on `agent/unify`, with the UI half of phase 2 (Undo, Confirm,
safe pet removal) and the first screens of phase 4 (browse, booking card, dashboard, request); the ✱ migrations
wait for Lukas · visual companion: the "PetBnB unified design" canvas_

**Goal:** one PetBnB on every screen. The brand (look A, "Calm": a crescent moon keeping watch
over a paw, *Your pet, in good hands*) decides how things look, how they move, and how data is
made and removed. A visitor should feel the same calm care on the landing page, while
bargaining over a price, and when they cancel a stay.

**Rule of thumb for every decision below:** calm beats clever. One clear action per moment, nothing
that jumps, nothing that disappears without saying where it went.

---

## 1. Where we are (audit, 2026-10-10)

Counted over 111 app `.tsx` files (dev sandboxes and tests excluded):

| Area | Today | Why it matters |
|---|---|---|
| Shared building blocks | **none**: no Button, Field, Card, Dialog, Toast, Skeleton | every screen re-invents them, so they drift |
| Buttons | **30** different class strings for the primary button alone; `rounded-full`, `-xl`, `-lg`, `-[var]` all in use | the most-pressed thing looks different on every page |
| Corner radius | **16** variants (6 raw px values); the 2 radius tokens cover 64 of ~350 uses | |
| Type | **18** arbitrary sizes (`text-[11px]`, `[11.5px]`, `[12.5px]`, `[13.5px]` …) beside 11 Tailwind sizes | no scale, and Lithuanian letters suffer below 12 px |
| Surfaces | **13** variants: `glass`, `glass-card`, `bg-surface`, `bg-white` at 8 opacities | cards do not read as one family |
| Colour | **38** raw hex values in 10 files (collar art, maps, Smart-ID phone) | they escape the tokens |
| Focus | **18** focus-style variants | keyboard users meet a different ring on each page |
| Motion | framer-motion in 33 files, presets used in 14; **12** hover/tap scales, **10** durations; reduced motion handled in 9 files | movement feels random |
| Reveal | landing sections are **invisible until scrolled**: blank in screenshots, print and on slow devices | content must never depend on animation |
| Create / erase | `window.confirm` for 2 deletes; **no confirm** for cancelling a booking; undo in 1 place; toast on 1 page | erasing feels either brutal or careless |
| Data | `bookings.pet_id … on delete cascade`: **deleting a pet deletes its bookings**, the sitter's chat, notifications and reviews | another person's history vanishes |
| Feedback | 3 loading styles (22 "Loading…" texts, 15 spinners, 7 skeletons); 14 `role="alert"`, 6 `aria-live` | |
| Layout | page header on 6 of 23 pages; 6 page widths | |
| Photos | the same stock dogs on landing, dashboard and browse covers | it looks staged, not lived-in |
| Dates | native date inputs show `mm/dd/yyyy` in English | wrong for Lithuania |

What is already good and stays: the token set in `globals.css`, Bricolage Grotesque, lucide icons
(59 files, one family), the glass app chrome, LT/EN everywhere, `EmptyState`, `PageHeader`,
`lib/motion` (just under-used).

---

## 2. The system

### 2.1 Tokens (all in `globals.css`, nothing raw in components)

**Colour by role.** The palette is the brand's; components use roles.

| Role | Token | Value | Use |
|---|---|---|---|
| Page | `--canvas` | `#f4f6f4` | page background |
| Card | `--surface` | `#ffffff` | cards, dialogs, inputs |
| Inset | `--surface-2` | `#e9ede8` | wells, unselected chips, skeleton |
| Brand moment | `--linen` | `#f6f3ec` | hero panels, empty states, the welcome |
| Text | `--ink` / `--ink-soft` | `#131a17` / `#56635c` | body / secondary (both ≥ 4.5:1 on canvas) |
| Action, selected, success | `--brand` / `--brand-strong` / `--brand-soft` | `#1f5c47` / `#153f2f` / `#dfe9e2` | primary buttons, **every selected state**, done |
| Live, new, warmth | `--amber` / `--amber-strong` / `--amber-soft` | `#dc9a35` / `#8a5c1f` / `#faf1de` | the paw, live collar, unread, "waiting on you" |
| Instrument | `--slate` / `--slate-soft` | `#3f6472` / `#e4eaec` | maps, collar data |
| Danger | `--danger` / `--danger-soft` | `#b8443a` / `#f6e5e2` | erase, errors |

Selected is always brand green, never black (browse's "All services" chip is ink today).

**Type scale.** Display face for the top three steps only; body face for the rest. 12 px is the floor.

| Step | Size / line | Face | Use |
|---|---|---|---|
| `display` | 56 / 60 | display 700 | landing hero only |
| `title-1` | 40 / 44 | display 700 | public page titles |
| `title-2` | 32 / 38 | display 700 | app page titles (`PageHeader`) |
| `title-3` | 22 / 28 | display 700 | section headings |
| `lead` | 18 / 28 | body 500 | intros, card titles |
| `body` | 16 / 24 | body 400 | text |
| `small` | 14 / 20 | body 400–600 | meta, buttons, labels |
| `caption` | 12 / 16 | body 600 | chips, timestamps |

Every `text-[Npx]` maps to the nearest step: 13–13.5 → `small`, 9.5–12.5 → `caption`.
Body face: Figtree (look A) once the switch item lands; Inter until then.

**Space** on a 4 px grid, Tailwind steps 1 2 3 4 6 8 12 16 24 only.
**Radius, four values:** `--radius-control` 12 px (inputs) · `--radius-card` 20 px (cards, dialogs)
· `--radius-hero` 28 px (hero and brand panels) · pill (`rounded-full`: buttons, chips, badges, avatars).
**Elevation, three levels:** flat (hairline border) · raised (`--shadow-sm`, cards) · floating
(`--shadow-lg`, dialogs, sheets, toasts). Cards use the existing `glass-card` material: it is the
documented default card and its contrast is tested (glass-system.test.ts). What goes is the ad-hoc
`bg-white/NN` surfaces beside it; dialogs, sheets, toasts and inputs stay opaque `--surface`.
**Widths, three:** `narrow` 720 px (forms, legal, brand) · `app` 1120 px (default) · `wide` 1280 px (browse, landing).

### 2.2 Motion: "Calm"

Tokens: `--dur-press` 120 ms · `--dur-quick` 200 ms · `--dur-calm` 320 ms · `--dur-slow` 500 ms;
`--ease-calm` `cubic-bezier(0.22, 1, 0.36, 1)` (arrive) · `--ease-out` `cubic-bezier(0.4, 0, 1, 1)` (leave).
Named motions in `lib/motion.ts`, the only place framer-motion values live:

| Motion | What | When |
|---|---|---|
| `arrive` | fade + rise 8 px, calm | a created thing appears; dialogs, toasts, pages |
| `depart` | fade + scale to 0.98, quick, then the gap closes | an erased thing leaves |
| `press` | scale 0.97, press | any button or chip |
| `lift` | rise 2 px + raised→floating shadow, quick | hoverable cards (pointer devices only) |
| `reveal` | `arrive` with a 60 ms stagger | lists entering the screen |
| `swap` | cross-fade, quick | tab and filter changes |
| `watch` | the mark's moon breathes (opacity 1↔0.7, 1.6 s) | the one loader for waits longer than 400 ms |

Rules: one thing moves per action. Text never animates its layout. **Content is visible without
the animation**: `reveal` starts at opacity ≥ 0.4, a safety timer shows anything still hidden after
1.5 s, and print and reduced motion skip it. `prefers-reduced-motion` turns every motion into a
120 ms fade, once, through one `MotionConfig` at the root.

### 2.3 Building blocks (`src/components/ui/`)

| Block | Variants | Replaces |
|---|---|---|
| `Button` | primary · secondary · ghost · danger; sm 36 / md 44 / lg 52; `loading` (moon spinner inside, label stays) | 30 primary strings, every `motion.button` |
| `IconButton` | same, square, `aria-label` required | heart, bell, close, message icons |
| `Card` | raised (`glass-card`) · flat · interactive (`lift`) | `bg-white/*` and `bg-surface` used as cards |
| `Field` | wraps `Input`, `Textarea`, `Select`, `DateInput` with label, hint, error, counter | 30 inputs with 3 signatures; native `mm/dd/yyyy` |
| `Chip` | filter (toggle, brand when selected) · info | browse filters, service chips |
| `StatusPill` | one per booking status, from `STATUS_CONFIG` | ad-hoc pills |
| `Promise` | Smart-ID verified · Live location · Agreed price (icon + fixed name, from `/brand`) | scattered badges |
| `Dialog` + `Confirm` | Confirm: title states the consequence, danger button names the act | `window.confirm`, collar dialogs |
| `Sheet` | bottom sheet under 640 px, side panel above | mobile forms and filters |
| `Toast` | info · success · error on a pine (`--brand-strong`) surface; **Undo** (5 s) and **Retry** are underlined text actions, never a filled amber pill on a dark bar (that pairing reads as another site's logo) | `SuccessToast` |
| `Skeleton` | the shape of the content it stands for | 22 "Loading…" texts, page spinners |
| `EmptyState` | linen panel, line illustration from the mark, one action | stays, gains the illustration |
| `PageHeader` | `title-2`, optional lead and one action | on all 23 pages |

### 2.4 Creating and erasing: one lifecycle

**Creating** always goes: an obvious entry point (the empty state, or one primary button in the page
header) → a form in a page (wide forms) or a `Sheet` (short ones) → validation shown in the field
as you leave it → the button shows `loading` → the new thing `arrive`s where it lives, highlighted
for 2 s in brand-soft → a success toast says what happened in a few words.

**Erasing** has three kinds, chosen by who loses what:

| Kind | When | How |
|---|---|---|
| **Undo** | only you lose it, and it can come back (favourite, notification, day off, draft, a photo before saving) | erase at once, `depart`, toast with **Undo** for 5 s |
| **Confirm** | someone else is affected, or it cannot come back (cancel or decline a booking, unpair a collar, remove a pet with history) | `Confirm` dialog: the title names the consequence ("Cancel Rudis's stay with Karolis? Karolis gets an email."), the danger button repeats the verb, focus starts on the safe choice |
| **Archive** | the record is part of someone else's history | it leaves *your* lists and is kept for theirs: never a hard delete |

**Lifecycle of each kind of data** (✱ = needs a migration and Lukas's yes):

| Data | Created from | Changed | Erased |
|---|---|---|---|
| Account | sign-up | profile page | **Confirm** with typed name → anonymise profile, keep bookings for the other party ✱ (GDPR right to erasure; export too) |
| Pet | Pets → Add pet, or inside a booking request | edit page | no bookings → **Confirm** (the photo cannot come back); has bookings → kept, the page says why (built), then **Archive** (`archived_at`) ✱ with the cascade from `bookings.pet_id` turned into `restrict` ✱ |
| Booking | sitter profile → request (Sheet) | offers in chat; dates only before accepted | never deleted: cancel / decline are status changes behind **Confirm** |
| Offer | the chat | a counter-offer replaces it | withdrawn by a newer one; history stays visible |
| Message | the chat | not editable | not erasable (it is the other person's record too) |
| Review | after a completed stay | edit for 14 days | **Confirm**; the stars stay counted until it is gone |
| Favourite | the heart | | **Undo** |
| Day off | the calendar | | **Undo** |
| Collar | pairing wizard | name | unpair: **Confirm** (live fixes stop) |
| Collar fixes, recordings | the collar | | kept 30 days, then removed; a recording only with **Confirm** |
| Notification | the system | read / unread | mark read (no erase) |

Each erase says what happens in the same sentence, in LT and EN.

### 2.5 Words and pictures

Lithuanian first, then English. Calm, plain, second person, no exclamation marks. Buttons are verbs
("Add pet", "Send request", "Cancel stay"). The three promises always use their `/brand` names.
Dates and times in the reader's locale (`2026-10-12` / `spalio 12 d.`), never `mm/dd/yyyy`.
Photos: each image is used on one surface only; real-looking, daylight, eye level with the pet. Empty
states and onboarding use one line-illustration family drawn from the mark (moon, paw, collar).

---

## 3. The welcoming marketplace, screen by screen

| Journey step | What changes |
|---|---|
| **Landing** | linen hero with the mark, one search field (city + dates), the three promises as a row, real sitter faces, "How a booking happens" as three calm cards; reveal never hides content |
| **Browse** | one filter bar of `Chip`s and `DateInput`s that collapses into a `Sheet` on phones; sitter cards = photo, face, name, city, from-price, rating, promise badges, all one `Card`; skeleton cards while loading; empty result with a reset action |
| **Sitter profile** | hero with face, name and promises; a sticky request panel (dates, pet, price) on desktop and a bottom bar on phones; availability calendar, reviews with "Verified stay" |
| **Request & offer** | the request is a `Sheet` over the profile; offers in the chat share one Offer card; accepting confirms with the agreed price spelled out |
| **Bookings** | one `BookingCard` family with `StatusPill`, `Promise` badges and the calendar file; cancel and decline behind `Confirm` |
| **During the stay** | dashboard leads with today's stay; the collar map is the hero when live (amber pulse = live) |
| **After** | review prompt as a calm card, not a modal |
| **Pets, profile, saved** | same `PageHeader`, `Card`s and lifecycle rules; pets with history archive |
| **Auth, legal, brand** | linen side panel with the mark; `narrow` width |

---

## 4. Keeping it unified (guards)

A test file `src/__tests__/design-guards.test.ts` fails the build when app code (outside an
allowlist: maps, collar art, OG image) contains:

- a raw hex colour, a `text-[Npx]` size, a `rounded-[Npx]` radius, or a `bg-white/NN` surface
- `window.confirm(`, or a `framer-motion` import outside `lib/motion` and `components/ui`
- a `<button>` styled with `bg-brand` instead of `Button`

It starts as a ratchet: today's counts are the ceiling, and every merge may only lower them. The
monitor gets a "Design system" dot; each screen is checked at 390 px and 1280 px before review.

---

## 5. Phases (each one a board item, built by the drive)

| # | Item | Effort | Done when |
|---|---|---|---|
| 0 | **Tokens + guards**: role tokens, type/radius/motion tokens, `design-guards` ratchet | S | guards run in `vitest`; counts recorded |
| 1 | **Building blocks**: Button, IconButton, Card, Field (+DateInput), Chip, StatusPill, Promise, Dialog/Confirm, Sheet, Toast (+Undo), Skeleton, the `watch` loader | M | each block tested (roles, focus, reduced motion); `/brand` shows them |
| 2 | **Create & erase**: the lifecycle on pets, bookings, favourites, days off, collar, reviews; pet archive + `restrict` ✱; account delete + export ✱ | M | no `window.confirm`; every erase is Undo, Confirm or Archive; the cascade is gone |
| 3 | **Motion**: `MotionConfig`, named motions, reveal fix, replace inline scales/durations | S | 1 set of values; landing visible in a full-page screenshot |
| 4 | **Screens**, in demo order: browse → sitter profile + request → bookings → dashboard + collar → pets/profile/saved → auth/legal | L (one item per row) | guard counts at zero for that screen; 390 + 1280 px checked |
| 5 | **Body face Figtree** (already proposed) | S | after phase 1, one pass at 390 px |
| 6 | **Words and pictures**: LT proofread, locale dates, one photo per surface, empty-state illustrations | M | native speaker read; no repeated photo |

**Order and time.** Phases 0–3 first (about two weeks of drive runs), then phase 4 in demo order,
so the defence path (browse → profile → request → booking → live collar) is unified first. The full
thesis is due 2026-12-18; phases 0–4 should land before mid-November and leave December for writing.

**Risks.** Class-asserting tests (e.g. `presentational.test.tsx`) will change with the blocks, as
intended. The paused mobile refactor overlaps phase 4: its three remaining lenses become part of each
screen item. Every migration needs Lukas's yes (✱).
