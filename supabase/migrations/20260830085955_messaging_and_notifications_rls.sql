alter table public.messages enable row level security;
alter table public.notifications enable row level security;

-- Helper: is the caller a party to this booking?
-- SECURITY DEFINER so the messages policies can see bookings rows without
-- recursing through the bookings SELECT policies.
create or replace function public.is_booking_party(p_booking_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (b.owner_id = auth.uid() or b.sitter_id = auth.uid())
  );
$$;

-- messages: readable by both parties to the booking.
drop policy if exists "Booking parties can view messages" on public.messages;
create policy "Booking parties can view messages"
  on public.messages for select
  using (public.is_booking_party(booking_id));

-- messages: a party may write only their OWN user messages.
-- System rows (kind='system') are excluded here, so only the SECURITY DEFINER
-- trigger can create them -- a client cannot forge "the sitter accepted".
drop policy if exists "Booking parties can send messages" on public.messages;
create policy "Booking parties can send messages"
  on public.messages for insert
  with check (
    kind = 'user'
    and sender_id = auth.uid()
    and public.is_booking_party(booking_id)
  );

-- Deliberately no UPDATE or DELETE policy on messages: the conversation is an
-- immutable record, and read-marking goes through mark_thread_read().

-- notifications: SELECT only, and only your own.
-- Deliberately NO insert/update/delete policies -- with RLS on, that means the
-- table is writable exclusively by SECURITY DEFINER triggers and RPCs. This is
-- the point: a browser client must never be able to address a row to someone else.
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());
