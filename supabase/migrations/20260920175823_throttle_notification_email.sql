-- Applied to production 2026-09-20 as 20260920175823.
-- From the 2026-09-20 security scan; see docs/security/2026-09-20-hardening.sql §6.
--
-- Every notifications INSERT POSTs booking-notify, which sends real mail through Resend.
-- Booking request, accept, decline, cancel and complete each insert one, and nothing
-- counted them: a script that requests and cancels in a loop mails the same sitter as
-- fast as the database will go -- the victim's inbox, the Resend quota and the sender
-- reputation all at once.
--
-- The throttle pre-stamps the row 'skipped' rather than blocking it, so the notification
-- still appears in the bell and only the email is dropped. booking-notify returns early
-- on any row that is not 'pending' (version 5, deployed 2026-09-20), so a stamped row
-- sends nothing. 20 an hour is beyond any honest use: a whole booking produces about five.
create or replace function public.throttle_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recent int;
begin
  if NEW.email_status is distinct from 'pending' then
    return NEW;
  end if;
  select count(*) into v_recent
    from public.notifications
   where user_id = NEW.user_id
     and created_at > now() - interval '1 hour'
     and email_status in ('pending', 'sent', 'failed');
  if v_recent >= 20 then
    NEW.email_status := 'skipped';
  end if;
  return NEW;
end;
$$;

revoke all on function public.throttle_notification_email() from public, anon, authenticated;

drop trigger if exists throttle_notification_email on public.notifications;
create trigger throttle_notification_email
  before insert on public.notifications
  for each row execute function public.throttle_notification_email();
