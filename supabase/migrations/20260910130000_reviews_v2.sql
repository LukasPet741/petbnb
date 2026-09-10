-- Reviews v2: two-way, with optional per-dimension ratings.
--
-- See docs/superpowers/specs/2026-09-10-reviews-v2-design.md.
--
-- v1 (20260907210000) was one-directional: an owner rated a sitter, one star, one
-- comment. Two gaps. A sitter learned nothing about an owner before accepting a
-- booking and could not warn other sitters about one. And "four stars" never said
-- whether the pet came back happy, whether messages were answered, or whether the
-- sitter turned up when they said they would.
--
-- Written as ALTERs rather than a drop-and-recreate. The table holds 0 rows, so
-- replacing it would have been safe, but nothing here is destructive: columns and
-- constraints are renamed, policies are altered in place, and the aggregate view is
-- replaced rather than dropped. There is no moment at which the table does not exist.
--
-- Note that SET NOT NULL on the new direction column is the safety catch: on an empty
-- table it succeeds, and on a table that somehow has rows it fails loudly rather than
-- silently labelling every existing review as owner_to_sitter.

-- 1. Columns. owner/sitter stopped being true the moment a sitter could also write one.
alter table public.reviews rename column owner_id  to author_id;
alter table public.reviews rename column sitter_id to subject_id;

-- Renaming a column does NOT rename the constraints and indexes that reference it, so
-- without this the schema would carry a reviews_owner_id_fkey sitting on author_id.
alter table public.reviews rename constraint reviews_owner_id_fkey  to reviews_author_id_fkey;
alter table public.reviews rename constraint reviews_sitter_id_fkey to reviews_subject_id_fkey;
alter index idx_reviews_owner_id  rename to idx_reviews_author_id;
alter index idx_reviews_sitter_id rename to idx_reviews_subject_id;

-- reviews_no_self_review needs no change: its expression followed the rename and now
-- reads author_id <> subject_id, which is still exactly the rule.

-- 2. Direction.
alter table public.reviews add column direction text;
alter table public.reviews alter column direction set not null;
alter table public.reviews add constraint reviews_direction_check
  check (direction in ('owner_to_sitter', 'sitter_to_owner'));

-- 3. Optional dimensions. communication is shared because both parties actually
-- experience it; the other four belong to exactly one direction, enforced below.
alter table public.reviews add column communication    smallint check (communication between 1 and 5);
alter table public.reviews add column pet_wellbeing    smallint check (pet_wellbeing between 1 and 5);
alter table public.reviews add column reliability      smallint check (reliability between 1 and 5);
alter table public.reviews add column pet_as_described smallint check (pet_as_described between 1 and 5);
alter table public.reviews add column handover         smallint check (handover between 1 and 5);

alter table public.reviews add constraint reviews_dimensions_match_direction check (
  (direction = 'owner_to_sitter' and pet_as_described is null and handover is null)
  or
  (direction = 'sitter_to_owner' and pet_wellbeing is null and reliability is null)
);

-- 4. One review per PERSON per booking, not one per booking. This is the constraint
-- that made two-way reviews impossible. A client treating 23505 as "it already exists,
-- update it" stays correct under the new key.
alter table public.reviews drop constraint reviews_booking_id_key;
alter table public.reviews add constraint reviews_one_per_author_per_booking
  unique (booking_id, author_id);

create index idx_reviews_direction_subject on public.reviews using btree (direction, subject_id);

-- 5. Policies, altered in place rather than dropped and recreated.
--
-- Reviews of sitters stay public: they are the social proof the product runs on.
-- Reviews of owners are not. An owner is a private individual, not a business
-- advertising a service, and publishing named judgements of them to anyone holding the
-- anon key is not something this product should do. A sitter sees them only for owners
-- they actually have a booking with, which is the only moment the information is worth
-- anything. The exists() reads bookings as the caller, so the existing
-- "Sitters can view their bookings" policy does the work and no SECURITY DEFINER
-- helper is needed.
alter policy reviews_select_public on public.reviews rename to reviews_select_visible;

-- The booking must be live or realised. An earlier draft said only "has a booking with
-- that owner", and testing showed that a booking cancelled months ago was enough to
-- unlock an owner's reviews forever. pending covers the accept-or-decline moment this
-- exists for; signed and completed cover a real working relationship. cancelled and
-- declined leave nothing to decide.
alter policy reviews_select_visible on public.reviews
  using (
    direction = 'owner_to_sitter'
    or exists (
      select 1
      from public.bookings b
      where b.owner_id  = reviews.subject_id
        and b.sitter_id = (select auth.uid())
        and b.status in ('pending', 'signed', 'completed')
    )
  );

-- The author is the caller, the booking actually completed, and the direction matches
-- the caller's real role on that booking — so neither party can file a review pointing
-- the wrong way, or one for a booking they had no part in.
alter policy reviews_insert_own_completed_booking on public.reviews
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.status = 'completed'
        and (
          (reviews.direction = 'owner_to_sitter'
             and b.owner_id  = reviews.author_id
             and b.sitter_id = reviews.subject_id)
          or
          (reviews.direction = 'sitter_to_owner'
             and b.sitter_id = reviews.author_id
             and b.owner_id  = reviews.subject_id)
        )
    )
  );

-- Authors may correct their own review but may not move it to another booking, subject
-- or direction: the WITH CHECK re-asserts every identifying column.
alter policy reviews_update_own on public.reviews
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1
      from public.bookings b
      where b.id = reviews.booking_id
        and b.status = 'completed'
        and (
          (reviews.direction = 'owner_to_sitter'
             and b.owner_id  = reviews.author_id
             and b.sitter_id = reviews.subject_id)
          or
          (reviews.direction = 'sitter_to_owner'
             and b.sitter_id = reviews.author_id
             and b.owner_id  = reviews.subject_id)
        )
    )
  );

-- reviews_delete_own needs no change either: its expression followed the column rename.
-- Still permitted in the database and still deliberately absent from the UI — a sitter
-- must not be able to talk an owner into removing a bad review.

-- 6. Aggregates. CREATE OR REPLACE rather than drop: the three columns v1 published
-- keep their names and types and the new ones are appended, which is exactly what
-- replace allows. Every existing consumer — useSitterRatings, RatingSummary,
-- SitterCard and five listing pages — is untouched by this migration.
--
-- Dimension averages live here rather than being computed in the browser from a fetched
-- page of reviews, which would be free today and silently wrong the day that list is
-- paginated.
create or replace view public.sitter_ratings
  with (security_invoker = true)
  as
select
  subject_id                                       as sitter_id,
  count(*)::int                                    as review_count,
  round(avg(rating)::numeric, 2)::float            as average_rating,
  round(avg(communication)::numeric, 2)::float     as avg_communication,
  round(avg(pet_wellbeing)::numeric, 2)::float     as avg_pet_wellbeing,
  round(avg(reliability)::numeric, 2)::float       as avg_reliability
from public.reviews
where direction = 'owner_to_sitter'
group by subject_id;

create view public.owner_ratings
  with (security_invoker = true)
  as
select
  subject_id                                       as owner_id,
  count(*)::int                                    as review_count,
  round(avg(rating)::numeric, 2)::float            as average_rating,
  round(avg(communication)::numeric, 2)::float     as avg_communication,
  round(avg(pet_as_described)::numeric, 2)::float  as avg_pet_as_described,
  round(avg(handover)::numeric, 2)::float          as avg_handover
from public.reviews
where direction = 'sitter_to_owner'
group by subject_id;

-- owner_ratings is not granted to anon at all. RLS would return it nothing anyway, but
-- failing closed at the grant is clearer than leaving a policy as the only thing
-- standing there — the lesson from profiles.phone earlier today.
grant select on public.owner_ratings to authenticated;

comment on table public.reviews is
  'One review per person per completed booking, in either direction. See docs/superpowers/specs/2026-09-10-reviews-v2-design.md.';
comment on view public.owner_ratings is
  'Per-owner aggregate of sitter_to_owner reviews. Visible only to sitters with a booking with that owner.';
