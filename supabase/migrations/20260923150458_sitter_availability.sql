-- Sitter availability: days off, enforced by the database.
--
-- Spec: docs/superpowers/specs/2026-09-16-sitter-availability-design.md, with the deviations
-- listed in docs/superpowers/plans/2026-09-22-demo-polish.md (Part D). Mirrored in
-- src/lib/availability.ts: change both.
--
-- Days off, not days on: everyone is free by default, so the seeded sitters stay bookable and a
-- sitter who never opens the calendar never vanishes from browse. A booking counts once it is
-- 'signed'; two pending requests may overlap, and the clash is checked again when the sitter
-- accepts one. Cancelled and declined bookings block nothing.
--
-- Dates are compared as calendar days in Europe/Vilnius, because a day off is a day to a person,
-- not a UTC window. A stay [start, end) is half-open: one ending the morning another begins does
-- not clash.

-- 1. The table. A day is on or off, so toggling is an insert or a delete, never an update.
create table public.sitter_days_off (
  sitter_id  uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (sitter_id, day)
);

alter table public.sitter_days_off enable row level security;

-- Own rows only. Everyone else learns which days are taken through sitter_busy_days, which
-- never says why or by whom.
create policy sitter_days_off_select_own on public.sitter_days_off
  for select to authenticated using (sitter_id = (select auth.uid()));
create policy sitter_days_off_insert_own on public.sitter_days_off
  for insert to authenticated with check (sitter_id = (select auth.uid()));
create policy sitter_days_off_delete_own on public.sitter_days_off
  for delete to authenticated using (sitter_id = (select auth.uid()));

revoke all on public.sitter_days_off from anon, authenticated;
grant select, insert, delete on public.sitter_days_off to authenticated;

-- 2. The one truth: null when the sitter is free, otherwise the hint the app maps to a sentence.
-- DEFINER because it must see days off and signed bookings the caller cannot read. It answers
-- only "free or not, and which kind of not", never whose booking.
create or replace function public.sitter_availability_problem(
  p_sitter uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_ignore_booking uuid default null
) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when exists (
      select 1
      from public.sitter_days_off d
      where d.sitter_id = p_sitter
        and d.day between (p_start at time zone 'Europe/Vilnius')::date
                      and ((p_end - interval '1 microsecond') at time zone 'Europe/Vilnius')::date
    ) then 'sitter_unavailable'
    when exists (
      select 1
      from public.bookings b
      where b.sitter_id = p_sitter
        and b.status = 'signed'
        and b.id is distinct from p_ignore_booking
        and b.start_at < p_end
        and p_start < b.end_at
    ) then 'already_booked'
  end
$$;

-- 3. Enforcement. INVOKER and trusted-role skip for the same reasons as enforce_booking_rules
-- (20260914193216). A new request is checked on INSERT; acceptance is checked again on the
-- move to 'signed', excluding the row itself so accepting never trips over its own dates.
-- create_booking_request is INVOKER, so its insert is checked here too.
create or replace function public.enforce_sitter_availability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_problem text;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' or (new.status = 'signed' and old.status is distinct from 'signed') then
    v_problem := public.sitter_availability_problem(
      new.sitter_id, new.start_at, new.end_at,
      case when tg_op = 'UPDATE' then new.id end);
    if v_problem is not null then
      raise exception 'The sitter is not free for these dates'
        using errcode = 'check_violation', hint = v_problem;
    end if;
  end if;

  return new;
end
$$;

create trigger enforce_sitter_availability
  before insert or update of status on public.bookings
  for each row execute function public.enforce_sitter_availability();

comment on trigger enforce_sitter_availability on public.bookings is
  'Refuses a request, or an acceptance, that touches a sitter''s day off (hint sitter_unavailable) '
  'or overlaps one of their signed bookings (hint already_booked). See sitter_availability_problem.';

-- 4. Reads. Days in [p_from, p_to] that are taken, and whether by a day off or an accepted
-- booking; never by whom. Capped at ~13 months per call.
create or replace function public.sitter_busy_days(p_sitter uuid, p_from date, p_to date)
returns table (day date, kind text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.day, 'off'::text
  from public.sitter_days_off d
  where d.sitter_id = p_sitter
    and d.day between p_from and p_to
    and p_to - p_from <= 400
  union
  select g::date, 'booked'::text
  from public.bookings b
  cross join lateral generate_series(
    (b.start_at at time zone 'Europe/Vilnius')::date,
    ((b.end_at - interval '1 microsecond') at time zone 'Europe/Vilnius')::date,
    interval '1 day') g
  where b.sitter_id = p_sitter
    and b.status = 'signed'
    and p_to - p_from <= 400
    and b.end_at   > (p_from::timestamp at time zone 'Europe/Vilnius')
    and b.start_at < ((p_to + 1)::timestamp at time zone 'Europe/Vilnius')
    and g::date between p_from and p_to
  order by 1
$$;

-- The sitters browse hides for a day range (both ends included), in one call per page load.
-- Day-level on purpose: a signed booking touching any day in the range hides the sitter.
create or replace function public.sitters_unavailable_between(p_from date, p_to date)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.sitter_id
  from public.sitter_days_off d
  where d.day between p_from and p_to
  union
  select b.sitter_id
  from public.bookings b
  where b.status = 'signed'
    and b.end_at   > (p_from::timestamp at time zone 'Europe/Vilnius')
    and b.start_at < ((p_to + 1)::timestamp at time zone 'Europe/Vilnius')
$$;

-- 5. Grants. Signed-in only: browse is behind login.
revoke all on function public.sitter_availability_problem(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.enforce_sitter_availability() from public, anon, authenticated;
revoke all on function public.sitter_busy_days(uuid, date, date) from public, anon;
revoke all on function public.sitters_unavailable_between(date, date) from public, anon;
grant execute on function public.sitter_availability_problem(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.sitter_busy_days(uuid, date, date) to authenticated;
grant execute on function public.sitters_unavailable_between(date, date) to authenticated;
