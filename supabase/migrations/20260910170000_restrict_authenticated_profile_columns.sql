-- Stop signed-in users from reading each other's phone numbers.
--
-- Migration 20260910120000 did this for anon and said plainly what it was leaving
-- open: "the `authenticated` role keeps its table-level SELECT, so any signed-in user
-- can still read every other user's phone number." This closes that half.
--
-- The exposure was not theoretical. Six client queries selected "*" from profiles and
-- shipped the result to the browser of every signed-in visitor:
--
--   (app)/browse/page.tsx        every sitter
--   (app)/browse/[id]/page.tsx   one sitter
--   (app)/dashboard/page.tsx     eight sitters
--   (app)/bookings/new/page.tsx  the sitter being booked
--   (app)/saved/page.tsx         via an embedded profiles(*)
--   components/RightRail.tsx     sitters with avatars
--
-- Each of those now names PUBLIC_PROFILE_COLUMNS instead. That is the prerequisite,
-- not the fix: without the grant change below, anyone could still read the columns
-- straight from the REST API with their own token.
--
-- ORDER OF OPERATIONS — this migration must be applied only AFTER the application
-- change is deployed. A revoked column turns select("*") into an ERROR rather than a
-- quiet omission, so running this against the current production deploy would break
-- browse, the dashboard, saved and the booking form for every signed-in user. The
-- same trap caught the anon half; see the note in 20260910120000.
--
-- WHY A VIEW. /profile has to read your own phone number to put it in the form, and
-- useProfile has to see it to decide whether your profile is complete. RLS is
-- row-level and column grants are role-level, so neither can express "this column,
-- but only on your own row". public.my_profile is the standard way to bridge that:
-- it runs with the privileges of its owner rather than the caller, which is exactly
-- why it can see a column the caller's own grant excludes, and it is safe because the
-- filter is baked into the view rather than supplied by the caller. It can return one
-- row -- yours -- or none.
--
-- EXPECT A NEW ADVISOR WARNING. Supabase's linter flags any postgres-owned view
-- without security_invoker as a "security definer view". That is this view, by
-- design, and the warning is the price of the pattern. The alternative with no
-- elevated object at all is to move phone into a separate profile_private table keyed
-- by id with its own `id = auth.uid()` policy. That is the better end state and a
-- larger change: it moves a live column, rewrites the /profile write path and needs a
-- data migration. Worth doing when phone stops being the only private column.

revoke select on public.profiles from authenticated;

-- The same ten columns anon may read. Fail-closed for the same reason: because the
-- grant names columns rather than the table, a column added later is invisible to
-- authenticated until someone chooses to add it here.
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
) on public.profiles to authenticated;

-- Your own row, in full. `(select auth.uid())` rather than a bare call so the planner
-- evaluates it once as an InitPlan instead of once per row.
create or replace view public.my_profile as
  select * from public.profiles where id = (select auth.uid());

-- Read-only on purpose. Writes keep going to public.profiles, where the existing
-- "Users can update their own profile" policy governs them.
revoke all on public.my_profile from anon, authenticated;
grant select on public.my_profile to authenticated;

comment on view public.my_profile is
  'The calling user''s own profile row, all columns. Exists because authenticated '
  'holds a column-level SELECT grant on public.profiles that excludes phone, and '
  'neither RLS nor a column grant can scope a column to a single row. Deliberately '
  'not security_invoker: it needs the owner''s privileges to see phone, and it is '
  'safe because the where clause is fixed at id = auth.uid(). See migration '
  '20260910170000.';

comment on column public.profiles.phone is
  'Readable only by its owner, through public.my_profile. Neither anon nor '
  'authenticated holds a SELECT grant on this column; see migration 20260910170000.';
