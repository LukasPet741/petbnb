-- Pets with history are archived, never deleted (unification plan §2.4; security scan
-- 2026-09-20 §9). Applied with Lukas's yes on 2026-10-10, before the branch that reads
-- pets.archived_at merged.
--
-- bookings.pet_id was ON DELETE CASCADE, and messages, notifications and reviews cascade
-- from bookings: deleting a pet erased the sitter's history with it (and let anyone who
-- both owns and sits make a review disappear). Now a pet on any booking cannot be deleted;
-- the app archives it instead, and /pets explains a refusal (23503).
--
-- NO ACTION rather than RESTRICT: both refuse a direct delete of a pet with bookings, but
-- NO ACTION checks at the end of the statement, so deleting a whole user from the
-- dashboard (profile → pets and profile → bookings both cascade) still works.

alter table public.pets add column if not exists archived_at timestamptz;

comment on column public.pets.archived_at is
  'Set when the owner removes a pet that has bookings: it leaves their lists and the request form, the bookings keep it.';

alter table public.bookings
  drop constraint bookings_pet_id_fkey,
  add  constraint bookings_pet_id_fkey
       foreign key (pet_id) references public.pets(id) on delete no action;

-- No new booking for an archived pet (the request form already hides them).
create or replace function public.refuse_archived_pet_booking()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.pets p where p.id = new.pet_id and p.archived_at is not null) then
    raise exception 'This pet is archived.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_refuse_archived_pet on public.bookings;
create trigger bookings_refuse_archived_pet
  before insert on public.bookings
  for each row execute function public.refuse_archived_pet_booking();
