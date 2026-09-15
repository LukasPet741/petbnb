# Sitter pricing by period, and offers between owner and sitter

2026-09-15 · approved in chat by Lukas, section by section · status: building

## Why

Every sitter has one `rate_per_hour` for every service. A two-day boarding request shows €624,
which no one would pay and no sitter would ask. Bookings store no price at all: the form's total
is an estimate that vanishes. Lukas wants sitters to price a length of time they choose, and the
owner and sitter to settle the real price between them, the way Vinted offers work.

## Decisions (Lukas)

1. **Price for a period.** Per service the sitter sets a whole-euro price and a period from a
   fixed list: 1 day, 3 days, 1 week, 10 days, 2 weeks, 1 month.
2. **The period price is the minimum.** A stay shorter than the period costs the full period
   price; a longer stay is the price stretched: `max(amount, round(amount × days / period))`.
3. **Grooming** has one fixed price per visit and is never bargained over. Its fuller design is later.
4. **Bartering happens inside the request**, as offers in the booking's chat (approach A: an offer
   is a kind of message).
5. **Light guard rails**, enforced by the database.
6. **Offers notify in the app only**; the email service is not changed.
7. Lukas's "apply and push" (2026-09-15) is the yes for the production migration, the seed
   prices and the booking backfill.

## Words

- **Asking price**: what the sitter's price list says for this stay. Frozen on the booking when
  the request is made.
- **Offer**: a message carrying an amount and an optional note.
- **On the table**: the newest offer's amount, or the asking price when there is no offer.
- **Agreed price**: the amount on the table when the booking was confirmed. Locked afterwards.

## Rules

**Days.** Every started 24 hours is a day, minimum 1 ("skaičiuojama paromis"). Mon 09:00 → Mon
17:00 = 1; Mon 09:00 → Tue 09:00 = 1; Mon 09:00 → Wed 18:00 = 3.

**Asking price.** `grooming`: its visit price. Otherwise `max(amount, round(amount × days / period))`.
A service the sitter offers but has not priced cannot be requested.

**Offers**, while the booking is `pending`, is not grooming, and has not started (15 minutes' slack):

| | Owner | Sitter |
|---|---|---|
| Amount | ≥ ceil(asking / 2) and < asking, and below the sitter's most recent counter if there is one | < asking, and above the owner's most recent offer if there is one |
| Count | at most 3 per booking, the offer sent with the request included | at most 3 per booking |

A new offer from either side replaces what is on the table; older offers show as replaced.

**Accepting** (the booking moves `pending → signed` with `agreed_price` = the amount on the table):

- The **sitter** accepts when nothing or the owner's offer is on the table.
- The **owner** accepts when the sitter's counter is on the table.
- The accept must carry the amount the person saw. If the table changed, the database refuses
  with hint `price_changed` and the UI refreshes.
- A status-only accept (today's live UI) is still allowed while no offer exists, and records the
  asking price, so the live site keeps working between migration and deploy.

Declining, cancelling and completing are unchanged.

## Database (one migration)

- `profiles.prices jsonb not null default '{}'`, checked by `public.valid_prices(jsonb)`:
  `walking | boarding | daycare → {"amount": 1..10000, "days": 1|3|7|10|14|30}`,
  `grooming → {"amount": 1..10000}`. `grant select (prices)` to `anon, authenticated`; added to
  the `my_profile` view.
- `bookings.days int`, `asking_price int`, `agreed_price int` (nullable, each ≥ 1 when set).
- `messages.kind` gains `offer`; `messages.amount int`; shape: an offer has an amount 1..10000, no
  event, and an optional note of 1..280 non-blank characters in `body`. `event` gains `agreed`.
- `notifications.type` gains `offer_received` and `price_agreed`.
- `public.stay_days(start, end)` and `public.asking_price_for(sitter, service, days)`.
- `enforce_booking_rules`: on insert sets `days` and `asking_price` (refuses an unpriced service),
  clears `agreed_price`; on update keeps `days`/`asking_price` immutable and allows `agreed_price`
  only on the accept edges above.
- `enforce_offer_rules` (before insert on messages, kind `offer`, security invoker): locks the
  booking row and applies the offer rules. New insert policy for `kind = 'offer'`.
- `on_message_insert`: an offer always notifies the other party (`offer_received`), no collapsing.
- `on_booking_event`: when the owner is the one who confirmed, the sitter gets `price_agreed` and
  the thread gets the `agreed` event; a sitter's accept is unchanged.
- `public.create_booking_request(...)` (security invoker): inserts the booking and, if given, the
  owner's first offer, in one transaction.
- Data: prices for existing sitters derived from their old hourly rate r — walking `round(0.6r)`
  per day, daycare `round(1.1r)` per day, boarding `3 × round(1.5r)` per 3 days, grooming
  `round(1.4r)` per visit; existing bookings get `days`, `asking_price`, and `agreed_price =
  asking_price` when signed or completed. `rate_per_hour` stays, unused, until a cleanup migration.

## App

- `src/lib/pricing.ts`: the same rules as pure functions (days, asking price, daily rate,
  cheapest daily rate, offer bounds, what is on the table, who may accept, offers left). The UI
  never decides alone; it mirrors the database so buttons only appear when they will work.
- **Profile form**: price + period per offered service, visit price for grooming, all required.
- **Cards and profile**: "nuo 25 € / d." (cheapest daily rate, or the filtered service's); a
  groomer-only sitter shows the visit price; the profile lists each service as set with "≈ X € / d.".
- **/browse**: price caps and the price sort work per day (10, 20, 30, 50 €).
- **/bookings/new**: days, asking price, and "send at the asking price" or "make an offer"
  (bounded input, optional note); submits through `create_booking_request`.
- **/bookings**: "Prašoma / Siūloma / Sutarta X €"; accept buttons name the amount and only show
  for the side allowed to accept.
- **Chat**: a price bar (asking, on the table, offers left), offer cards with accept and counter for
  the other side on the newest offer, replaced offers greyed, the agreed price once confirmed.
- **Notifications**: "{actor} atsiuntė kainos pasiūlymą", "{actor} sutiko su jūsų kaina", with the
  pet and service on the line under them.

## Testing

- Unit tests for `pricing.ts` covering every rule above, written first.
- Component tests for the price inputs, the request price box, offer cards and the bookings price line.
- The migration verified against the production catalogs, then every rule exercised by
  impersonating an owner and a sitter inside a transaction that is rolled back.
- `vitest`, `tsc`, `next build`; the pages checked in a browser at desktop and phone width.

## Out of scope

Payments (none exist), grooming's fuller design, emails for offers, dropping `rate_per_hour`.
