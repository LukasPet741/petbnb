# booking-notify

Supabase Edge Function that turns booking notifications into transactional
email. Deno runtime, service role, no client ever calls it directly.

## What triggers it

A **Database Webhook** on `public.notifications`, `INSERT` only, pointed at this
function. Everything upstream already exists: the booking triggers write the
`notifications` row (and the matching system message), so this function never
creates or interprets a booking — it reads a row that is already committed and
decides whether it deserves an email.

The webhook POSTs the standard Supabase payload:

```json
{
  "type": "INSERT",
  "table": "notifications",
  "schema": "public",
  "record": { "id": "…", "user_id": "…", "actor_id": "…", "booking_id": "…", "type": "booking_accepted", "email_status": "pending", "…": "…" },
  "old_record": null
}
```

Configure it in Studio under **Database → Webhooks**: table `notifications`,
event `Insert`, type `Supabase Edge Functions`, function `booking-notify`. The
`Authorization: Bearer <anon key>` header Studio adds by default is fine; the
function does its own work with the service role key from the environment, not
with whatever the caller presented.

Every run ends by stamping the row it was handed:

| `email_status` | meaning |
| --- | --- |
| `pending` | inserted by the trigger, function has not run (or has not finished) |
| `sent` | Resend accepted the message |
| `skipped` | intentionally not sent — see the skip rules below |
| `failed` | Resend rejected it or threw; `email_error` holds the reason, truncated to 500 chars |

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | yes | Injected automatically in deployed functions. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Injected automatically. Needed for `auth.admin.getUserById` and for writing `email_status` back (clients have no UPDATE policy on `notifications`). |
| `RESEND_API_KEY` | no | Absent or empty ⇒ every notification is marked `skipped` and nothing is sent. That is the intended state for a local or fixture-only environment. |
| `RESEND_FROM_EMAIL` | no | The `From:` address, e.g. `PetBnB <no-reply@yourdomain.lt>`. Must be on a domain verified in Resend. Absent ⇒ same skip as a missing key. |
| `NEXT_PUBLIC_SITE_URL` | no | Base URL for the `…/messages/<booking_id>` link. Falls back to `http://localhost:3000`, so set it in production or the emails will link nowhere. |

Set the two secrets on the deployed function (the `SUPABASE_*` pair is provided
by the platform):

```bash
supabase secrets set RESEND_API_KEY=re_xxx RESEND_FROM_EMAIL="PetBnB <no-reply@yourdomain.lt>" NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

## Skip rules

Nothing is sent, and the row is stamped `skipped`, when any of these hold. The
Resend client is not even constructed in these paths.

1. **`type = "message_received"`.** Chat messages stay in the app. One email per
   chat line is spam in a busy thread and would exhaust the free tier in a day.
   Only the five `booking_*` status events are emailed.
2. **`RESEND_API_KEY` or `RESEND_FROM_EMAIL` is unset or empty.**
3. **No address could be resolved.** `profiles` has no email column, so the only
   source is `auth.users` via `supabase.auth.admin.getUserById(record.user_id)`.
   A deleted user, or one with no email identity, yields nothing to send to.
4. **The address is on an undeliverable domain.** `@petbnb.test`, any `.test`
   TLD, `example.com` / `.org` / `.net` (and subdomains of those), `@localhost`,
   `.localhost`, `.local`, `.invalid`, `.example`.

Rule 4 is a correctness requirement, not tidiness. This project's 40 seeded
fixture accounts all use `@petbnb.test`, and `.test` is an RFC 2606 reserved TLD
that is guaranteed never to resolve. Sending to those addresses would hard-bounce
every time, and bounce rate is precisely what wrecks a sender's reputation with
Resend and the receiving mail providers — poisoning delivery for the real users
too. So the guard runs before the API call, never after it.

A row with no `booking_id`, or with a `type` this function does not recognise, is
also skipped: both mean there is nothing coherent to write an email about.

## Behaviour once it does send

`profiles.locale` of the **recipient** (`'en'` or `'lt'`, defaulting to `en`)
picks the language for the subject, HTML body and plaintext body — both are
written by hand in this file, not machine-translated, and no i18n key from the
app is involved. The email states who did what, to which pet, with the service
and the start/end times, and links to `${NEXT_PUBLIC_SITE_URL}/messages/<booking_id>`.

Times are formatted in `Europe/Vilnius`, not the runtime's UTC — otherwise a
booking that starts at 10:00 in the app would read 08:00 in the email.

## Status codes

The function answers **200 even when the send fails**, recording `failed` plus
the truncated error on the row. A non-2xx makes Supabase retry the webhook, and a
permanently bad address would retry forever; the row is the durable record of the
failure instead.

4xx/5xx are reserved for cases where a retry is the right thing to happen:

- `405` — not a POST.
- `400` — unparseable body, or a payload that carries no `notifications` record.
- `500` — the database could not be read (booking/profile lookup errored), or the
  row could not be stamped `skipped`. Nothing was sent in either case, so a retry
  is harmless.

If the mail is sent but stamping the row afterwards fails, that is logged and the
response is still 200 — a retry there would deliver a second copy.

## Resend needs a verified domain

Until a sending domain is verified in Resend (DNS: SPF/DKIM records on your
domain), the API will only deliver to **the email address of the Resend account
owner**. Everything else comes back as an error and lands in `email_error` as
`failed`. `onboarding@resend.dev` works as a `RESEND_FROM_EMAIL` for that
owner-only testing, but real recipients require your own verified domain.

## Deploy and inspect

```bash
supabase functions deploy booking-notify
supabase functions logs booking-notify
```

Logs carry the notification id, event type, locale, outcome and at most the
recipient's **domain** — never a full address, and never the API key.

Local run:

```bash
supabase functions serve booking-notify --env-file ./supabase/.env.local
curl -X POST http://localhost:54321/functions/v1/booking-notify \
  -H "Content-Type: application/json" \
  -d '{"type":"INSERT","table":"notifications","schema":"public","record":{"id":"<uuid>","user_id":"<uuid>","actor_id":"<uuid>","booking_id":"<uuid>","type":"booking_accepted"}}'
```

With no `RESEND_API_KEY` in that env file, the call marks the row `skipped` and
sends nothing — which is the point.
