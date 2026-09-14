-- Applied to production 2026-09-14 as 20260914193216, the name this file now carries so the
-- local directory matches the remote history. It was written as 20260914120000, which is the
-- number the trigger comment at the bottom still cites; the body below is exactly what ran.
--
-- Make the database decide what a booking may be, and how it may change.
--
-- THE HOLE. public.bookings had exactly one write rule per verb, and each said only whose
-- row it was: INSERT WITH CHECK (auth.uid() = owner_id), UPDATE USING/WITH CHECK
-- (auth.uid() = owner_id) for owners and the same on sitter_id for sitters. authenticated
-- holds UPDATE on every column. So an owner, going straight at the API, could
--
--   PATCH /rest/v1/bookings?id=eq.<theirs>   {"status": "completed"}
--
-- on a request the sitter never accepted. That satisfies reviews_insert_own_completed_booking,
-- which is the only thing standing between a user and a review -- so it was a fake-review
-- path. {"status": "signed"} was worse in a quieter way: on_booking_event writes the
-- "accepted" system message with sender_id = sitter_id, putting words in the sitter's mouth.
-- The owner could also move a booking to another sitter after the fact, sidestepping
-- enforce_sitter_verified, which only fires on INSERT; insert a booking already 'completed';
-- book a service the sitter does not offer, one of somebody else's pets, or themselves; and
-- DELETE a booking, which cascades to reviews -- erasing what the sitter wrote about them.
--
-- /bookings/new refuses most of that in the browser. The browser is not a boundary.
--
-- WHAT IS ALLOWED NOW, and it is exactly what the app does (bookings/page.tsx, BookingCard):
--   INSERT  a 'pending' request, by the owner, for their own pet, for a service the sitter
--           offers, with someone other than themselves as sitter, not starting in the past.
--   UPDATE  status only, and only along these edges:
--             owner   pending|signed -> cancelled
--             sitter  pending        -> signed | declined
--             sitter  signed         -> completed
--           The UI offers owners cancel on pending only; signed -> cancelled is allowed
--           because plans change after a sitter accepts, and on_booking_event already
--           words 'cancelled' as coming from the owner. It has no sitter-cancel wording,
--           which is why sitters cannot cancel.
--   DELETE  nobody. Nothing in src deletes a booking; cancelling is how a booking ends.
--
-- WHY A TRIGGER. RLS can say whose row it is; it cannot compare OLD with NEW, which is what
-- a status transition is. Same reasoning as protect_verification_columns (20260912210000).
--
-- WHY current_user, and why SECURITY INVOKER. PostgREST assumes the caller's role, so
-- current_user is 'authenticated' for the browser and 'service_role' for anything holding
-- the service key; migrations and support work run as postgres. Those three are trusted and
-- skip the checks. INVOKER matters twice over: DEFINER would make current_user the function
-- owner and wave everyone through, and the pet check deliberately reads pets with the
-- caller's own RLS -- a pet you cannot see is not yours.
--
-- WHY 15 MINUTES. The form refuses a start before the current minute by the browser's clock.
-- The server's clock is not the browser's, so the database allows a little slack and still
-- refuses a booking for yesterday.

create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $body$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' then
      raise exception 'A booking starts as a pending request'
        using errcode = 'insufficient_privilege';
    end if;

    if new.owner_id = new.sitter_id then
      raise exception 'A booking cannot be made with yourself as the sitter'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id
    ) then
      raise exception 'A booking is for one of your own pets'
        using errcode = 'check_violation';
    end if;

    -- Strictly the JSON boolean true, as offeredServices() in src/lib/services.ts reads it.
    if not exists (
      select 1 from public.profiles where id = new.sitter_id and services -> new.service = 'true'::jsonb
    ) then
      raise exception 'The sitter does not offer this service'
        using errcode = 'check_violation';
    end if;

    if new.start_at < now() - interval '15 minutes' then
      raise exception 'A booking cannot start in the past'
        using errcode = 'check_violation';
    end if;

    return new;
  end if;

  -- UPDATE. updated_at is left out on purpose: bookings_set_updated_at owns it.
  if (new.id, new.owner_id, new.sitter_id, new.pet_id, new.service,
      new.start_at, new.end_at, new.address, new.notes, new.created_at)
     is distinct from
     (old.id, old.owner_id, old.sitter_id, old.pet_id, old.service,
      old.start_at, old.end_at, old.address, old.notes, old.created_at) then
    raise exception 'Only the status of a booking can change once it is requested'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if auth.uid() = old.owner_id
     and old.status in ('pending', 'signed') and new.status = 'cancelled' then
    return new;
  end if;

  if auth.uid() = old.sitter_id and (
       (old.status = 'pending' and new.status in ('signed', 'declined'))
    or (old.status = 'signed' and new.status = 'completed')
  ) then
    return new;
  end if;

  raise exception 'This booking cannot go from % to %', old.status, new.status
    using errcode = 'insufficient_privilege';
end;
$body$;

drop trigger if exists enforce_booking_rules on public.bookings;

create trigger enforce_booking_rules
  before insert or update on public.bookings
  for each row execute function public.enforce_booking_rules();

-- A constraint rather than a trigger rule: it holds for every role, service key included,
-- because no booking anyone could want ends before it starts. 0 of 8 rows violated it when
-- this was written.
alter table public.bookings
  add constraint bookings_range_check check (end_at > start_at);

drop policy if exists "Owners can delete their own bookings" on public.bookings;

comment on trigger enforce_booking_rules on public.bookings is
  'Insert: pending only, own pet, offered service, not self, not in the past. Update: status '
  'only, owner -> cancelled, sitter -> signed/declined/completed. Service role and postgres '
  'bypass. See migration 20260914120000.';
