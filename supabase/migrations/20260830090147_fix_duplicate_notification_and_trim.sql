-- Fix 1: trim the carried-over request note.
create or replace function public.on_booking_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recipient uuid;
  v_actor     uuid;
  v_type      text;
  v_event     text;
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, actor_id, booking_id, type)
    values (NEW.sitter_id, NEW.owner_id, NEW.id, 'booking_requested');

    insert into public.messages (booking_id, sender_id, kind, event)
    values (NEW.id, NEW.owner_id, 'system', 'requested');

    if NEW.notes is not null and length(btrim(NEW.notes)) > 0 then
      insert into public.messages (booking_id, sender_id, kind, body)
      values (NEW.id, NEW.owner_id, 'user', btrim(NEW.notes));
    end if;

    return NEW;
  end if;

  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  case NEW.status
    when 'signed' then
      v_recipient := NEW.owner_id;  v_actor := NEW.sitter_id;
      v_type := 'booking_accepted'; v_event := 'accepted';
    when 'declined' then
      v_recipient := NEW.owner_id;  v_actor := NEW.sitter_id;
      v_type := 'booking_declined'; v_event := 'declined';
    when 'completed' then
      v_recipient := NEW.owner_id;  v_actor := NEW.sitter_id;
      v_type := 'booking_completed'; v_event := 'completed';
    when 'cancelled' then
      v_recipient := NEW.sitter_id; v_actor := NEW.owner_id;
      v_type := 'booking_cancelled'; v_event := 'cancelled';
    else
      return NEW;
  end case;

  insert into public.notifications (user_id, actor_id, booking_id, type)
  values (v_recipient, v_actor, NEW.id, v_type);

  insert into public.messages (booking_id, sender_id, kind, event)
  values (NEW.id, v_actor, 'system', v_event);

  return NEW;
end;
$$;

-- Fix 2: collapse against ANY unread notification for this booking, not just
-- an unread message_received. Otherwise the request note carried into the
-- thread fires a second notification on top of booking_requested, and the
-- sitter sees two rows for one event.
create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recipient uuid;
begin
  if NEW.kind <> 'user' then
    return NEW;
  end if;

  select case when b.owner_id = NEW.sender_id then b.sitter_id else b.owner_id end
    into v_recipient
    from public.bookings b
   where b.id = NEW.booking_id;

  if v_recipient is null then
    return NEW;
  end if;

  -- If they already have anything unread about this booking, don't pile on.
  if exists (
    select 1 from public.notifications n
     where n.user_id = v_recipient
       and n.booking_id = NEW.booking_id
       and n.read_at is null
  ) then
    return NEW;
  end if;

  insert into public.notifications (user_id, actor_id, booking_id, type)
  values (v_recipient, NEW.sender_id, NEW.booking_id, 'message_received');

  return NEW;
end;
$$;

-- The collapse check is now on (user_id, booking_id) with read_at null.
drop index if exists public.notifications_unread_message_idx;
create index if not exists notifications_unread_booking_idx
  on public.notifications (user_id, booking_id)
  where read_at is null;
