-- Applied to production 2026-09-20 as 20260920175808.
-- From the 2026-09-20 security scan; see docs/security/2026-09-20-hardening.sql §5.
-- Supersedes the function body in 20260915171817; everything except the rate-limit
-- block is that migration's body verbatim.
--
-- request_smart_id_demo_verification checks a signature-free session id, inserts a row
-- that is never pruned, and queues net.http_get to sid.demo.sk.ee. It is granted to
-- `authenticated` with no cap, so one signed-in account in a loop makes the database
-- hammer a third party from the project's own IP and grow a table nobody deletes from.
-- A real demo needs one or two calls; five an hour is far beyond what the page can
-- produce by hand. The hint 'rate_limited' is not mapped in src/lib/smart-id-demo-save.ts,
-- so the page shows its generic error -- fine for a cap nobody should ever reach.
create or replace function public.request_smart_id_demo_verification(p_session_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user    uuid := auth.uid();
  v_session text := lower(p_session_id);
  v_recent  int;
begin
  if v_user is null then
    raise exception 'Sign in to save a verification'
      using errcode = 'insufficient_privilege', hint = 'signed_out';
  end if;

  if v_session is null or v_session !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'Not a Smart-ID session id'
      using errcode = 'check_violation', hint = 'bad_session';
  end if;

  select count(*) into v_recent
    from public.smart_id_demo_sessions
   where user_id = v_user
     and created_at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'Too many Smart-ID demo attempts, try again later'
      using errcode = 'check_violation', hint = 'rate_limited';
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
