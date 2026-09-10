-- Stop the anon role from reading profile columns the public UI never shows.
--
-- The only SELECT policy on public.profiles is `using (true)` for public, which is
-- deliberate: the sitter directory and every sitter profile are visible to signed-out
-- visitors, and that is the product. What was not deliberate is which *columns* came
-- with it. anon held a table-level SELECT grant, so a request for the directory
-- returned all 43 rows complete with phone numbers, smart_id_session_id and the
-- verification fields. Verified against the live API with the anon key before this
-- migration: it answered 200 with a real phone number in the body.
--
-- A column-level REVOKE alone would have done nothing here. Postgres treats the
-- table-level grant as covering every column, so the grant has to be dropped and
-- replaced with an explicit column list.
--
-- Fail-closed is the point: because the grant now names columns rather than the
-- table, a column added later is invisible to anon until someone chooses to add it
-- here. That is the right default for a table holding personal data.
--
-- The application side shipped first, in commit 5ca36b3 — the three pages a
-- signed-out visitor can reach select an explicit column list instead of "*".
-- Order matters: a revoked column makes select("*") an ERROR rather than a quiet
-- omission, so running this against the previous deploy would have broken the site.
--
-- NOT addressed here, and still open: the `authenticated` role keeps its table-level
-- SELECT, so any signed-in user can still read every other user's phone number. RLS
-- cannot express "this column, only on your own row", so closing that needs a
-- public-profile view with the base table locked down, which is a larger change than
-- this one and touches every authenticated query.

revoke select on public.profiles from anon;

grant select (
  id,
  full_name,
  city,
  about_me,
  avatar_url,
  experience_years,
  rate_per_hour,
  services,
  last_active_at,
  is_sitter
) on public.profiles to anon;

comment on column public.profiles.phone is
  'Not readable by anon; see migration 20260910120000. Still readable by any authenticated user.';
