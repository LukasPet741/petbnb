-- Applied to production 2026-09-15 as 20260915171205.
-- Superseded by 20260915171817 (the http extension was dropped).
-- Smart-ID demo badge, part 2: the http extension moves to a private schema.
-- Found by the impersonation checks on 2026-09-15, right after smart_id_demo_badge:
--
-- 1. Revoking EXECUTE on the http functions did nothing. Supabase installs extension functions
--    with EXECUTE granted to PUBLIC by supabase_admin, and a grant can only be revoked by its
--    grantor, so `authenticated` could still call extensions.http_get. PostgREST does not expose
--    the extensions schema, so this was not reachable from the API, but nothing should rest on
--    that. A schema that nobody but its owner may USE blocks the call before EXECUTE is checked.
--
-- 2. record_smart_id_demo_verification ran with search_path = '', and the http extension's own
--    SQL wrappers name their types unqualified. On a fresh connection the call failed and every
--    save reported 'provider'. The checks only passed once an earlier call in the same session
--    had cached a plan. The function now runs with the extension's schema as its search_path.

create schema if not exists smart_id_http;
revoke all on schema smart_id_http from public, anon, authenticated, service_role;

drop extension if exists http;
create extension http with schema smart_id_http;

create or replace function public.record_smart_id_demo_verification(p_session_id text)
returns timestamptz
language plpgsql
security definer
set search_path = smart_id_http
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
    perform smart_id_http.http_set_curlopt('CURLOPT_TIMEOUT_MS', '5000');
    select r.status, r.content into v_response
      from smart_id_http.http_get('https://sid.demo.sk.ee/smart-id-rp/v3/session/' || v_session) as r;
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
