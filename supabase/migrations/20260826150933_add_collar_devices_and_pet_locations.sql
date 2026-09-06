create extension if not exists pgcrypto;

create table public.collar_devices (
  id uuid primary key default gen_random_uuid(),
  pet_id uuid not null references public.pets(id) on delete cascade,
  device_secret_hash text not null,
  label text,
  created_at timestamptz not null default now()
);

alter table public.collar_devices enable row level security;

create policy "Owners manage their own collar devices"
  on public.collar_devices
  for all
  using (exists (select 1 from public.pets where pets.id = collar_devices.pet_id and pets.owner_id = auth.uid()))
  with check (exists (select 1 from public.pets where pets.id = collar_devices.pet_id and pets.owner_id = auth.uid()));

create table public.pet_locations (
  id bigint generated always as identity primary key,
  pet_id uuid not null references public.pets(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed_kmh double precision,
  battery_pct smallint,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index pet_locations_pet_id_recorded_at_idx on public.pet_locations (pet_id, recorded_at desc);

alter table public.pet_locations enable row level security;

create policy "Owners view their pets' locations"
  on public.pet_locations
  for select
  using (exists (select 1 from public.pets where pets.id = pet_locations.pet_id and pets.owner_id = auth.uid()));

-- No insert/update/delete policy for anon/authenticated: rows are written only by the
-- collar-ingest Edge Function using the service role key, which bypasses RLS. This
-- keeps the service role key off the physical collar device entirely.
