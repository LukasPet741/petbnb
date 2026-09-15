-- Applied to production 2026-09-15 as 20260915171817.
-- Smart-ID demo badge, part 3: ask SK through pg_net, in two steps; drop the http extension.
--
-- The http extension (parts 1-2) failed intermittently against sid.demo.sk.ee with
-- "OpenSSL SSL_read: SSL_ERROR_SYSCALL, errno 0" on connections it reused, even with keepalive
-- off and three retries (checked 2026-09-15). Too unreliable for a live demo. pg_net, already
-- installed for the notification e-mails, answered 4 of 4 requests correctly. pg_net is
-- asynchronous: its background worker sends the request after the transaction commits and
-- stores the response in net._http_response. So saving is two calls:
--
--   request_smart_id_demo_verification(session)  records the session for the caller, once, and
--                                                queues the GET to SK
--   finish_smart_id_demo_verification(session)   reads SK's answer; 'pending' until it arrives,
--                                                then 'verified' (profile updated) or 'not_verified'
--
-- Only the user who requested a session can finish it, and each session is used once.

drop function if exists public.record_smart_id_demo_verification(text);
drop extension if exists http;
drop schema if exists smart_id_http;

alter table public.smart_id_demo_sessions
  add column if not exists request_id bigint,
  add column if not exists outcome text not null default 'pending'
    constraint smart_id_demo_sessions_outcome_check check (outcome in ('pending', 'verified', 'not_verified')),
  add column if not exists finished_at timestamptz;

create or replace function public.request_smart_id_demo_verification(p_session_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user    uuid := auth.uid();
  v_session text := lower(p_session_id);
begin
  if v_user is null then
    raise exception 'Sign in to save a verification'
      using errcode = 'insufficient_privilege', hint = 'signed_out';
  end if;

  if v_session is null or v_session !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Not a Smart-ID session id'
      using errcode = 'check_violation', hint = 'bad_session';
  end if;

  begin
    insert into public.smart_id_demo_sessions (session_id, user_id) values (v_session, v_user);
  exception when unique_violation then
    raise exception 'This Smart-ID session was already used'
      using errcode = 'check_violation', hint = 'session_used';
  end;

  update public.smart_id_demo_sessions
     set request_id = net.http_get(
           url := 'https://sid.demo.sk.ee/smart-id-rp/v3/session/' || v_session,
           timeout_milliseconds := 5000
         )
   where session_id = v_session;
end;
$function$;

create or replace function public.finish_smart_id_demo_verification(p_session_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user    uuid := auth.uid();
  v_session text := lower(p_session_id);
  v_row     public.smart_id_demo_sessions%rowtype;
  v_status  integer;
  v_content text;
  v_body    jsonb;
  v_now     timestamptz := now();
begin
  if v_user is null then
    raise exception 'Sign in to save a verification'
      using errcode = 'insufficient_privilege', hint = 'signed_out';
  end if;

  select * into v_row
    from public.smart_id_demo_sessions
   where session_id = v_session and user_id = v_user
   for update;
  if not found then
    raise exception 'No verification was requested for this session'
      using errcode = 'check_violation', hint = 'bad_session';
  end if;

  if v_row.outcome <> 'pending' then
    return v_row.outcome;
  end if;

  select r.status_code, r.content into v_status, v_content
    from net._http_response r
   where r.id = v_row.request_id;
  if not found then
    return 'pending';
  end if;

  begin
    v_body := v_content::jsonb;
  exception when others then
    v_body := null;
  end;

  if v_status = 200
     and v_body ->> 'state' = 'COMPLETE'
     and v_body -> 'result' ->> 'endResult' = 'OK'
     and v_body -> 'result' ->> 'documentNumber' = 'PNOLT-40404040009-MOCK-Q' then
    update public.profiles
       set is_verified = true,
           verified_at = v_now,
           verification_method = 'smart_id_demo',
           smart_id_session_id = v_session
     where id = v_user;
    update public.smart_id_demo_sessions set outcome = 'verified', finished_at = v_now where session_id = v_session;
    return 'verified';
  end if;

  update public.smart_id_demo_sessions set outcome = 'not_verified', finished_at = v_now where session_id = v_session;
  return 'not_verified';
end;
$function$;

revoke all on function public.request_smart_id_demo_verification(text) from public, anon;
revoke all on function public.finish_smart_id_demo_verification(text) from public, anon;
grant execute on function public.request_smart_id_demo_verification(text) to authenticated;
grant execute on function public.finish_smart_id_demo_verification(text) to authenticated;

comment on function public.request_smart_id_demo_verification(text) is
  'Smart-ID DEMO badge, step 1: records the session for the caller (once) and queues a pg_net GET '
  'to SK''s demo service. See docs/superpowers/specs/2026-09-15-smart-id-demo-badge-design.md.';
comment on function public.finish_smart_id_demo_verification(text) is
  'Smart-ID DEMO badge, step 2: pending until SK answers; verified only for COMPLETE / OK / the '
  'successful test identity, which sets is_verified and verification_method = smart_id_demo.';
