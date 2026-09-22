-- Applied to production 2026-09-20 as 20260920175605.
-- From the 2026-09-20 security scan; proposal and reasoning: docs/security/2026-09-20-hardening.sql §1.
--
-- Two storage buckets exist in production but in no migration and in no line of app
-- code (the app uses 'photos', and only 'photos'). Their policies never got the
-- per-user folder rule that 'photos' has: any authenticated account could write any
-- path in them and overwrite anyone else's object, and both buckets are public with no
-- size limit and no MIME allowlist -- free file hosting and a stored-XSS surface.
--
-- Dropping the policies is what closes it: storage.objects has RLS on, so with no
-- policy naming these buckets, nothing but the service role can read or write them.
-- The empty bucket rows themselves are removed through the Storage API, which refuses
-- to let SQL delete them (storage.protect_delete). Both held 0 objects on 2026-09-20.
drop policy if exists "Auth upload avatars"     on storage.objects;
drop policy if exists "Auth update avatars"     on storage.objects;
drop policy if exists "Public read avatars"     on storage.objects;
drop policy if exists "Auth upload pet images"  on storage.objects;
drop policy if exists "Auth update pet images"  on storage.objects;
drop policy if exists "Public read pet images"  on storage.objects;
