# stripe-promote

Supabase Edge Function that switches Promoted placement on and off from Stripe events
(`docs/promoted-placement.md`). Deno runtime, service role, called only by Stripe.

## What it does

| Stripe event | Effect |
|---|---|
| `checkout.session.completed` / `checkout.session.async_payment_succeeded`, paid, subscription mode, `client_reference_id` = a place id | `start_place_promotion`: records the subscription, promotes the place |
| `customer.subscription.updated` | `set_place_promotion_status`: records the new status |
| `customer.subscription.deleted` | the same, as `canceled` (final) |
| anything else | 200 `ignored` with the reason |

A place is promoted while one of its subscriptions is `active`, `trialing` or `past_due`
(Stripe is still retrying the card). `unpaid`, `paused` and `canceled` switch it off; a later
`active` switches it back on, except after `canceled`.

Stripe does not deliver events in order, so each status is stamped with the event's `created`
time and an older event never overwrites a newer one. A status that arrives before its checkout
(a cancellation overtaking it) is kept, and the checkout picks it up instead of promoting.

## Set it up (Lukas)

1. Apply `20261103090000_place_promotion_flag.sql` and `20261103100000_place_promotions.sql`.
2. Deploy: `npx supabase functions deploy stripe-promote` (`verify_jwt = false` comes from
   `supabase/config.toml`; Stripe sends no Supabase token).
3. Stripe → Developers → Webhooks → add endpoint
   `https://<project-ref>.supabase.co/functions/v1/stripe-promote`, events:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
4. Copy the endpoint's signing secret (`whsec_…`) into Supabase → Edge Functions → Secrets as
   `STRIPE_WEBHOOK_SECRET`. Until it is set, every request is refused.
   Also set `STRIPE_PROMOTE_PAYMENT_LINK` to the Payment Link's id (`plink_…`, on its page in
   Stripe). Only checkouts from that link promote a place: any Payment Link accepts a
   `client_reference_id` in its URL, so a cheaper subscription on the same account must not count.
5. Test from Stripe's dashboard with "Send test event"; the response body says what happened.

## Tests

`lib.test.ts` (Vitest `edge` project) covers the signature check, the event mapping and the
migration's guards. The SQL was also exercised in an embedded Postgres: backfill, resends,
unpaid → active, and a late event after cancellation.
