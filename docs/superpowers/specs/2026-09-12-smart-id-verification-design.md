# Smart-ID identity verification for sitters

**Date:** 2026-09-12
**Status:** approved, spec written — awaiting review before an implementation plan
**Scope:** identity verification only. Smart-ID as a **login method** and the criminal-record
**safety check** are deliberately separate designs; see "Explicitly not in this work".

## Why

`public.profiles` has carried `is_verified`, `verified_at`, `verified_full_name` and
`smart_id_session_id` since `20260621105214`, and that same migration put
`enforce_sitter_verified` on `public.bookings`: **a booking cannot be created unless the sitter
is verified.** Nothing in the application can verify anybody. All 25 catalogue sitters are
seeded `is_verified = true`, so the gate is satisfied entirely by seed data, and no screen ever
reads the flag.

Two things follow. The gate is decorative, and the terms say the opposite of what the schema
implies — "We do not vet, verify, interview or background-check sitters" (`legal.ts:46`, both
languages).

The flag also stopped being forgeable on 2026-09-12: `protect_verification_columns` now refuses
any write to those columns unless the caller is the service role
(`supabase/migrations/20260912210000_protect_verification_columns.sql`, which production records
under its own apply-time stamp `20260912201931` — this project's migration versions never match
their filenames, so look them up by name).
That is what makes this work possible — there is now exactly one way for the flag to become
true, and this spec builds it.

## Decisions

| Decision | Choice | Rejected |
|---|---|---|
| Environment | Smart-ID **demo** now, free and contract-free; production behind an email to SK | Paying the ~€60/month minimum up front; demo-only with no path to production |
| Scope | Identity verification only | Also login; also the criminal-record check; all three at once |
| Demo honesty | A `verification_method` column; the badge says "(demo)" on its face | Flipping the flag silently; hiding the whole flow on a `/dev` route |
| Booking gate | Keep `enforce_sitter_verified`; backfill the 25 seeded sitters as `'seed'` | Drop the trigger and demote verification to a badge; reset the seeds and keep the gate |
| Where the session lives | Supabase Edge Function | A Next API route; calling Smart-ID from the browser |
| Identifying the user | Anonymous device-link flow | The ETSI endpoint, which needs the personal code typed in first |

The anonymous flow matters for more than convenience: the ETSI endpoint makes someone hand over
their national identity number **before** any verification has happened. The anonymous flow gets
the same number back inside a signed certificate, from the identity provider, after the fact.

## Provider facts the plan depends on

External and worth writing down, because the whole design rests on them.

| | Demo | Production |
|---|---|---|
| Base URL | `https://sid.demo.sk.ee/smart-id-rp/v3/` | `https://rp-api.smart-id.com/v3/` |
| RP UUID | `00000000-0000-4000-8000-000000000000` | issued by SK |
| RP name | `DEMO` | the agreed service name |
| Scheme | `smart-id-demo` | `smart-id` |
| Access | open, no agreement | service order + agreement |
| Cost | none | 11 tiers; cheapest €0.109/transaction with a **550-transaction monthly minimum ≈ €60/month**, VAT excluded |

- Endpoints used: `POST /v3/authentication/device-link/anonymous` to start, `GET /v3/session/{sessionID}` to poll. API version 3.2.3.
- A successful authentication returns a certificate carrying **given name, surname, national identity number and country** — which is exactly what `verified_full_name` was added for.
- Demo supports **ADVANCED** certificates only; Basic-level testing needs `support@sk.ee`.
- Lithuanian mock identities exist for every path we must handle: `PNOLT-40404040009-MOCK-Q` (adult), plus dedicated accounts for **user refused**, **timeout** and **wrong verification code**.
- Production requires IP allowlisting or HTTPS pinning. **Neither Vercel nor Supabase Edge Functions offer a static egress IP**, so pinning is the only workable option, and SK recommends it anyway.

## Schema

One column, one small table.

```
profiles
  + verification_method text not null default 'none'
      check (verification_method in ('none', 'seed', 'smart_id_demo', 'smart_id'))

smart_id_sessions                      -- service role only; no user grants at all
  session_id  text primary key         -- the id SK returned
  user_id     uuid not null -> profiles(id) on delete cascade
  created_at  timestamptz not null default now()
  consumed_at timestamptz
```

`smart_id_sessions` exists for one reason: **a poll must not be able to claim someone else's
session.** Without it, anyone who learned a session id could poll it and have that person's
verified identity written onto their own profile. The function looks the session up by id and
refuses unless `user_id` matches the JWT's subject, then stamps `consumed_at` so a session
cannot be replayed.

Backfill, in the same migration:

```sql
update public.profiles set verification_method = 'seed' where is_verified;
```

`is_verified` stays true for those 25 rows, so the catalogue remains bookable and the gate keeps
its guarantee. The badge keys off `verification_method`, so `'seed'` shows nothing.

**`verification_method` must be added to `protect_verification_columns`**, in both the INSERT and
UPDATE branches. It is a verification column in every sense; leaving it out would make it the new
forgeable field and let a user upgrade their own `'seed'` to `'smart_id'`.

## Grants and visibility

```sql
grant select (is_verified, verification_method) on public.profiles to anon, authenticated;
```

and both columns join `PUBLIC_PROFILE_COLUMNS` in `src/lib/types.ts`. Without this the badge
cannot render at all: neither role currently holds SELECT on either column.

`verified_full_name` is **not** granted and never leaves the server. It is a legal name taken
off a certificate; the badge states that an identity was checked, not whose.

Writes stay impossible for users — the trigger, not a grant, is what enforces that, because
column-level `UPDATE` grants break the `/profile` write path (proven on 2026-09-12; see
`20260912210000`).

## The Edge Function

`supabase/functions/smart-id-verify`, beside `booking-notify`, `verify_jwt: true`.

```
POST { action: "start" }
  -> { sessionId, deviceLink, verificationCode, expiresAt }

POST { action: "poll", sessionId }
  -> { state: "running" }
   | { state: "ok", verifiedName }
   | { state: "refused" | "timeout" | "wrong_code" | "error", reason }
```

Rules, in order of importance:

1. **The user is the JWT subject, never a request field.** Nothing in the body identifies a user.
2. The write happens only in `poll`, only after the certificate validates, and only for the user
   recorded in `smart_id_sessions`.
3. On success the service role writes `is_verified`, `verified_at`, `verified_full_name`,
   `smart_id_session_id` and `verification_method` in one update. The trigger permits this
   because `current_user` is `service_role`.
4. Configuration comes from environment variables — `SMART_ID_HOST`, `SMART_ID_RP_UUID`,
   `SMART_ID_RP_NAME`, `SMART_ID_METHOD` — so demo and production differ by configuration, not by
   code. `SMART_ID_METHOD` is the value written to `verification_method`, which is what keeps a
   demo verification from ever claiming to be a real one.
5. Pure logic (certificate parsing, name assembly, status mapping) lives in `lib.ts` beside the
   handler, following `booking-notify`, so it is unit-testable without a network.
6. **The verification code is derived by the relying party, not returned by SK.** In the
   device-link flow we compute the code the user must match against their Smart-ID app from the
   session's own material. SK's overview page does not give the derivation, so it must be taken
   from the RP-API implementation guide at build time rather than guessed: a wrong derivation
   shows the user a code that never matches, which looks exactly like an attack in progress.

## Client

**New:**

- `useSmartIdVerification` — owns both calls and the polling loop: poll every 2s, stop at
  `expiresAt`, surface each terminal state distinctly. Like `useMyReviews`, it reports refusal
  through state rather than throwing, so it returns an explicit success signal; that exact
  mismatch caused a bug in the reviews write flow and is not worth repeating.
- `SmartIdVerification` — the card on the `/profile` **sitter tab**. States: idle → starting →
  waiting (QR plus the verification code, which the user must match in their Smart-ID app) →
  verified / refused / timeout / error, each with its own copy and a retry.
- `VerifiedBadge` — display-only, takes `is_verified` and `verification_method`, renders nothing
  for `'none'` and `'seed'`.

**Changed:** `SitterCard`, `/sitters/[id]` and `(app)/browse/[id]` render the badge;
`PUBLIC_PROFILE_COLUMNS` gains two columns.

**Unchanged:** every other listing, and the whole booking flow. The gate already exists.

## Copy

- **Terms, `sitters` section (EN + LT).** "We do not vet, verify, interview or background-check
  sitters" becomes accurate: identity may be checked through Smart-ID, that check says who
  somebody is and nothing about whether they are good with animals, and in the demo build it
  proves nothing at all. The rest of that paragraph — no interviews, no insurance checks, no
  references — stays exactly as it is, because it remains true.
- **Privacy §2** gains the name and personal identifier Smart-ID returns; **§7** says the badge
  is public while the verified name is not.
- About ten new strings per dictionary, plus the "(demo)" suffix driven by
  `verification_method`. The Lithuanian will again be mine and unproofread, which grows the
  open proofreading thread.

## Rollout

Migration first, and safe in that order — it only adds a column, a table and a grant, so the
deployed app is unaffected. This is the opposite of `20260910170000`, which revoked and therefore
had to follow its deploy.

1. Migration: column, CHECK, backfill, `smart_id_sessions`, trigger update, grants.
2. Deploy the Edge Function with demo configuration.
3. Deploy the app: hook, card, badge, copy.

Rollback is dropping the column and the table; the badge vanishes and the gate returns to
depending on seed data.

## Verification

- **The trigger is re-proven with `verification_method` in it**, using the impersonation harness:
  a user cannot set it, cannot upgrade `'seed'` to `'smart_id'`, and the service role still can.
- **Session binding is proven**: polling a session belonging to another user is refused, and a
  consumed session cannot be replayed.
- **Deno tests** for the pure half of the function — certificate parsing, name assembly, status
  mapping — following `booking-notify/lib.test.ts`.
- **Vitest** for the hook and components, including refusal, timeout and wrong-code, which are
  the states the Lithuanian mock identities exist to produce.
- **The demo flow is exercised end to end** against `sid.demo.sk.ee` with those mock identities,
  including at 390px, since this is a phone-first flow by nature.
- `tsc`, the full suite, and a clean `next build`.
- **No real person's identity is written to production.** The only rows that change are those of
  whoever runs the demo flow on their own account.

## Explicitly not in this work

- **Smart-ID as a login method.** Supabase's custom providers are OIDC/OAuth2 and Smart-ID's
  RP-API is neither, so it needs a backend that verifies the result and mints a Supabase session.
  Its own spec.
- **The criminal-record safety check.** There is no API in Lithuania, and a business may not
  request that data about a third party without a legal basis; the only route is the sitter
  ordering their own certificate and uploading it. That is a document-handling and
  data-protection design, not an integration.
- **Production Smart-ID access.** Gated on SK's answer about non-commercial terms — the email is
  drafted at `docs/smart-id-access-request-email.md`. Until then `SMART_ID_METHOD` stays
  `smart_id_demo`.
- **Verifying owners.** Only sitters are gated today, and nothing in the booking flow asks
  anything of an owner's identity.
