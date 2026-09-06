-- Collars turned out to be a standalone tracked device, not something tied to a
-- specific pet -- rework the schema before any real device has used it.
drop function if exists public.verify_collar_device(uuid, text);
drop function if exists public.register_collar_device(uuid, text, text);
drop table if exists public.pet_locations;
drop table if exists public.collar_devices;

create table public.collar_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  device_secret_hash text not null,
  label text,
  created_at timestamptz not null default now()
);

alter table public.collar_devices enable row level security;

create policy "Owners manage their own collar devices"
  on public.collar_devices
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table public.collar_locations (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.collar_devices(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  speed_kmh double precision,
  battery_pct smallint,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index collar_locations_device_id_recorded_at_idx on public.collar_locations (device_id, recorded_at desc);

alter table public.collar_locations enable row level security;

create policy "Owners view their own collar locations"
  on public.collar_locations
  for select
  using (exists (select 1 from public.collar_devices where collar_devices.id = collar_locations.device_id and collar_devices.owner_id = auth.uid()));

-- No insert/update/delete policy for anon/authenticated: rows are written only by the
-- collar-ingest Edge Function using the service role key, which bypasses RLS. This
-- keeps the service role key off the physical collar device entirely.

-- Owner-only: pairs a new collar to the caller's own account and returns its id.
-- owner_id comes from auth.uid(), never from a client-supplied argument.
create function public.register_collar_device(p_secret text, p_label text default null)
returns uuid
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  new_id uuid;
begin
  insert into public.collar_devices (owner_id, device_secret_hash, label)
  values (auth.uid(), crypt(p_secret, gen_salt('bf')), p_label)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.register_collar_device(text, text) to authenticated;

-- Called by the collar-ingest Edge Function (service role) to resolve a device_id +
-- plaintext secret to the account it belongs to, without the secret leaving the database.
create function public.verify_collar_device(p_device_id uuid, p_secret text)
returns table (owner_id uuid)
language sql
security definer
set search_path = public, extensions
as $$
  select owner_id from public.collar_devices
  where id = p_device_id
    and device_secret_hash = crypt(p_secret, device_secret_hash);
$$;

revoke all on function public.verify_collar_device(uuid, text) from public, anon, authenticated;
