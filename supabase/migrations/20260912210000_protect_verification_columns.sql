-- Make the verification columns writable only by the identity check itself.
--
-- THE HOLE. public.profiles carries four columns that record the result of an identity
-- check -- is_verified, verified_at, verified_full_name, smart_id_session_id -- and the
-- only policy governing writes is "Users can update their own profile"
-- USING (auth.uid() = id). That is correct for a row you own and says nothing about
-- which columns you may set, so a signed-in user could simply
--
--   PATCH /rest/v1/profiles?id=eq.<self>   {"is_verified": true}
--
-- and award themselves the badge. PROVEN against production on 2026-09-12 by
-- impersonation (set local role authenticated + request.jwt.claims): is_verified went
-- false -> true and verified_full_name became an arbitrary string. The test ended in a
-- RAISE, so it rolled back and nothing was written.
--
-- This is an access gate, not decoration: enforce_sitter_verified on public.bookings
-- refuses any booking whose sitter is not is_verified.
--
-- WHY NOT COLUMN GRANTS. The obvious fix -- revoke UPDATE on those columns and re-grant
-- the rest -- was tried on 2026-09-12 and reverted the same hour. It cannot work here:
-- /profile writes with PostgREST's upsert, and `insert ... on conflict do update`
-- demands privileges a column-level grant does not give it. A trigger sees the values
-- rather than the statement shape, so it is indifferent to how the row is written.
--
-- WHY current_user. PostgREST connects as `authenticator` and assumes the caller's role
-- for the statement, so current_user is 'anon' or 'authenticated' for a browser and
-- 'service_role' for anything holding the service key -- which is exactly the Edge
-- Function that will perform Smart-ID verification. Migrations run as postgres.
--
-- WHY IT COMPARES VALUES RATHER THAN REFUSING OUTRIGHT. handle_new_user inserts a fresh
-- profile row as supabase_auth_admin at sign-up. That insert leaves every verification
-- column at its default, so comparing values lets it through while still refusing a
-- sign-up that tries to arrive pre-verified.

create or replace function public.protect_verification_columns()
returns trigger
language plpgsql
as $body$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false)
       or new.verified_at is not null
       or new.verified_full_name is not null
       or new.smart_id_session_id is not null then
      raise exception 'Verification columns are set by the identity check, not by the user'
        using errcode = 'insufficient_privilege';
    end if;
  else
    if new.is_verified is distinct from old.is_verified
       or new.verified_at is distinct from old.verified_at
       or new.verified_full_name is distinct from old.verified_full_name
       or new.smart_id_session_id is distinct from old.smart_id_session_id then
      raise exception 'Verification columns are set by the identity check, not by the user'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$body$;

drop trigger if exists protect_verification_columns on public.profiles;

create trigger protect_verification_columns
  before insert or update on public.profiles
  for each row execute function public.protect_verification_columns();

-- These three comments were written by 20260912200932, which was reverted by hand the
-- same day; they claimed a service-role-only restriction that did not exist until now.
comment on column public.profiles.is_verified is
  'Identity-check result. Gates booking creation through enforce_sitter_verified. '
  'Writable only by the service role, enforced by the protect_verification_columns '
  'trigger; see migration 20260912210000.';

comment on column public.profiles.verified_full_name is
  'The name the identity provider returned, not the name the user typed. Writable only '
  'by the service role; see migration 20260912210000.';

comment on column public.profiles.smart_id_session_id is
  'The Smart-ID session that produced the verification. Writable only by the service '
  'role; see migration 20260912210000.';
