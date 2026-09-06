-- Locale, so server-side email knows which language to send in.
-- Until now locale lived only in localStorage ("petbnb-locale").
alter table public.profiles
  add column if not exists locale text not null default 'en'
  check (locale in ('en', 'lt'));

-- A thread is 1:1 with a booking, so booking_id IS the thread key.
-- Exactly two participants per thread, so a single read_at per message suffices.
create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  booking_id  uuid not null references public.bookings(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  kind        text not null default 'user' check (kind in ('user', 'system')),
  body        text,
  event       text check (event in ('requested','accepted','declined','cancelled','completed')),
  read_at     timestamptz,
  created_at  timestamptz not null default now(),
  -- No display text is ever stored: system rows carry an `event` the UI
  -- translates, so the Lithuanian half of the app keeps working.
  constraint messages_shape check (
    (kind = 'user'   and body is not null and length(btrim(body)) > 0 and event is null)
    or
    (kind = 'system' and event is not null and body is null)
  )
);

create index if not exists messages_booking_created_idx
  on public.messages (booking_id, created_at);

-- Drives the per-thread unread dot and the thread-list ordering.
create index if not exists messages_unread_idx
  on public.messages (booking_id, sender_id)
  where read_at is null;

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  actor_id     uuid references public.profiles(id) on delete set null,
  booking_id   uuid references public.bookings(id) on delete cascade,
  type         text not null check (type in (
                 'booking_requested','booking_accepted','booking_declined',
                 'booking_cancelled','booking_completed','message_received')),
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  email_status text not null default 'pending'
                 check (email_status in ('pending','sent','skipped','failed')),
  email_error  text
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_unread_idx
  on public.notifications (user_id)
  where read_at is null;

-- Supports the message_received collapse check in on_message_insert.
create index if not exists notifications_unread_message_idx
  on public.notifications (user_id, booking_id, type)
  where read_at is null;
