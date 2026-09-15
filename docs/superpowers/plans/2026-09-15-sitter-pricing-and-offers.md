# Sitter pricing and offers — Implementation Plan

> Executed inline in the session that wrote it (Lukas: "apply the fixes then push to main").

**Goal:** replace the hourly rate with per-period prices and let owner and sitter agree a price
through offers in the booking chat.

**Architecture:** the database owns every rule (triggers on `bookings` and `messages`, one request
RPC); `src/lib/pricing.ts` mirrors the same rules as pure functions so the UI only shows actions
that will succeed. Offers are messages of kind `offer`, so they reuse the thread's realtime,
ordering, read state and notifications.

**Tech stack:** Next.js (app router, client pages), Supabase Postgres + PostgREST + realtime,
Vitest + Testing Library, Tailwind v4, LT/EN i18n.

**Spec:** `docs/superpowers/specs/2026-09-15-sitter-pricing-and-offers-design.md`

## Global constraints

- Whole euros, 1..10000. Periods 1, 3, 7, 10, 14, 30 days. Grooming: visit price, no offers.
- Asking price = `max(amount, round(amount × days / period))`; days = started 24 h, minimum 1.
- Owner offer ≥ ceil(asking/2) and < asking and < sitter's most recent counter; sitter counter <
  asking and > owner's most recent offer; 3 offers per side; pending, not grooming, not started.
- LT/EN parity test must pass; `database.types.ts` is regenerated, never hand-edited.
- Never `git add -A`; never commit `src/app/dev/`.

## Tasks

### Task 1: `src/lib/pricing.ts`
- Test: `src/lib/__tests__/pricing.test.ts`, written first: `stayDays` (24 h blocks, min 1, invalid
  → null), `askingPrice` (minimum period, stretch, rounding, grooming, unpriced → null),
  `dailyRate`, `cheapestDailyRate` (offered + priced only, grooming excluded, service filter),
  `validPrices`, `negotiation` (table amount and owner, offers left), `offerBounds` (every bound
  above, null when impossible), `canAccept`.
- Produces: `PERIOD_DAYS`, `MAX_PRICE`, `MAX_OFFERS_PER_SIDE`, `OFFER_NOTE_MAX`, types
  `PeriodDays`, `PeriodPrice`, `SitterPrices`, `OfferLike`, `Negotiation`, `Role`, and the functions.

### Task 2: migration + production
- File: `supabase/migrations/<stamp>_sitter_pricing_and_offers.sql` (columns, checks, grants, view,
  `stay_days`, `asking_price_for`, rule triggers, offer policy, notify triggers,
  `create_booking_request`, seed prices, booking backfill).
- Apply with `apply_migration`; verify catalogs; exercise every rule by impersonation inside
  `begin … rollback`; exercise the live site's old writes (status-only accept, plain insert).
- Regenerate `src/lib/database.types.ts`; update `src/lib/types.ts` (`Profile.prices`,
  `Booking.days/asking_price/agreed_price`, `MessageKind` `offer`, `Message.amount`,
  `SystemEvent` `agreed`, `NotificationType` two new) and `PUBLIC_PROFILE_COLUMNS` + its test.

### Task 3: prices on cards, profile and /browse
- `SitterCard`, `SitterMini`, `browse/[id]`, `browse-filters.ts` (per-day caps and sort), tests.

### Task 4: sitter profile form
- `profile/page.tsx`: price + period per offered service, visit price for grooming, required;
  saves `prices`. Pure helpers for form ↔ `SitterPrices` in `pricing.ts` with tests.

### Task 5: request form
- `bookings/new/page.tsx` + `BookingSummary.tsx`: days, asking price, send-at-asking or offer
  (bounded amount, optional note), unpriced service blocked; submit via `create_booking_request`.
  Remove the hourly estimate from `booking-duration.ts`. Tests.

### Task 6: bookings list
- `bookings/page.tsx` + `BookingCard.tsx`: fetch offers for listed bookings, price line, accept
  button naming the amount for the side allowed; stale price → refresh + message. Tests.

### Task 7: offers in the chat
- `MessageThread.tsx` (+ small `OfferCard`, `PriceBar` components): cards, replaced state, accept,
  counter form with bounds, agreed price; refetch booking on system messages. Tests.

### Task 8: notification and event text
- `offer_received`, `price_agreed`, event `agreed` in LT/EN; bell/feed/thread. Tests.

### Task 9: verify and ship
- `npx vitest run`, `npx tsc --noEmit`, `npx next build`; browser at 1440 and 390; commit named
  files; push; confirm live; notes.
