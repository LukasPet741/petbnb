# Reviews v2 — two-way reviews with optional dimensions

**Date:** 2026-09-10
**Status:** approved, implementing
**Supersedes:** the one-directional reviews schema in `20260907210000_reviews.sql`

## Why

Reviews today are one-directional: an owner rates a sitter, one overall star, one
comment. Two gaps:

1. A sitter learns nothing about an owner before accepting a booking, and has no way
   to warn other sitters about one.
2. "Four stars" does not say whether the pet came back happy, whether the sitter
   answered messages, or whether they turned up when they said they would.

`public.reviews` currently holds **0 rows**, so this restructure will never be cheaper
than now.

## Decisions

| Decision | Choice | Rejected |
|---|---|---|
| Scope | Two-way and dimensions in one migration; the post-completion prompt is a later pass | All three at once; either half alone |
| Rating shape | One required overall star, plus optional dimensions | Dimensions only, averaged or shown separately |
| Owner-review visibility | Signed-in sitters who have a booking with that owner | Public; owner-only; sitters plus the owner |
| Dimensions | Three per direction, `communication` shared | Two per direction; four per direction |
| Data model | One table with a `direction` column | Two tables; a `review_dimensions` child table |

The post-completion prompt is **out of scope here** and gets its own design. It touches
`notifications`, whose INSERT trigger sends real email to real users.

## Schema

One table, replacing the current one. `owner_id`/`sitter_id` become
`author_id`/`subject_id`; direction says which way the review points.

```
reviews
  id           uuid pk
  booking_id   uuid not null -> bookings(id) on delete cascade
  author_id    uuid not null -> profiles(id) on delete cascade
  subject_id   uuid not null -> profiles(id) on delete cascade
  direction    text not null  check in ('owner_to_sitter', 'sitter_to_owner')
  rating       smallint not null  check 1..5          -- the overall star
  body         text  check (null or btrim length 1..2000)
  communication     smallint check 1..5   -- both directions
  pet_wellbeing     smallint check 1..5   -- owner_to_sitter only
  reliability       smallint check 1..5   -- owner_to_sitter only
  pet_as_described  smallint check 1..5   -- sitter_to_owner only
  handover          smallint check 1..5   -- sitter_to_owner only
  created_at   timestamptz not null default now()

  unique (booking_id, author_id)
  check  (author_id <> subject_id)
  check  (direction = 'owner_to_sitter'
            and pet_as_described is null and handover is null
          or direction = 'sitter_to_owner'
            and pet_wellbeing is null and reliability is null)
```

`unique (booking_id, author_id)` replaces `unique (booking_id)` and states the real
rule: one review per person per booking. The existing client behaviour of treating a
`23505` as "the row already exists, update it" stays correct unchanged.

Dimensions are nullable everywhere: the overall star is the only required rating.

Indexes: `subject_id`, `author_id`, `created_at desc`, and `(direction, subject_id)`
for the aggregate views.

## Policies

**SELECT** — one policy, two cases:

```
direction = 'owner_to_sitter'                     -- public, as today
or exists (select 1 from bookings b               -- sitters, about their owners
           where b.owner_id = reviews.subject_id
             and b.sitter_id = (select auth.uid()))
```

The `exists` reads `bookings` as the calling user. The existing policy
`Sitters can view their bookings` (`auth.uid() = sitter_id`) makes that work with no
`SECURITY DEFINER` helper.

**INSERT** — the author is the caller, the booking completed, and the direction matches
the caller's actual role on that booking:

```
author_id = (select auth.uid())
and exists (
  select 1 from bookings b
   where b.id = reviews.booking_id
     and b.status = 'completed'
     and ( direction = 'owner_to_sitter'
             and b.owner_id = author_id and b.sitter_id = subject_id
        or direction = 'sitter_to_owner'
             and b.sitter_id = author_id and b.owner_id = subject_id ))
```

An owner therefore cannot file a `sitter_to_owner` review, and vice versa.

**UPDATE** — author only, with the same check re-asserted so a review cannot be moved
to another booking, subject or direction.

**DELETE** — author only in the database; deliberately not exposed in the UI. A sitter
must not be able to talk an owner into deleting a bad review.

## Views

Both `security_invoker`, so RLS decides who sees what.

```
sitter_ratings: subject_id as sitter_id, review_count, average_rating,
                avg_communication, avg_pet_wellbeing, avg_reliability
                where direction = 'owner_to_sitter' group by subject_id

owner_ratings:  subject_id as owner_id, review_count, average_rating,
                avg_communication, avg_pet_as_described, avg_handover
                where direction = 'sitter_to_owner' group by subject_id
```

`sitter_ratings` keeps its three original column names and only gains columns, so
`useSitterRatings`, `RatingSummary`, `Stars`, `SitterCard` and all five listing pages
are untouched by this work.

Dimension averages live in the view rather than being computed in the browser from the
fetched review list: the client-side version is free today and silently wrong the day
the list is paginated.

## Client

**Unchanged:** `Stars`, `RatingSummary`, `useSitterRatings`, `SitterCard`, and the
`/`, `/sitters`, `/browse`, `/saved` and profile listings.

**Changed:**

- `useMyReviews` — gains a direction, and **must filter `author_id` to the current
  user**. A booking now has up to two reviews; without the filter the other party's
  review appears inside your own form.
- `ReviewForm` — the overall star and comment as now, plus a collapsed
  "Add detail (optional)" section holding the three dimensions for the direction.
  Collapsed on purpose: one tap stays a complete review.
- `BookingReview` — takes the direction and chooses labels accordingly.
- `StarInput` — reused at a smaller size for dimension rows. No behaviour change.

**New:**

- `OwnerReputation` — overall stars, count and the three dimension averages, shown to a
  sitter on a pending booking card.
- `useOwnerRatings` — reads `owner_ratings`, mirroring `useSitterRatings`.

**Entry points:**

1. Owner reviews sitter — completed booking card. Exists.
2. Sitter reviews owner — the same completed card in the sitter's view. The
   `reviewSlot` gate changes from `!isSitterView` to a direction choice.
3. Sitter reads an owner's reputation — the pending booking card, at the moment they
   accept or decline.

## Dimensions and copy

| Direction | Dimensions |
|---|---|
| owner → sitter | pet's wellbeing, communication, reliability |
| sitter → owner | communication, pet as described, handover |

About 14 new keys per dictionary. The Lithuanian will again be written by me and
unproofread — see the open Lithuanian proofread thread, which this grows.

## Rollout

The read surface is already live. Renaming `owner_id` renames its foreign key, and
`ReviewList` embeds the author by that name, so old code and new schema disagree in one
direction or the other. Migration goes **first**:

- **Migration first, deploy immediately after** — the old `ReviewList` embed 400s,
  rendering an empty list. There are 0 reviews, so users see no difference. Sitter cards
  are unaffected because `sitter_ratings` keeps its columns.
- **Deploy first** would break the profile list *and* the whole write flow for everyone
  until the migration landed. Rejected.

Rollback is the previous migration, and stays cheap only while the table is empty.

## Verification

- **RLS is proved, not read.** Each rule is exercised by impersonating a role inside a
  transaction (`set local role authenticated` with chosen `request.jwt.claims`), then
  rolled back: an owner cannot file a `sitter_to_owner` review; a sitter cannot review
  an owner they never sat for; an unrelated sitter sees zero `sitter_to_owner` rows;
  `anon` sees only the public direction.
- **Catalogue checks, not success flags** — constraints, policies and indexes read back
  from `pg_*` after applying.
- **Unit tests** for the direction-specific dimension sets, the `author_id` filter, the
  new component and hook. The existing 76 review tests carry over with a direction.
- `tsc`, the full suite, and a clean `next build`.
- **No review rows are written to production.** The dev sandbox route stays the way the
  flow is exercised by hand, and grows the second direction.

## Explicitly not in this work

- The post-completion prompt and any notification or email change.
- `profiles` still lets any signed-in user read every other user's phone number. That
  matters more once sitters are reading owner reputation, but it is a separate change:
  RLS cannot say "this column, only on your own row", so it needs a public-profile view
  and a locked-down base table.
