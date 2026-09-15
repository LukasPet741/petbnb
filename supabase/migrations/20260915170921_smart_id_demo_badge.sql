-- Applied to production 2026-09-15 as 20260915170921.
-- Superseded in part by 20260915171205 and 20260915171817: the http extension and
-- record_smart_id_demo_verification were replaced by the pg_net two-step save.
-- Smart-ID demo verification badge.
-- Spec: docs/superpowers/specs/2026-09-15-smart-id-demo-badge-design.md
-- Approved by Lukas 2026-09-15 ("yes do that, push to main when done").
--
-- WHY. The /smart-id-demo page proves the Smart-ID flow against SK's demo service but stored
-- nothing. Now a successful demo saves a verification on the caller's profile: a badge that says
-- "demo" on its face, and is_verified, so a sitter who signs up can finally be booked
-- (enforce_sitter_verified). The 25 seeded sitters keep is_verified under the method 'seed' and
-- get no badge, because nobody verified them.
--
-- TRUST. The browser only hands over a Smart-ID session id. The database asks SK's demo service
-- about that session itself (the http extension), requires COMPLETE / OK for SK's successful test
-- identity, and records the id so it counts once. A completed demo session stays queryable for
-- about four minutes (checked 2026-09-15), and the page saves immediately after it completes.
-- The database does not re-verify SK's signature; the app's server does that before the save.

-- 1. How a profile was verified ------------------------------------------------------------------

alter table public.profiles
  add column if not exists verification_method text not null default 'none'
  constraint profiles_verification_method_check
  check (verification_method in ('none', 'seed', 'smart_id_demo', 'smart_id'));

update public.profiles
   set verification_method = 'seed'
 where is_verified
   and verification_method = 'none';

-- The badge reads these two; the verified name and session id stay private.
grant select (verification_method, verified_at) on public.profiles to anon, authenticated;

create or replace view public.my_profile as
  select id, full_name, phone, city, is_sitter, rate_per_hour, services, about_me, avatar_url,
         experience_years, last_active_at, created_at, updated_at, is_verified, verified_at,
         verified_full_name, smart_id_session_id, locale, prices, verification_method
    from public.profiles
   where id = (select auth.uid());

-- verification_method is a verification column in every sense: without this a user could upgrade
-- their own 'seed' or 'none' to 'smart_id'.
create or replace function public.protect_verification_columns()
returns trigger
language plpgsql
as $function$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_verified, false)
       or new.verified_at is not null
       or new.verified_full_name is not null
       or new.smart_id_session_id is not null
       or new.verification_method is distinct from 'none' then
      raise exception 'Verification columns are set by the identity check, not by the user'
        using errcode = 'insufficient_privilege';
    end if;
  else
    if new.is_verified is distinct from old.is_verified
       or new.verified_at is distinct from old.verified_at
       or new.verified_full_name is distinct from old.verified_full_name
       or new.smart_id_session_id is distinct from old.smart_id_session_id
       or new.verification_method is distinct from old.verification_method then
      raise exception 'Verification columns are set by the identity check, not by the user'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$function$;

-- 2. Sessions used for a verification, each once -------------------------------------------------

create table if not exists public.smart_id_demo_sessions (
  session_id text primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.smart_id_demo_sessions enable row level security;
revoke all on public.smart_id_demo_sessions from anon, authenticated;

-- 3. HTTP from the database, for this one function only -------------------------------------------

create extension if not exists http with schema extensions;

-- Nobody but the function's owner may make the database fetch a URL.
do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure
      from pg_proc p
      join pg_depend d on d.objid = p.oid and d.deptype = 'e'
      join pg_extension e on e.oid = d.refobjid
     where e.extname = 'http'
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', v_fn);
  end loop;
end $$;

-- 4. The save --------------------------------------------------------------------------------------

create or replace function public.record_smart_id_demo_verification(p_session_id text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user     uuid := auth.uid();
  v_session  text := lower(p_session_id);
  v_response record;
  v_body     jsonb;
  v_now      timestamptz := now();
begin
  if v_user is null then
    raise exception 'Sign in to save a verification'
      using errcode = 'insufficient_privilege', hint = 'signed_out';
  end if;

  if v_session is null or v_session !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Not a Smart-ID session id'
      using errcode = 'check_violation', hint = 'bad_session';
  end if;

  -- Recorded first; any failure below aborts the call and takes this row with it.
  begin
    insert into public.smart_id_demo_sessions (session_id, user_id) values (v_session, v_user);
  exception when unique_violation then
    raise exception 'This Smart-ID session was already used'
      using errcode = 'check_violation', hint = 'session_used';
  end;

  begin
    perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
    select status, content into v_response
      from extensions.http_get('https://sid.demo.sk.ee/smart-id-rp/v3/session/' || v_session);
  exception when others then
    raise exception 'The Smart-ID demo service could not be reached'
      using errcode = 'check_violation', hint = 'provider';
  end;

  begin
    v_body := v_response.content::jsonb;
  exception when others then
    v_body := null;
  end;

  if v_response.status is distinct from 200
     or v_body ->> 'state' is distinct from 'COMPLETE'
     or v_body -> 'result' ->> 'endResult' is distinct from 'OK'
     or v_body -> 'result' ->> 'documentNumber' is distinct from 'PNOLT-40404040009-MOCK-Q' then
    raise exception 'Smart-ID did not confirm this session'
      using errcode = 'check_violation', hint = 'not_verified';
  end if;

  update public.profiles
     set is_verified = true,
         verified_at = v_now,
         verification_method = 'smart_id_demo',
         smart_id_session_id = v_session
   where id = v_user;

  return v_now;
end;
$function$;

revoke all on function public.record_smart_id_demo_verification(text) from public, anon;
grant execute on function public.record_smart_id_demo_verification(text) to authenticated;

comment on function public.record_smart_id_demo_verification(text) is
  'Saves a Smart-ID DEMO verification for the caller after asking SK''s demo service that the '
  'session completed OK for the successful test identity; each session once. See migration '
  'smart_id_demo_badge and docs/superpowers/specs/2026-09-15-smart-id-demo-badge-design.md.';
