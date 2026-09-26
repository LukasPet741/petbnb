-- Showcase (spec 2026-09-26-showcase-collar-smartid-design.md), part 1 of 2.
-- Collars are registered before anyone owns them and paired with the code on their sticker; the
-- Pi reports in even without a GPS fix; a recorded walk can be replayed into collar_locations.
-- ADDITIVE ONLY: register_collar_device and the "for all" policy stay, so today's Profile collar
-- panel keeps working until the web release applies the cleanup migration.

alter table public.collar_devices
  alter column owner_id drop not null,
  add column pair_code text unique check (pair_code ~ '^[0-9A-HJKMNP-TV-Z]{8}$'),
  add column claimed_at timestamptz,
  add column is_demo boolean not null default false,
  add column last_seen_at timestamptz,
  add column gps_locked boolean,
  add column gps_satellites smallint check (gps_satellites between 0 and 64);

-- One demo collar per account: create_demo_collar is get-or-create.
create unique index collar_devices_one_demo_per_owner on public.collar_devices (owner_id) where is_demo;

alter table public.collar_locations
  add column source text not null default 'collar' check (source in ('collar', 'replay'));

create index collar_locations_device_source_recorded_idx
  on public.collar_locations (device_id, source, recorded_at desc);

create table public.collar_recordings (
  id int generated always as identity primary key,
  name text not null,
  recorded_on date not null,
  points jsonb not null check (jsonb_typeof(points) = 'array' and jsonb_array_length(points) > 0),
  created_at timestamptz not null default now()
);
-- RLS on and no policies: only replay_collar_point (security definer) reads recordings.
alter table public.collar_recordings enable row level security;

alter publication supabase_realtime add table public.collar_locations, public.collar_devices;

-- The same forgiving cleanup the browser does: case, dashes, spaces, O/I/L typos.
create function public.clean_pair_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(translate(upper(coalesce(p_code, '')), 'OIL', '011'), '[^0-9A-Z]', '', 'g');
$$;

create function public.claim_collar(p_code text, p_label text default null)
returns table (device_id uuid, result text)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_device public.collar_devices%rowtype;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_device
  from public.collar_devices d
  where d.pair_code = public.clean_pair_code(p_code)
  for update;

  if not found then
    return query select null::uuid, 'not_found'::text;
    return;
  end if;
  if v_device.owner_id = v_uid then
    return query select v_device.id, 'already_yours'::text;
    return;
  end if;
  if v_device.owner_id is not null then
    return query select null::uuid, 'taken'::text;
    return;
  end if;

  update public.collar_devices d
  set owner_id = v_uid,
      claimed_at = now(),
      label = coalesce(nullif(btrim(p_label), ''), d.label)
  where d.id = v_device.id;

  return query select v_device.id, 'paired'::text;
end;
$$;

-- Removing a real collar frees its sticker code and deletes its history; a demo collar just goes.
create function public.unpair_collar(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_device public.collar_devices%rowtype;
begin
  select * into v_device
  from public.collar_devices d
  where d.id = p_device_id and d.owner_id = auth.uid()
  for update;

  if not found then
    raise exception 'not_your_collar' using errcode = '42501';
  end if;

  if v_device.is_demo then
    delete from public.collar_devices d where d.id = v_device.id;
  else
    delete from public.collar_locations l where l.device_id = v_device.id;
    update public.collar_devices d
    set owner_id = null, claimed_at = null, label = null
    where d.id = v_device.id;
  end if;
end;
$$;

create function public.create_demo_collar()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select d.id into v_id from public.collar_devices d where d.owner_id = v_uid and d.is_demo;
  if v_id is not null then
    return v_id;
  end if;

  -- The secret is thrown away: a demo collar never uplinks, it only receives replays.
  insert into public.collar_devices (owner_id, device_secret_hash, label, is_demo, claimed_at)
  values (v_uid, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')), 'Recorded walk', true, now())
  returning id into v_id;
  return v_id;
end;
$$;

-- One point of the newest recording, stamped now and marked as a replay. The page calls this
-- every 2 s with the next index; nothing is stored about the replay itself.
create function public.replay_collar_point(p_device_id uuid, p_index int)
returns table (lat double precision, lng double precision, speed_kmh double precision, idx int, total int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_points jsonb;
  v_total int;
  v_point jsonb;
  v_lat double precision;
  v_lng double precision;
  v_speed double precision;
begin
  if not exists (
    select 1 from public.collar_devices d where d.id = p_device_id and d.owner_id = auth.uid()
  ) then
    raise exception 'not_your_collar' using errcode = '42501';
  end if;

  select r.points into v_points from public.collar_recordings r order by r.id desc limit 1;
  if v_points is null then
    raise exception 'no_recording' using errcode = 'P0002';
  end if;

  v_total := jsonb_array_length(v_points);
  if p_index is null or p_index < 0 or p_index >= v_total then
    raise exception 'out_of_range' using errcode = '22003';
  end if;

  v_point := v_points -> p_index;
  v_lat := (v_point ->> 'lat')::double precision;
  v_lng := (v_point ->> 'lng')::double precision;
  v_speed := nullif(v_point ->> 'speed_kmh', '')::double precision;

  insert into public.collar_locations (device_id, lat, lng, speed_kmh, recorded_at, source)
  values (p_device_id, v_lat, v_lng, v_speed, now(), 'replay');

  return query select v_lat, v_lng, v_speed, p_index, v_total;
end;
$$;

revoke all on function public.clean_pair_code(text) from public, anon;
grant execute on function public.clean_pair_code(text) to authenticated, service_role;
revoke all on function public.claim_collar(text, text) from public, anon;
grant execute on function public.claim_collar(text, text) to authenticated;
revoke all on function public.unpair_collar(uuid) from public, anon;
grant execute on function public.unpair_collar(uuid) to authenticated;
revoke all on function public.create_demo_collar() from public, anon;
grant execute on function public.create_demo_collar() to authenticated;
revoke all on function public.replay_collar_point(uuid, int) from public, anon;
grant execute on function public.replay_collar_point(uuid, int) to authenticated;
