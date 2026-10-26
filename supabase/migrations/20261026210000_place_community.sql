-- Community on the places map (PetBnB ecosystem plan, "Social, kept small at first"):
--   1. reviews of places, only from signed-in owners, with a report button;
--   2. posts tied to a pin ("Reksas was at Dogiday"), shown on that place's panel;
--   3. opt-in public pet profiles (name, photo, kind of animal) and the places a pet goes.
-- Anything users post can be reported, and PetBnB states its reason when it hides something
-- (EU Digital Services Act, arts. 16-17): a hidden row must carry hidden_reason, which its author
-- still sees. Hiding and report handling are the service role's (an admin), never the API's.
--
-- No email, no notification, nothing leaves the database. Public reads go through two functions
-- that return a first name and an initial, never a profile row. Needs 20261026180000_places.sql.

create table public.place_reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text check (body is null or char_length(body) <= 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  hidden_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One review per owner per place; they edit it rather than pile on.
  unique (place_id, author_id),
  constraint place_reviews_hidden_has_reason check (status = 'visible' or hidden_reason is not null)
);

create table public.place_posts (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 280),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  hidden_reason text,
  created_at timestamptz not null default now(),
  constraint place_posts_hidden_has_reason check (status = 'visible' or hidden_reason is not null)
);

-- The places a pet goes; shown on a place only while the pet's profile is public.
create table public.pet_places (
  pet_id uuid not null references public.pets(id) on delete cascade,
  place_id uuid not null references public.places(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pet_id, place_id)
);

-- Off until the owner turns it on, pet by pet.
alter table public.pets add column is_public boolean not null default false;

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid default auth.uid() references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('place_review', 'place_post', 'pet')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'offensive', 'false', 'private', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create index place_reviews_place_id_idx on public.place_reviews (place_id);
create index place_reviews_author_id_idx on public.place_reviews (author_id);
create index place_posts_place_id_idx on public.place_posts (place_id, created_at desc);
create index place_posts_author_id_idx on public.place_posts (author_id);
create index place_posts_pet_id_idx on public.place_posts (pet_id);
create index pet_places_place_id_idx on public.pet_places (place_id);
create index content_reports_reporter_id_idx on public.content_reports (reporter_id);
create index content_reports_status_idx on public.content_reports (status, created_at);

create trigger place_reviews_touch_updated_at before update on public.place_reviews
  for each row execute function public.places_touch_updated_at();

alter table public.place_reviews enable row level security;
alter table public.place_posts enable row level security;
alter table public.pet_places enable row level security;
alter table public.content_reports enable row level security;

-- Reviews: an author reads, writes, edits and deletes their own (a hidden one, with its reason, too).
create policy "Authors read their own place reviews" on public.place_reviews
  for select to authenticated using (author_id = auth.uid());
create policy "Signed-in owners review published places" on public.place_reviews
  for insert to authenticated
  with check (author_id = auth.uid() and status = 'visible'
    and exists (select 1 from public.places p where p.id = place_id and p.status = 'published'));
create policy "Authors edit their own place reviews" on public.place_reviews
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "Authors delete their own place reviews" on public.place_reviews
  for delete to authenticated using (author_id = auth.uid());

-- Posts: the same, without editing (delete and post again); a pet named must be the author's.
create policy "Authors read their own place posts" on public.place_posts
  for select to authenticated using (author_id = auth.uid());
create policy "Signed-in owners post at published places" on public.place_posts
  for insert to authenticated
  with check (author_id = auth.uid() and status = 'visible'
    and exists (select 1 from public.places p where p.id = place_id and p.status = 'published')
    and (pet_id is null or exists (select 1 from public.pets pt where pt.id = pet_id and pt.owner_id = auth.uid())));
create policy "Authors delete their own place posts" on public.place_posts
  for delete to authenticated using (author_id = auth.uid());

-- A pet's places: its owner's to read and change.
create policy "Owners read their pets' places" on public.pet_places
  for select to authenticated
  using (exists (select 1 from public.pets pt where pt.id = pet_id and pt.owner_id = auth.uid()));
create policy "Owners add their pets' places" on public.pet_places
  for insert to authenticated
  with check (exists (select 1 from public.pets pt where pt.id = pet_id and pt.owner_id = auth.uid())
    and exists (select 1 from public.places p where p.id = place_id and p.status = 'published'));
create policy "Owners remove their pets' places" on public.pet_places
  for delete to authenticated
  using (exists (select 1 from public.pets pt where pt.id = pet_id and pt.owner_id = auth.uid()));

-- Reports: anyone signed in files one; nobody but an admin reads them.
create policy "Signed-in users report content" on public.content_reports
  for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');

-- Grants to match: no anon access to the tables at all, and authors may change only their words.
revoke all on public.place_reviews, public.place_posts, public.pet_places, public.content_reports from anon, authenticated;
grant select, insert, delete on public.place_reviews to authenticated;
grant update (rating, body) on public.place_reviews to authenticated;
grant select, insert, delete on public.place_posts to authenticated;
grant select, insert, delete on public.pet_places to authenticated;
grant insert on public.content_reports to authenticated;

-- "Emilija A.": what a review or post shows of its author, and nothing more.
create function public.public_author_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null or p.deleted_at is not null or coalesce(btrim(p.full_name), '') = '' then 'PetBnB'
    else split_part(btrim(p.full_name), ' ', 1)
      || coalesce(' ' || nullif(left(split_part(btrim(p.full_name), ' ', 2), 1), '') || '.', '')
  end
  from (select p_user as uid) u
  left join public.profiles p on p.id = u.uid;
$$;
revoke all on function public.public_author_name(uuid) from public, anon, authenticated;

-- A place's community, for its panel: visible reviews and their average, the latest visible posts,
-- and the public pets that go there. "mine" lets the signed-in author edit or delete their own.
create function public.place_community(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with place as (
    select id from public.places where slug = p_slug and status = 'published'
  ), reviews as (
    select r.* from public.place_reviews r join place on r.place_id = place.id where r.status = 'visible'
  )
  select case when not exists (select 1 from place) then null else jsonb_build_object(
    'place_id', (select id from place),
    'rating', jsonb_build_object(
      'average', (select round(avg(rating)::numeric, 1) from reviews),
      'count', (select count(*) from reviews)),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'rating', r.rating, 'body', r.body, 'created_at', r.created_at,
        'author', public.public_author_name(r.author_id), 'mine', coalesce(r.author_id = auth.uid(), false))
        order by r.created_at desc) from reviews r), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(x.post order by x.created_at desc) from (
        select jsonb_build_object(
          'id', po.id, 'body', po.body, 'created_at', po.created_at,
          'author', public.public_author_name(po.author_id), 'mine', coalesce(po.author_id = auth.uid(), false),
          'pet_name', pt.name, 'pet_type', pt.type,
          'pet_id', case when pt.is_public and pt.archived_at is null then pt.id end) as post,
          po.created_at
        from public.place_posts po join place on po.place_id = place.id
        left join public.pets pt on pt.id = po.pet_id
        where po.status = 'visible'
        order by po.created_at desc limit 30) x), '[]'::jsonb),
    'pets', coalesce((select jsonb_agg(jsonb_build_object('id', pt.id, 'name', pt.name, 'type', pt.type, 'photo_url', pt.photo_url)
        order by pp.created_at desc)
        from public.pet_places pp join place on pp.place_id = place.id
        join public.pets pt on pt.id = pp.pet_id
        where pt.is_public and pt.archived_at is null), '[]'::jsonb)
  ) end;
$$;

-- A public pet profile: name, kind, photo and the places it goes; null unless its owner made it public.
create function public.public_pet(p_pet uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', pt.id, 'name', pt.name, 'type', pt.type, 'photo_url', pt.photo_url,
    'places', coalesce((select jsonb_agg(jsonb_build_object('slug', p.slug, 'name', p.name, 'logo', p.logo_path) order by p.name)
      from public.pet_places pp join public.places p on p.id = pp.place_id
      where pp.pet_id = pt.id and p.status = 'published'), '[]'::jsonb))
  from public.pets pt
  where pt.id = p_pet and pt.is_public and pt.archived_at is null;
$$;

revoke all on function public.place_community(text) from public;
revoke all on function public.public_pet(uuid) from public;
grant execute on function public.place_community(text) to anon, authenticated;
grant execute on function public.public_pet(uuid) to anon, authenticated;
