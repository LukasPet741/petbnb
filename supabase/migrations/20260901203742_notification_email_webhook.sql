-- Database Webhook, hand-rolled: every notifications INSERT is POSTed to the
-- booking-notify Edge Function, which decides whether the row deserves an email
-- and stamps email_status back onto it. This sends the same payload shape as
-- Studio's webhook integration, so booking-notify/index.ts needs no changes.
--
-- pg_net is asynchronous: the request is queued and fired after commit, so a
-- slow or dead function never blocks the booking or message transaction that
-- caused the notification.
create extension if not exists pg_net;

create or replace function public.on_notification_created()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform net.http_post(
    url := 'https://jktykrbvwgagcjyuxypo.supabase.co/functions/v1/booking-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- The function is deployed with verify_jwt on, so the call needs a valid
      -- JWT. This is the anon key -- the same one the browser already ships.
      -- It grants nothing extra: the function does its privileged work with the
      -- service role key from its own environment, not with this token.
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprdHlrcmJ2d2dhZ2NqeXV4eXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMzU5MDAsImV4cCI6MjA5NTcxMTkwMH0.Uydk05Yxj3CG0kOXSbGHS_8c-p9xM1ipcu5iiOnyhKw'
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', to_jsonb(NEW),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$function$;

-- Same grant shape as the other trigger functions (harden_trigger_function_grants):
-- nothing callable by anon/authenticated, it only ever runs from the trigger.
revoke all on function public.on_notification_created() from public;
grant execute on function public.on_notification_created() to postgres, service_role;

drop trigger if exists notification_email_notify on public.notifications;
create trigger notification_email_notify
after insert on public.notifications
for each row execute function public.on_notification_created();
