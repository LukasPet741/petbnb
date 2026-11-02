# Promoted placement — switching on the first revenue

Code: `src/lib/promote.ts`, `src/components/business/PromoteCard.tsx`, shown on `/business`.
Until step 2 is done, nothing is offered and nothing changes on petbnb.lt.

## Turn it on (about 15 minutes, Lukas only)

1. **Stripe** → Products → add "PetBnB Promoted placement", recurring, €19 / month
   (keep it equal to `PROMOTE_PLAN` in `src/lib/promote.ts`). Create a **Payment Link** for it.
   Under the link's options, collect the customer's name, and set "After payment" to redirect to
   `https://petbnb.lt/business?paid=1` (My business then says the payment is in and hides the
   button, so nobody pays twice while it switches on).
   The advertiser terms promise two things that are Stripe settings, so set them:
   - Settings → Billing → **Customer portal**: on, cancellation **at the end of the billing period**.
   - Settings → Billing → Subscriptions → **Manage failed payments**: after the last retry,
     **cancel the subscription** (a subscription left past_due counts as paying).
2. **Vercel** → petbnb → Settings → Environment Variables → `NEXT_PUBLIC_PROMOTE_CHECKOUT_URL`
   = the Payment Link URL (Production and Preview). Redeploy: the value is baked in at build.
3. **Automatic switch-on** (recommended): set up `supabase/functions/stripe-promote` as its
   README says (two Supabase secrets: the webhook's signing secret and the Payment Link's
   `plink_…` id). Each paid checkout from that link then promotes its place, and a
   cancellation or unpaid subscription switches it off.

   **By hand** instead: Stripe shows the place id as **client_reference_id** on each payment.

   ```sql
   update public.places set is_promoted = true where id = '<client_reference_id>';
   ```

   On cancellation, set it back to `false`. The place keeps its tier either way.

Migration `20261103090000_place_promotion_flag.sql` adds `is_promoted`. Apply it to prod
before the first promotion; the app reads places with or without it, so merge order is free.

## Before taking real money (not legal advice)

- A legal basis to invoice in Lithuania: *individuali veikla* certificate or *verslo liudijimas*
  (VMI), or a company. Stripe asks for it during account activation.
- VAT: below the €45,000 threshold you are not required to register; say "PVM nemokama" on invoices.
- B2B terms for advertisers (what Promoted gives, price, cancellation) linked from the checkout.
  The ad label ("Reklama" / "Ad") already meets DSA Art. 26 for marking paid placement.
- `PRODUCT.md` describes PetBnB as a student project: update the footer note once it trades.

## Running it day to day

`npm run business` (on your machine, against the database in `.env.local`):

- `npm run business`: claims waiting, with the claimant's email and message.
- `npm run business approve <claim id>`: the claimant owns the place and sees the Promote card.
- `npm run business reject <claim id> <reason>`: they read the reason on My business.
- `npm run business promotions`: every subscription and how many are paying.

Needs migrations `20261103100000` and `20261103110000`.

## Who to offer it to first

Businesses that already claimed their page on `/business` (they see the card), then the two
founding partners. Bookable places can be promoted and keep taking booking requests.
