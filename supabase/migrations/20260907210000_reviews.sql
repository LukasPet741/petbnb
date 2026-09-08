-- Reviews and ratings.
--
-- The product had no notion of either: no table, no columns, nothing. That is the
-- single biggest gap against every comparable marketplace, where star ratings and
-- review counts are the primary trust signal. It is also the only trust signal this
-- project can honestly offer, since it deliberately does not vet sitters, does not
-- process payments and carries no insurance.
--
-- Design notes:
--   * booking_id is UNIQUE. A review is attached to a completed booking, so "one
--     review per booking" is a constraint, not an application convention. It also
--     means a sitter cannot be reviewed by someone who never booked them.
--   * owner_id and sitter_id are denormalised from the booking so that reads (which
--     are public and frequent) never have to join through bookings, whose RLS would
--     hide the row from other viewers. The INSERT policy below verifies both against
--     the booking, so they cannot disagree with it.
--   * No updated_at. profiles.updated_at and pets.updated_at are already dead
--     columns in this schema — nothing maintains them — and adding a third would
--     just extend the lie.

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  sitter_id  uuid not null references public.profiles(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (body is null or char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),

  -- A sitter reviewing themselves would be free, unearned social proof.
  constraint reviews_no_self_review check (owner_id <> sitter_id)
);

-- sitter_id carries the read path (every sitter card and profile aggregates on it).
-- owner_id is referenced by the RLS policies below, and unindexed columns used in
-- policies are exactly the pattern flagged by the Supabase advisor on this project.
create index if not exists idx_reviews_sitter_id  on public.reviews using btree (sitter_id);
create index if not exists idx_reviews_owner_id   on public.reviews using btree (owner_id);
create index if not exists idx_reviews_created_at on public.reviews using btree (created_at desc);

alter table public.reviews enable row level security;

-- Read: public and deliberately so. Reviews are the social proof; hiding them behind
-- auth would defeat the purpose. Note this is the opposite of public.pets, which has
-- no public SELECT policy on purpose.
drop policy if exists reviews_select_public on public.reviews;
create policy reviews_select_public
  on public.reviews
  for select
  to anon, authenticated
  using (true);

-- Write: only the owner on a booking that actually completed, and the denormalised
-- owner_id/sitter_id must match that booking. This is what makes a review earned.
--
-- auth.uid() is wrapped in a SELECT so it is evaluated once per statement rather than
-- once per row. The EXISTS reads public.bookings as the calling user, so the booking
-- RLS still applies and no SECURITY DEFINER helper is needed here.
drop policy if exists reviews_insert_own_completed_booking on public.reviews;
create policy reviews_insert_own_completed_booking
  on public.reviews
  for insert
  to authenticated
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.bookings b
      where b.id        = reviews.booking_id
        and b.owner_id  = reviews.owner_id
        and b.sitter_id = reviews.sitter_id
        and b.status    = 'completed'
    )
  );

-- Authors may correct their own review, but may not move it to another booking or
-- another sitter: the WITH CHECK re-asserts every identifying column.
drop policy if exists reviews_update_own on public.reviews;
create policy reviews_update_own
  on public.reviews
  for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (
    owner_id = (select auth.uid())
    and exists (
      select 1
      from public.bookings b
      where b.id        = reviews.booking_id
        and b.owner_id  = reviews.owner_id
        and b.sitter_id = reviews.sitter_id
        and b.status    = 'completed'
    )
  );

drop policy if exists reviews_delete_own on public.reviews;
create policy reviews_delete_own
  on public.reviews
  for delete
  to authenticated
  using (owner_id = (select auth.uid()));

-- Aggregate for sitter cards and profiles. A view rather than denormalised columns on
-- profiles, because a stored average drifts the moment anything writes around it.
-- security_invoker keeps the caller's RLS in force rather than the view owner's.
drop view if exists public.sitter_ratings;
create view public.sitter_ratings
  with (security_invoker = true)
  as
select
  sitter_id,
  count(*)::int                        as review_count,
  round(avg(rating)::numeric, 2)::float as average_rating
from public.reviews
group by sitter_id;

comment on table public.reviews is
  'One review per completed booking, written by the booking owner about the sitter.';
comment on view public.sitter_ratings is
  'Per-sitter review count and mean rating. Derived, never written to.';
