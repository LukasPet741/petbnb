-- petbnb — performance and hygiene pass from the 2026-10-09 Supabase advisor run.
-- APPLIED 2026-10-09 with Lukas's yes; verified against the catalogs afterwards.
--
-- None of this changes who can see or do what. Every policy below keeps its exact
-- condition; only `auth.uid()` becomes `(select auth.uid())`, which Postgres evaluates
-- once per query instead of once per row (advisor lint 0003, 17 findings).
--
-- Also: covering indexes for the five foreign keys the advisor flagged (lint 0001), and a
-- fixed search_path on the two trigger functions that lacked one (lint 0011).

-- ---------------------------------------------------------------------------------
-- 1. RLS: evaluate auth.uid() once per statement
-- ---------------------------------------------------------------------------------
alter policy "Owners can insert their own bookings" on public.bookings
  with check ((select auth.uid()) = owner_id);
alter policy "Owners can update their own bookings" on public.bookings
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter policy "Owners can view their own bookings" on public.bookings
  using ((select auth.uid()) = owner_id);
alter policy "Sitters can update their bookings" on public.bookings
  using ((select auth.uid()) = sitter_id) with check ((select auth.uid()) = sitter_id);
alter policy "Sitters can view their bookings" on public.bookings
  using ((select auth.uid()) = sitter_id);

alter policy "Owners view their own collar locations" on public.collar_locations
  using (exists (select 1 from public.collar_devices
                 where collar_devices.id = collar_locations.device_id
                   and collar_devices.owner_id = (select auth.uid())));

alter policy "Users can add their own favorites" on public.favorites
  with check ((select auth.uid()) = user_id);
alter policy "Users can remove their own favorites" on public.favorites
  using ((select auth.uid()) = user_id);
alter policy "Users can view their own favorites" on public.favorites
  using ((select auth.uid()) = user_id);

alter policy "Booking parties can send messages" on public.messages
  with check (kind = 'user' and sender_id = (select auth.uid()) and public.is_booking_party(booking_id));

alter policy "Users can view their own notifications" on public.notifications
  using (user_id = (select auth.uid()));

alter policy "Users can delete their own pets" on public.pets
  using ((select auth.uid()) = owner_id);
alter policy "Users can insert their own pets" on public.pets
  with check ((select auth.uid()) = owner_id);
alter policy "Users can update their own pets" on public.pets
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
alter policy "Users can view their own pets" on public.pets
  using ((select auth.uid()) = owner_id);

alter policy "Users can insert their own profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "Users can update their own profile" on public.profiles
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------------
-- 2. Covering indexes for foreign keys
-- ---------------------------------------------------------------------------------
create index if not exists favorites_sitter_id_idx            on public.favorites (sitter_id);
create index if not exists messages_sender_id_idx             on public.messages (sender_id);
create index if not exists notifications_actor_id_idx         on public.notifications (actor_id);
create index if not exists notifications_booking_id_idx       on public.notifications (booking_id);
create index if not exists smart_id_demo_sessions_user_id_idx on public.smart_id_demo_sessions (user_id);

-- ---------------------------------------------------------------------------------
-- 3. Pin search_path on the two trigger functions that had none
-- ---------------------------------------------------------------------------------
alter function public.handle_new_user()              set search_path = public, pg_temp;
alter function public.protect_verification_columns() set search_path = public, pg_temp;
