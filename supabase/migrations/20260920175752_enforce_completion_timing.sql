-- Applied to production 2026-09-20 as 20260920175752.
-- From the 2026-09-20 security scan; see docs/security/2026-09-20-hardening.sql §4.
--
-- enforce_booking_rules allows signed -> completed with no clock check, so a sitter could
-- accept a booking for next month and complete it the same minute: that strips the
-- owner's right to cancel (owner cancel is only pending|signed) and unlocks a review for
-- a job nobody has done. Additive -- a second BEFORE UPDATE trigger, leaving the existing
-- function exactly as it is.
create or replace function public.enforce_completion_timing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return NEW;
  end if;
  if NEW.status = 'completed' and OLD.status is distinct from 'completed'
     and NEW.start_at > now() then
    raise exception 'A booking cannot be completed before it starts'
      using errcode = 'check_violation', hint = 'not_started';
  end if;
  return NEW;
end;
$$;

revoke all on function public.enforce_completion_timing() from public, anon, authenticated;

drop trigger if exists enforce_completion_timing on public.bookings;
create trigger enforce_completion_timing
  before update on public.bookings
  for each row execute function public.enforce_completion_timing();
