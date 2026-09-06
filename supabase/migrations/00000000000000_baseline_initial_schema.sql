-- Baseline: the schema as it stood before migration tracking began.
--
-- profiles, pets and bookings were created through the Supabase dashboard, so
-- no migration ever recorded them: the first tracked migration (20260601161429)
-- already assumes they exist. This file reconstructs that starting point from
-- the live catalog (pg_constraint, pg_indexes, pg_policies, pg_get_triggerdef)
-- so "supabase db reset" can rebuild the database from zero.
--
-- Written to be idempotent, so running it against the existing production
-- database is a no-op rather than an error.
--
-- Deliberately reflects the PRE-migration state: the four sitter-verification
-- columns (20260621105214) and "locale" (20260830085940) are added by their own
-- migrations and must not appear here.

create extension if not exists pgcrypto;

-- profiles: 1:1 with auth.users, created by the on_auth_user_created trigger.
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  full_name        text,
  phone            text,
  city             text,
  is_sitter        boolean default false,
  rate_per_hour    numeric,
  services         jsonb,
  about_me         text,
  avatar_url       text,
  experience_years integer,
  last_active_at   timestamptz default now(),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index if not exists idx_profiles_is_sitter on public.profiles using btree (is_sitter);

create table if not exists public.pets (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('dog','cat','bird','reptile','small_mammal','fish','other')),
  sex        text check (sex in ('male','female','unknown')),
  weight_kg  numeric,
  bio        text,
  photo_url  text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_pets_owner_id on public.pets using btree (owner_id);

create table if not exists public.bookings (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  sitter_id  uuid not null references public.profiles(id) on delete cascade,
  pet_id     uuid not null references public.pets(id) on delete cascade,
  service    text not null check (service in ('walking','boarding','daycare','grooming')),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  address    text,
  notes      text,
  status     text not null default 'pending'
               check (status in ('pending','signed','declined','cancelled','completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bookings_owner_id  on public.bookings using btree (owner_id);
create index if not exists idx_bookings_sitter_id on public.bookings using btree (sitter_id);
create index if not exists idx_bookings_pet_id    on public.bookings using btree (pet_id);
create index if not exists idx_bookings_start_at  on public.bookings using btree (start_at);
create index if not exists idx_bookings_status    on public.bookings using btree (status);

alter table public.profiles enable row level security;
alter table public.pets     enable row level security;
alter table public.bookings enable row level security;

-- NOTE: these policies predate the later convention of scoping with
-- "to authenticated", so they apply "to public" -- which is why the linter
-- reports multiple permissive policies for the anon role. Nothing leaks
-- (auth.uid() is null for anon, so every predicate is false), but they are
-- evaluated for anonymous requests too. Reproduced here exactly as deployed.

-- profiles: any caller can read any profile -- browse and sitters need it.
drop policy if exists "Users can view any profile" on public.profiles;
create policy "Users can view any profile" on public.profiles
  for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can view their own pets" on public.pets;
create policy "Users can view their own pets" on public.pets
  for select using (auth.uid() = owner_id);

-- A sitter must be able to see the pet they have been booked to care for.
drop policy if exists "Sitters can view pets in their bookings" on public.pets;
create policy "Sitters can view pets in their bookings" on public.pets
  for select using (
    exists (select 1 from public.bookings
             where bookings.pet_id = pets.id and bookings.sitter_id = auth.uid())
  );

drop policy if exists "Users can insert their own pets" on public.pets;
create policy "Users can insert their own pets" on public.pets
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own pets" on public.pets;
create policy "Users can update their own pets" on public.pets
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their own pets" on public.pets;
create policy "Users can delete their own pets" on public.pets
  for delete using (auth.uid() = owner_id);

-- bookings: both parties read; the owner creates, both may update status.
drop policy if exists "Owners can view their own bookings" on public.bookings;
create policy "Owners can view their own bookings" on public.bookings
  for select using (auth.uid() = owner_id);

drop policy if exists "Sitters can view their bookings" on public.bookings;
create policy "Sitters can view their bookings" on public.bookings
  for select using (auth.uid() = sitter_id);

drop policy if exists "Owners can insert their own bookings" on public.bookings;
create policy "Owners can insert their own bookings" on public.bookings
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners can update their own bookings" on public.bookings;
create policy "Owners can update their own bookings" on public.bookings
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "Sitters can update their bookings" on public.bookings;
create policy "Sitters can update their bookings" on public.bookings
  for update using (auth.uid() = sitter_id) with check (auth.uid() = sitter_id);

drop policy if exists "Owners can delete their own bookings" on public.bookings;
create policy "Owners can delete their own bookings" on public.bookings
  for delete using (auth.uid() = owner_id);

-- Every new auth user gets a profile row. Reconstructed in its PRE-fix form:
-- 20260601161429 is the migration that adds SECURITY DEFINER and pins
-- search_path, so this deliberately has neither.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
as $$
begin
  insert into profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
