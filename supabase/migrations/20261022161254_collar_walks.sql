-- Collar walks (docs/superpowers/specs/2026-10-22-collar-walks-design.md).
--
-- A walk marks a stretch of a collar's fixes: the sitter of a running booking or the owner presses
-- Start, then Stop, and the real fixes in between are copied onto the row. The Pi is unchanged.
-- Every write, and every read a sitter makes, goes through the security definer functions below:
-- no policy on collar_devices or collar_locations lets a sitter in, because that would put the
-- owner's collar in the sitter's own collar list and show them its secret hash and pair code.
-- A walk nobody stopped is closed by whichever function next touches its collar.

create table public.collar_walks (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.collar_devices(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  walker_id uuid references public.profiles(id) on delete set null,
  booking_id uuid references public.bookings(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text check (end_reason in ('stopped', 'time_limit', 'no_signal')),
  points jsonb,
  constraint collar_walks_end_check check ((ended_at is null) = (end_reason is null)),
  constraint collar_walks_points_check check (
    ended_at is null or (jsonb_typeof(points) = 'array' and jsonb_array_length(points) >= 2)
  )
);

-- One walk at a time per collar.
create unique index collar_walks_one_running on public.collar_walks (device_id) where ended_at is null;
create index collar_walks_device_started_idx on public.collar_walks (device_id, started_at desc);
create index collar_walks_owner_id_idx on public.collar_walks (owner_id);
create index collar_walks_walker_id_idx on public.collar_walks (walker_id);
create index collar_walks_booking_id_idx on public.collar_walks (booking_id);

alter table public.collar_walks enable row level security;
-- Read-only, for "Download my data"; the app itself reads through the functions.
create policy "Owners and walkers read walks" on public.collar_walks
  for select to authenticated
  using (owner_id = (select auth.uid()) or walker_id = (select auth.uid()));

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'booking_requested', 'booking_accepted', 'booking_declined', 'booking_cancelled', 'booking_completed',
  'message_received', 'offer_received', 'price_agreed', 'walk_started', 'walk_finished'
]));

-- The collar's real fixes in a window, oldest first, as the walk's points.
create function public._collar_walk_points(p_device_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('lat', l.lat, 'lng', l.lng, 'speed_kmh', l.speed_kmh, 'recorded_at', l.recorded_at)
      order by l.recorded_at
    ),
    '[]'::jsonb
  )
  from public.collar_locations l
  where l.device_id = p_device_id
    and l.source = 'collar'
    and l.recorded_at >= p_from
    and l.recorded_at <= p_to;
$$;

-- A walk as the app sees it. A running walk carries its live points, never past the 2 h cap.
create function public._collar_walk_json(p_walk public.collar_walks)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_walk.id,
    'device_id', p_walk.device_id,
    'booking_id', p_walk.booking_id,
    'walker_id', p_walk.walker_id,
    'walker_name', (select p.full_name from public.profiles p where p.id = p_walk.walker_id),
    'walked_by_me', coalesce(p_walk.walker_id = auth.uid(), false),
    'started_at', p_walk.started_at,
    'ended_at', p_walk.ended_at,
    'end_reason', p_walk.end_reason,
    'points', case
      when p_walk.ended_at is null then public._collar_walk_points(
        p_walk.device_id, p_walk.started_at, least(now(), p_walk.started_at + interval '2 hours'))
      else p_walk.points
    end
  );
$$;

-- Ends a running walk at p_end: 'saved' with its fixes copied, 'dropped' (row deleted) with fewer
-- than two, 'gone' if it had already ended. The owner hears about a sitter's walk.
create function public._finish_collar_walk(p_walk_id uuid, p_reason text, p_end timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_walk public.collar_walks%rowtype;
  v_points jsonb;
begin
  select * into v_walk from public.collar_walks w where w.id = p_walk_id and w.ended_at is null for update;
  if not found then
    return 'gone';
  end if;

  v_points := public._collar_walk_points(v_walk.device_id, v_walk.started_at, p_end);
  if jsonb_array_length(v_points) < 2 then
    delete from public.collar_walks w where w.id = v_walk.id;
    return 'dropped';
  end if;

  update public.collar_walks w
  set ended_at = p_end, end_reason = p_reason, points = v_points
  where w.id = v_walk.id;

  if v_walk.booking_id is not null and v_walk.walker_id is distinct from v_walk.owner_id then
    insert into public.notifications (user_id, actor_id, booking_id, type)
    values (v_walk.owner_id, v_walk.walker_id, v_walk.booking_id, 'walk_finished');
  end if;
  return 'saved';
end;
$$;

-- Closes the collar's running walk if it is past 2 h or the collar has been silent for 10 min.
-- Either way it ends at its last fix, not at the moment somebody noticed.
create function public._close_expired_collar_walks(p_device_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_walk public.collar_walks%rowtype;
  v_last timestamptz;
begin
  for v_walk in
    select * from public.collar_walks w where w.device_id = p_device_id and w.ended_at is null
  loop
    select max(l.recorded_at) into v_last
    from public.collar_locations l
    where l.device_id = v_walk.device_id
      and l.source = 'collar'
      and l.recorded_at >= v_walk.started_at
      and l.recorded_at <= v_walk.started_at + interval '2 hours';

    if now() > v_walk.started_at + interval '2 hours' then
      perform public._finish_collar_walk(v_walk.id, 'time_limit', coalesce(v_last, v_walk.started_at));
    elsif coalesce(v_last, v_walk.started_at) < now() - interval '10 minutes' then
      perform public._finish_collar_walk(v_walk.id, 'no_signal', coalesce(v_last, v_walk.started_at));
    end if;
  end loop;
end;
$$;

-- Unpairing and "Delete my account" both free the collar: its walks go with its fixes.
create function public._collar_owner_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.collar_walks w where w.device_id = old.id;
  return new;
end;
$$;

create trigger collar_owner_changed_drop_walks
  after update of owner_id on public.collar_devices
  for each row
  when (old.owner_id is distinct from new.owner_id)
  execute function public._collar_owner_changed();

-- Start: the owner on their own real collar (no booking), or the sitter of a signed walking,
-- boarding or daycare booking from an hour before it starts until it ends, on that owner's collar.
create function public.start_collar_walk(p_device_id uuid, p_booking_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_device public.collar_devices%rowtype;
  v_booking public.bookings%rowtype;
  v_id uuid;
begin
  select * into v_device from public.collar_devices d where d.id = p_device_id;
  if not found or v_device.is_demo or v_device.owner_id is null then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if p_booking_id is null then
    if v_device.owner_id is distinct from v_uid then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  else
    select * into v_booking from public.bookings b where b.id = p_booking_id;
    if not found
      or v_booking.sitter_id is distinct from v_uid
      or v_booking.owner_id is distinct from v_device.owner_id
      or v_booking.status <> 'signed'
      or v_booking.service not in ('walking', 'boarding', 'daycare')
      or now() < v_booking.start_at - interval '1 hour'
      or now() >= v_booking.end_at
    then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  end if;

  perform public._close_expired_collar_walks(p_device_id);

  begin
    insert into public.collar_walks (device_id, owner_id, walker_id, booking_id)
    values (p_device_id, v_device.owner_id, v_uid, p_booking_id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'walk_running' using errcode = 'P0001';
  end;

  if p_booking_id is not null then
    insert into public.notifications (user_id, actor_id, booking_id, type)
    values (v_device.owner_id, v_uid, p_booking_id, 'walk_started');
  end if;
  return v_id;
end;
$$;

-- Stop: the walker or the collar's owner. 'saved' or 'dropped'; a walk that already ended (it
-- timed out, or the other party stopped it) answers as it ended.
create function public.stop_collar_walk(p_walk_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_walk public.collar_walks%rowtype;
begin
  select * into v_walk from public.collar_walks w
  where w.id = p_walk_id and (w.walker_id = auth.uid() or w.owner_id = auth.uid());
  if not found then
    raise exception 'not_your_walk' using errcode = '42501';
  end if;

  perform public._close_expired_collar_walks(v_walk.device_id);
  select * into v_walk from public.collar_walks w where w.id = p_walk_id;
  if not found then
    return 'dropped';
  end if;
  if v_walk.ended_at is not null then
    return 'saved';
  end if;
  return public._finish_collar_walk(p_walk_id, 'stopped', now());
end;
$$;

-- The owner's view of one collar: the running walk (anyone's) and the last 3 saved ones.
create function public.collar_walks_for_device(p_device_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.collar_devices d where d.id = p_device_id and d.owner_id = auth.uid()
  ) then
    raise exception 'not_your_collar' using errcode = '42501';
  end if;

  perform public._close_expired_collar_walks(p_device_id);

  return jsonb_build_object(
    'running', (
      select public._collar_walk_json(w) from public.collar_walks w
      where w.device_id = p_device_id and w.ended_at is null
    ),
    'recent', coalesce((
      select jsonb_agg(public._collar_walk_json(w) order by w.started_at desc)
      from public.collar_walks w
      where w.id in (
        select r.id from public.collar_walks r
        where r.device_id = p_device_id and r.ended_at is not null
        order by r.started_at desc
        limit 3
      )
    ), '[]'::jsonb)
  );
end;
$$;

-- The sitter's view of one booking: the owner's real collars while a walk may start, the sitter's
-- own running walk, and the sitter's last 3 saved walks on this booking.
create function public.collar_walks_for_booking(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_open boolean;
begin
  select * into v_booking from public.bookings b where b.id = p_booking_id and b.sitter_id = v_uid;
  if not found then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  perform public._close_expired_collar_walks(d.id)
  from public.collar_devices d
  where d.owner_id = v_booking.owner_id and not d.is_demo;

  v_open := v_booking.status = 'signed'
    and v_booking.service in ('walking', 'boarding', 'daycare')
    and now() >= v_booking.start_at - interval '1 hour'
    and now() < v_booking.end_at;

  return jsonb_build_object(
    'collars', case when v_open then coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'label', d.label) order by d.last_seen_at desc nulls last)
      from public.collar_devices d
      where d.owner_id = v_booking.owner_id and not d.is_demo
    ), '[]'::jsonb) else '[]'::jsonb end,
    'running', (
      select public._collar_walk_json(w) from public.collar_walks w
      where w.booking_id = p_booking_id and w.walker_id = v_uid and w.ended_at is null
      limit 1
    ),
    'recent', coalesce((
      select jsonb_agg(public._collar_walk_json(w) order by w.started_at desc)
      from public.collar_walks w
      where w.id in (
        select r.id from public.collar_walks r
        where r.booking_id = p_booking_id and r.walker_id = v_uid and r.ended_at is not null
        order by r.started_at desc
        limit 3
      )
    ), '[]'::jsonb)
  );
end;
$$;

-- One walk for its walker or the collar's owner; null for anyone else (the page says "not
-- available"). A sitter sees the collar's status only while their walk runs.
create function public.get_collar_walk(p_walk_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_walk public.collar_walks%rowtype;
  v_device public.collar_devices%rowtype;
begin
  select * into v_walk from public.collar_walks w
  where w.id = p_walk_id and (w.owner_id = v_uid or w.walker_id = v_uid);
  if not found then
    return null;
  end if;

  perform public._close_expired_collar_walks(v_walk.device_id);
  select * into v_walk from public.collar_walks w where w.id = p_walk_id;
  if not found then
    return null;
  end if;

  select * into v_device from public.collar_devices d where d.id = v_walk.device_id;
  return jsonb_build_object(
    'walk', public._collar_walk_json(v_walk),
    'collar', case when v_walk.ended_at is null or v_walk.owner_id = v_uid then jsonb_build_object(
      'label', v_device.label,
      'last_seen_at', v_device.last_seen_at,
      'gps_locked', v_device.gps_locked,
      'gps_satellites', v_device.gps_satellites
    ) end,
    'pet_name', (
      select p.name from public.bookings b join public.pets p on p.id = b.pet_id where b.id = v_walk.booking_id
    ),
    'is_owner', v_walk.owner_id = v_uid,
    'can_stop', v_walk.ended_at is null
  );
end;
$$;

revoke all on function public._collar_walk_points(uuid, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public._collar_walk_json(public.collar_walks) from public, anon, authenticated;
revoke all on function public._finish_collar_walk(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public._close_expired_collar_walks(uuid) from public, anon, authenticated;
revoke all on function public._collar_owner_changed() from public, anon, authenticated;
revoke all on function public.start_collar_walk(uuid, uuid) from public, anon;
grant execute on function public.start_collar_walk(uuid, uuid) to authenticated;
revoke all on function public.stop_collar_walk(uuid) from public, anon;
grant execute on function public.stop_collar_walk(uuid) to authenticated;
revoke all on function public.collar_walks_for_device(uuid) from public, anon;
grant execute on function public.collar_walks_for_device(uuid) to authenticated;
revoke all on function public.collar_walks_for_booking(uuid) from public, anon;
grant execute on function public.collar_walks_for_booking(uuid) to authenticated;
revoke all on function public.get_collar_walk(uuid) from public, anon;
grant execute on function public.get_collar_walk(uuid) to authenticated;
