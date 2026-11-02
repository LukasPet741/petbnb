# Promoted placement — switching on the first revenue

Code: `src/lib/promote.ts`, `src/components/business/PromoteCard.tsx`, shown on `/business`.
Until step 2 is done, nothing is offered and nothing changes on petbnb.lt.

## Turn it on (about 15 minutes, Lukas only)

1. **Stripe** → Products → add "PetBnB Promoted placement", recurring, €19 / month
   (keep it equal to `PROMOTE_PLAN` in `src/lib/promote.ts`). Create a **Payment Link** for it.
   Under the link's options, collect the customer's name and turn on the customer portal so
   businesses can cancel on their own.
2. **Vercel** → petbnb → Settings → Environment Variables → `NEXT_PUBLIC_PROMOTE_CHECKOUT_URL`
   = the Payment Link URL (Production and Preview). Redeploy: the value is baked in at build.
3. When a payment arrives, Stripe shows the place id as **client_reference_id**. Switch it on:

   ```sql
   update public.places set is_promoted = true where id = '<client_reference_id>';
   ```

   On cancellation, set it back to `false`. The place keeps its tier either way.

Migration `20261103090000_place_promotion_flag.sql` adds `is_promoted`: apply it to prod
**before** deploying this code, or the map falls back to its built-in list and My business
cannot read owned places.

## Before taking real money (not legal advice)

- A legal basis to invoice in Lithuania: *individuali veikla* certificate or *verslo liudijimas*
  (VMI), or a company. Stripe asks for it during account activation.
- VAT: below the €45,000 threshold you are not required to register; say "PVM nemokama" on invoices.
- B2B terms for advertisers (what Promoted gives, price, cancellation) linked from the checkout.
  The ad label ("Reklama" / "Ad") already meets DSA Art. 26 for marking paid placement.
- `PRODUCT.md` describes PetBnB as a student project: update the footer note once it trades.

## Who to offer it to first

Businesses that already claimed their page on `/business` (they see the card), then the two
founding partners. Bookable places can be promoted and keep taking booking requests.
