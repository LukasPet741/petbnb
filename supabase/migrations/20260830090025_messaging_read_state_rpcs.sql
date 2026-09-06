-- Read-marking RPCs. RLS cannot cleanly express "you may update read_at and
-- nothing else", so these are SECURITY DEFINER and do their own authorization,
-- following the existing verify_collar_device / register_collar_device style.

create or replace function public.mark_thread_read(p_booking_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (b.owner_id = auth.uid() or b.sitter_id = auth.uid())
  ) then
    raise exception 'Not a party to this booking';
  end if;

  -- Only messages sent by the OTHER person; you never "read" your own.
  update public.messages
     set read_at = now()
   where booking_id = p_booking_id
     and sender_id <> auth.uid()
     and read_at is null;
  get diagnostics v_count = row_count;

  -- Opening the thread also clears its message notification.
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and booking_id = p_booking_id
     and type = 'message_received'
     and read_at is null;

  return v_count;
end;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.notifications
     set read_at = now()
   where user_id = auth.uid()          -- never anyone else's rows
     and read_at is null
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function public.mark_thread_read(uuid) from public, anon;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
