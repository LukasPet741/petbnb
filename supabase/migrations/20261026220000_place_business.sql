-- Businesses on the places map (PetBnB ecosystem plan, "How businesses fit the business model"):
--   1. "Is this your business?": a signed-in user claims a place; an admin checks and approves it
--      (sets places.owner_user_id) or rejects it with a reason the claimant sees.
--   2. An owner edits their own page's words, hours, website, accepted pets and services; never its
--      tier, status, name, logo or consent records, which stay the admin's.
--   3. The Bookable tier: owners send a booking request to a bookable place; its owner accepts or
--      declines it with a note; the requester can cancel. Both read only what they need.
--   4. Pet owners per city, for a business owner only (the plan's partner sales tool), with the
--      same floor of 5 as the sitters.
-- Promoted places need no table: places.tier = 'promoted' is set by an admin, and the map labels it.
-- No email and no notification: everything is read in the app. Needs 20261026180000 and 20261026210000.

create table public.place_claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'employee')),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (place_id, user_id),
  constraint place_claims_rejection_has_reason check (status <> 'rejected' or decided_reason is not null)
);

create table public.place_booking_requests (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pet_id uuid references public.pets(id) on delete set null,
  service_name text not null check (char_length(btrim(service_name)) between 1 and 120),
  preferred_date date not null,
  preferred_time text not null check (preferred_time in ('morning', 'afternoon', 'evening')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  response_note text check (response_note is null or char_length(response_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index place_claims_place_id_idx on public.place_claims (place_id);
create index place_claims_user_id_idx on public.place_claims (user_id);
create index place_booking_requests_place_id_idx on public.place_booking_requests (place_id, preferred_date);
create index place_booking_requests_requester_id_idx on public.place_booking_requests (requester_id);
create index place_booking_requests_pet_id_idx on public.place_booking_requests (pet_id);

create trigger place_booking_requests_touch_updated_at before update on public.place_booking_requests
  for each row execute function public.places_touch_updated_at();

alter table public.place_claims enable row level security;
alter table public.place_booking_requests enable row level security;

-- Claims: a signed-in user files one per place and follows its status; an admin decides.
create policy "Users claim published places" on public.place_claims
  for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and decided_reason is null
    and exists (select 1 from public.places p where p.id = place_id and p.status = 'published' and p.owner_user_id is null));
create policy "Users read their own claims" on public.place_claims
  for select to authenticated using (user_id = auth.uid());

-- An owner reads their own place in any status, and edits only its words.
create policy "Owners read their own places" on public.places
  for select to authenticated using (owner_user_id = auth.uid());
create policy "Owners edit their own places" on public.places
  for update to authenticated using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
grant update (description_lt, description_en, hours_lt, hours_en, prices_note_lt, prices_note_en, website_url, accepts)
  on public.places to authenticated;

create policy "Owners read their places' services" on public.place_services
  for select to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.owner_user_id = auth.uid()));
create policy "Owners add services" on public.place_services
  for insert to authenticated
  with check (exists (select 1 from public.places p where p.id = place_id and p.owner_user_id = auth.uid()));
create policy "Owners change services" on public.place_services
  for update to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.owner_user_id = auth.uid()))
  with check (exists (select 1 from public.places p where p.id = place_id and p.owner_user_id = auth.uid()));
create policy "Owners remove services" on public.place_services
  for delete to authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.owner_user_id = auth.uid()));
grant insert, delete on public.place_services to authenticated;
grant update (name_lt, name_en, price_from, price_to, unit_lt, unit_en, url, sort_order) on public.place_services to authenticated;

-- Booking requests: the requester writes one for a bookable place, with their own pet if any,
-- and reads their own. Status changes go through the two functions below, never a raw update.
create policy "Owners request bookings at bookable places" on public.place_booking_requests
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'requested' and response_note is null
    and preferred_date >= current_date
    and exists (select 1 from public.places p where p.id = place_id and p.status = 'published' and p.tier = 'bookable')
    and (pet_id is null or exists (select 1 from public.pets pt where pt.id = pet_id and pt.owner_id = auth.uid())));
create policy "Requesters read their own booking requests" on public.place_booking_requests
  for select to authenticated using (requester_id = auth.uid());

revoke all on public.place_claims, public.place_booking_requests from anon, authenticated;
grant select, insert on public.place_claims to authenticated;
grant select, insert on public.place_booking_requests to authenticated;

-- The requester cancels a request that is still open.
create function public.cancel_place_booking_request(p_request uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.place_booking_requests set status = 'cancelled'
    where id = p_request and requester_id = auth.uid() and status in ('requested', 'accepted')
    returning id
  )
  select exists (select 1 from done);
$$;

-- The place's owner accepts or declines an open request, with an optional note.
create function public.respond_place_booking_request(p_request uuid, p_accept boolean, p_note text default null)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with done as (
    update public.place_booking_requests r
    set status = case when p_accept then 'accepted' else 'declined' end,
        response_note = nullif(left(btrim(coalesce(p_note, '')), 500), '')
    from public.places p
    where r.id = p_request and p.id = r.place_id and p.owner_user_id = auth.uid() and r.status = 'requested'
    returning r.id
  )
  select exists (select 1 from done);
$$;

-- The requests for the caller's own places, with what the business needs and no more: the
-- requester's first name and initial, the pet's name, kind and weight.
create function public.my_place_booking_requests()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id, 'place_slug', p.slug, 'place_name', p.name, 'service_name', r.service_name,
    'preferred_date', r.preferred_date, 'preferred_time', r.preferred_time, 'note', r.note,
    'status', r.status, 'response_note', r.response_note, 'created_at', r.created_at,
    'requester', public.public_author_name(r.requester_id),
    'pet_name', pt.name, 'pet_type', pt.type, 'pet_weight_kg', pt.weight_kg
  ) order by r.preferred_date, r.created_at), '[]'::jsonb)
  from public.place_booking_requests r
  join public.places p on p.id = r.place_id
  left join public.pets pt on pt.id = r.pet_id
  where p.owner_user_id = auth.uid();
$$;

-- Pet owners per city, for someone who owns a place: the plan's "1,200 dog owners near you".
create function public.owner_counts_by_city()
returns table (city text, owners integer)
language sql
stable
security definer
set search_path = ''
as $$
  select btrim(pr.city), count(distinct pr.id)::integer
  from public.profiles pr
  join public.pets pt on pt.owner_id = pr.id and pt.archived_at is null
  where exists (select 1 from public.places p where p.owner_user_id = auth.uid())
    and pr.deleted_at is null and pr.city is not null and btrim(pr.city) <> ''
  group by btrim(pr.city)
  having count(distinct pr.id) >= 5
  order by count(distinct pr.id) desc;
$$;

revoke all on function public.cancel_place_booking_request(uuid) from public, anon;
revoke all on function public.respond_place_booking_request(uuid, boolean, text) from public, anon;
revoke all on function public.my_place_booking_requests() from public, anon;
revoke all on function public.owner_counts_by_city() from public, anon;
grant execute on function public.cancel_place_booking_request(uuid) to authenticated;
grant execute on function public.respond_place_booking_request(uuid, boolean, text) to authenticated;
grant execute on function public.my_place_booking_requests() to authenticated;
grant execute on function public.owner_counts_by_city() to authenticated;
