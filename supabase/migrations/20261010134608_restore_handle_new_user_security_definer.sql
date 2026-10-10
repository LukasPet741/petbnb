-- Signup has failed since the baseline migration (00000000000000) was replayed on prod after
-- 2026-08-30: it recreates handle_new_user in its pre-fix form, without SECURITY DEFINER, so the
-- trigger ran as supabase_auth_admin, which may not write public.profiles ("permission denied
-- for table profiles", 42501) and the whole signup rolled back. Applied with Lukas's yes, 2026-10-10.
-- search_path is already pinned (20261009161529) and EXECUTE is revoked from public, anon and
-- authenticated (20260830090925), so this only restores what 20260601161429 gave it.

alter function public.handle_new_user() security definer;
