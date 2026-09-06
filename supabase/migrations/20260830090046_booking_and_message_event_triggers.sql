-- Notifications are written ONLY here. The app is browser -> PostgREST -> RLS
-- with no server, so the client cannot be trusted to write a row addressed to
-- the other person. A trigger also fires regardless of who changed the row --
-- including a manual dashboard UPDATE -- and survives bookings/new/page.tsx
-- navigating away the instant the insert resolves.

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
    -- New request: the sitter is the one who needs to know.
    insert into public.notifications (user_id, actor_id, booking_id, type)
    values (NEW.sitter_id, NEW.owner_id, NEW.id, 'booking_requested');

    insert into public.messages (booking_id, sender_id, kind, event)
    values (NEW.id, NEW.owner_id, 'system', 'requested');

    -- Carry the request note into the thread as the owner's opening message,
    -- so it stops being a write-once dead end.
    if NEW.notes is not null and length(btrim(NEW.notes)) > 0 then
      insert into public.messages (booking_id, sender_id, kind, body)
      values (NEW.id, NEW.owner_id, 'user', NEW.notes);
    end if;

    return NEW;
  end if;

  -- UPDATE: only care about real status transitions.
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

drop trigger if exists booking_event_notify on public.bookings;
create trigger booking_event_notify
  after insert or update of status on public.bookings
  for each row execute function public.on_booking_event();


create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_recipient uuid;
begin
  -- System rows already got their notification from on_booking_event.
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

  -- Collapse: twenty messages produce one notification, not twenty.
  if exists (
    select 1 from public.notifications n
     where n.user_id = v_recipient
       and n.booking_id = NEW.booking_id
       and n.type = 'message_received'
       and n.read_at is null
  ) then
    return NEW;
  end if;

  insert into public.notifications (user_id, actor_id, booking_id, type)
  values (v_recipient, NEW.sender_id, NEW.booking_id, 'message_received');

  return NEW;
end;
$$;

drop trigger if exists message_insert_notify on public.messages;
create trigger message_insert_notify
  after insert on public.messages
  for each row execute function public.on_message_insert();


-- Pre-existing bug: bookings.updated_at has a now() default and nothing
-- maintained it on UPDATE.
create extension if not exists moddatetime schema extensions;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute procedure extensions.moddatetime(updated_at);
