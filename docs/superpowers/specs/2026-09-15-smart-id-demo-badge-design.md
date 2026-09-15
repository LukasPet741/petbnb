# Smart-ID demo verification badge

2026-09-15 · approved in chat by Lukas ("yes do that, push to main when done") · builds on the
Smart-ID demo page (`979d9f3`) and narrows the 2026-09-12 verification spec to the demo.

## Decisions (Lukas)

1. Finishing the Smart-ID demo **saves a verification** on the user's profile and **turns on
   `is_verified`**, so a newly signed-up sitter becomes bookable (`enforce_sitter_verified`).
2. The save is proven by **the database asking SK's demo service** about the session, not by
   trusting the browser, and each session counts once. No secret keys, no Vercel configuration.
3. Badge: a **pine-green rosette seal** with a white check beside the name everywhere, plus a
   **trust row** on the sitter profile: "Tapatybė patvirtinta per Smart-ID · DEMO · date".
4. It stays a demo anyone can use; the badge says so.

## Facts this rests on (checked 2026-09-15 against sid.demo.sk.ee)

- A COMPLETE session stays queryable at `GET /v3/session/{id}` for at least 4 minutes
  (4 min 3 s: still COMPLETE OK; 7 min: 404).
- The successful test identity returns `result.documentNumber = "PNOLT-40404040009-MOCK-Q"`.
- The `http` extension (synchronous HTTP from SQL) failed intermittently against SK with
  `OpenSSL SSL_read: SSL_ERROR_SYSCALL` on reused connections, even with keepalive off and retries.
  `pg_net` (already installed for the notification e-mails) answered 4 of 4 correctly.

## Database (one migration)

- `profiles.verification_method text not null default 'none'`, CHECK
  `('none','seed','smart_id_demo','smart_id')`. Backfill `'seed'` where `is_verified`.
- `protect_verification_columns` also guards `verification_method`.
- `grant select (verification_method, verified_at)` to `anon, authenticated`; both join
  `PUBLIC_PROFILE_COLUMNS` and the `my_profile` view. `verified_full_name` stays private and is
  not written by the demo (the certificate name is SK's test person, not the user).
- `smart_id_demo_sessions(session_id text primary key, user_id uuid → profiles, created_at)`:
  service-only, no grants; a session id can be recorded once.
- **As built** (migrations `20260915170921`, `20260915171205`, `20260915171817`). The first two
  used the `http` extension (the second moved it to a private schema: revoking its PUBLIC
  execute is impossible for `postgres`, and its wrappers need their schema on the search path);
  the third drops it for the reason above and saves in two security-definer calls, both
  executable by `authenticated` only:
  1. `request_smart_id_demo_verification(session)`: caller signed in, id a UUID, the session
     recorded once for the caller (hint `session_used`), and `net.http_get` to SK's demo service
     queued (sent by pg_net's worker after commit);
  2. `finish_smart_id_demo_verification(session)`: only the requesting user; `pending` until
     `net._http_response` holds SK's answer; `verified` for HTTP 200, `state` COMPLETE,
     `result.endResult` OK and the success test document number, which sets `is_verified`,
     `verified_at`, `verification_method = 'smart_id_demo'` and `smart_id_session_id`;
     otherwise `not_verified`. The session table keeps `request_id`, `outcome`, `finished_at`.

Limit, stated: the database confirms the session with SK over TLS but does not re-verify SK's
signature; the app's server already does that before the page asks to save.

## App

- `VerifiedSeal` (inline SVG rosette, `role="img"`, label "Tapatybė patvirtinta per Smart-ID
  (demo)"), shown beside the name when `verification_method` is `smart_id_demo` or `smart_id`;
  nothing for `none` or `seed`.
- `VerificationRow` on the sitter profile (`/browse/[id]`): shield, text, DEMO tag, date.
- Seal on `SitterCard`, `SitterMini`, `/browse/[id]` and the own `/profile` header.
- `/smart-id-demo`: after an OK result it calls request, then finish until SK has answered, and
  says the badge was added (or why not).
- `/profile` sitter tab card: "Patvirtinta (demo)" once verified.
- Terms (sitters section) and privacy: one sentence each, LT and EN.

## Testing

- Impersonation in a rolled-back transaction: a user cannot set `verification_method` or
  `is_verified`; the RPC refuses a signed-out caller, a malformed id, an unknown session and a
  reused one; a real, freshly completed demo session verifies the caller.
- `http` functions are not executable by `authenticated`.
- Vitest for the seal/row visibility rules, the demo page save states, profile columns.
- Live browser run of the demo page with the save; `tsc`, full suite, `next build`.
