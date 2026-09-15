-- Sitter pricing by period, and offers between owner and sitter.
-- Spec: docs/superpowers/specs/2026-09-15-sitter-pricing-and-offers-design.md
-- Approved by Lukas 2026-09-15 ("apply the fixes then push to main"). Applied to production
-- 2026-09-15 as 20260915141612; the statements below are what ran (the applied copy had fewer comments).
--
-- WHY. Every sitter had one rate_per_hour for every service, so a two-day boarding request
-- showed EUR 624, and a booking stored no price at all. Sitters now price a period per service
-- (the period price is the minimum), a request freezes its asking price, and owner and sitter
-- settle the real price with offers in the booking's chat. Accepting records the agreed price.
--
-- BACKWARD COMPATIBLE on purpose: local development talks to this database, so this runs
-- before the new app is deployed. The live app's plain booking insert is priced here, and its
-- status-only accept still works while no offer exists (it records the asking price).
--
-- The same rules live in src/lib/pricing.ts so the UI only offers what this accepts.

-- ---------------------------------------------------------------------------------------------
-- 1. Prices on profiles
-- ---------------------------------------------------------------------------------------------

create or replace function public.price_amount_ok(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  -- A CASE, so the cast only ever sees digits.
  select case
    when jsonb_typeof(p_value) = 'number' and (p_value #>> '{}') ~ '^[0-9]{1,5}$'
      then (p_value #>> '{}')::int between 1 and 10000
    else false
  end;
$$;

create or replace function public.valid_prices(p_prices jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_entry record;
  v_keys  text;
begin
  if p_prices is null or jsonb_typeof(p_prices) <> 'object' then
    return false;
  end if;

  for v_entry in select key, value from jsonb_each(p_prices) loop
    if jsonb_typeof(v_entry.value) <> 'object' then
      return false;
    end if;
    if not public.price_amount_ok(v_entry.value -> 'amount') then
      return false;
    end if;

    select string_agg(k, ',' order by k) into v_keys from jsonb_object_keys(v_entry.value) as k;

    if v_entry.key = 'grooming' then
      if v_keys is distinct from 'amount' then
        return false;
      end if;
    elsif v_entry.key in ('walking', 'boarding', 'daycare') then
      if v_keys is distinct from 'amount,days'
         or jsonb_typeof(v_entry.value -> 'days') <> 'number'
         or (v_entry.value ->> 'days') not in ('1', '3', '7', '10', '14', '30') then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table public.profiles
  add column if not exists prices jsonb not null default '{}'::jsonb;

alter table public.profiles
  add constraint profiles_prices_valid check (public.valid_prices(prices));

-- SELECT on profiles is granted column by column (20260910120000, 20260910170000).
grant select (prices) on public.profiles to anon, authenticated;

-- my_profile lists its columns, so a new column has to be added to it by hand.
create or replace view public.my_profile as
  select id, full_name, phone, city, is_sitter, rate_per_hour, services, about_me, avatar_url,
         experience_years, last_active_at, created_at, updated_at, is_verified, verified_at,
         verified_full_name, smart_id_session_id, locale, prices
    from public.profiles
   where id = (select auth.uid());

-- ---------------------------------------------------------------------------------------------
-- 2. Prices on bookings, offers on messages, two notification types
-- ---------------------------------------------------------------------------------------------

alter table public.bookings
  add column if not exists days int constraint bookings_days_check check (days >= 1),
  add column if not exists asking_price int constraint bookings_asking_price_check check (asking_price between 1 and 10000),
  add column if not exists agreed_price int constraint bookings_agreed_price_check check (agreed_price between 1 and 10000);

alter table public.messages
  add column if not exists amount int;

alter table public.messages drop constraint messages_kind_check;
alter table public.messages
  add constraint messages_kind_check check (kind in ('user', 'system', 'offer'));

alter table public.messages drop constraint messages_event_check;
alter table public.messages
  add constraint messages_event_check
  check (event in ('requested', 'accepted', 'declined', 'cancelled', 'completed', 'agreed'));

alter table public.messages drop constraint messages_shape;
alter table public.messages
  add constraint messages_shape check (
    (kind = 'user' and body is not null and length(btrim(body)) > 0 and event is null and amount is null)
    or (kind = 'system' and event is not null and body is null and amount is null)
    or (kind = 'offer' and amount between 1 and 10000 and event is null
        and (body is null or length(btrim(body)) between 1 and 280))
  );

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'booking_requested', 'booking_accepted', 'booking_declined', 'booking_cancelled',
    'booking_completed', 'message_received', 'offer_received', 'price_agreed'
  ));

-- ---------------------------------------------------------------------------------------------
-- 3. The price of a stay
-- ---------------------------------------------------------------------------------------------

-- Every started 24 hours is a day ("para"), minimum 1.
create or replace function public.stay_days(p_start timestamptz, p_end timestamptz)
returns int
language sql
immutable
set search_path = ''
as $$
  select greatest(1, ceil(extract(epoch from (p_end - p_start)) / 86400.0))::int;
$$;

-- Grooming: the visit price. Otherwise the period price as a minimum, stretched for longer
-- stays, rounded half up. Null when the service has no price. Mirrors askingPrice().
create or replace function public.asking_price_for(p_prices jsonb, p_service text, p_days int)
returns int
language sql
immutable
set search_path = ''
as $$
  select case
    when p_service = 'grooming' then (p_prices -> 'grooming' ->> 'amount')::int
    when (p_prices -> p_service) ? 'days' then
      case
        when p_days <= (p_prices -> p_service ->> 'days')::int then (p_prices -> p_service ->> 'amount')::int
        else round((p_prices -> p_service ->> 'amount')::numeric * p_days
                   / (p_prices -> p_service ->> 'days')::numeric)::int
      end
  end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Booking rules (replaces 20260914193216's version)
-- ---------------------------------------------------------------------------------------------

create or replace function public.enforce_booking_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $body$
declare
  v_prices        jsonb;
  v_latest_sender uuid;
  v_latest_amount int;
  v_on_table      int;
begin
  -- Every request is priced from the sitter's list as it is now, whoever inserts it.
  if tg_op = 'INSERT' then
    select p.prices into v_prices from public.profiles p where p.id = new.sitter_id;
    new.days := public.stay_days(new.start_at, new.end_at);
    new.asking_price := public.asking_price_for(coalesce(v_prices, '{}'::jsonb), new.service, new.days);
  end if;

  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' then
      raise exception 'A booking starts as a pending request'
        using errcode = 'insufficient_privilege';
    end if;

    if new.owner_id = new.sitter_id then
      raise exception 'A booking cannot be made with yourself as the sitter'
        using errcode = 'check_violation';
    end if;

    if not exists (
      select 1 from public.pets where id = new.pet_id and owner_id = new.owner_id
    ) then
      raise exception 'A booking is for one of your own pets'
        using errcode = 'check_violation';
    end if;

    -- Strictly the JSON boolean true, as offeredServices() in src/lib/services.ts reads it.
    if not exists (
      select 1 from public.profiles where id = new.sitter_id and services -> new.service = 'true'::jsonb
    ) then
      raise exception 'The sitter does not offer this service'
        using errcode = 'check_violation';
    end if;

    if new.start_at < now() - interval '15 minutes' then
      raise exception 'A booking cannot start in the past'
        using errcode = 'check_violation';
    end if;

    if new.asking_price is null then
      raise exception 'The sitter has not set a price for this service'
        using errcode = 'check_violation', hint = 'unpriced_service';
    end if;

    new.agreed_price := null;
    return new;
  end if;

  -- UPDATE. updated_at is left out on purpose: bookings_set_updated_at owns it.
  if (new.id, new.owner_id, new.sitter_id, new.pet_id, new.service, new.start_at, new.end_at,
      new.address, new.notes, new.created_at, new.days, new.asking_price)
     is distinct from
     (old.id, old.owner_id, old.sitter_id, old.pet_id, old.service, old.start_at, old.end_at,
      old.address, old.notes, old.created_at, old.days, old.asking_price) then
    raise exception 'Only the status of a booking can change once it is requested'
      using errcode = 'insufficient_privilege';
  end if;

  if new.status is not distinct from old.status then
    if new.agreed_price is distinct from old.agreed_price then
      raise exception 'The agreed price is set only by accepting'
        using errcode = 'insufficient_privilege';
    end if;
    return new;
  end if;

  -- Accepting. Whoever did not put the price on the table accepts it: the sitter the asking
  -- price or the owner's offer, the owner the sitter's counter. The row is locked here, and
  -- the newest offer is read fresh, so an offer that landed a moment ago is what is compared.
  if old.status = 'pending' and new.status = 'signed' then
    if old.start_at < now() - interval '15 minutes' then
      raise exception 'This request has already started'
        using errcode = 'check_violation', hint = 'request_started';
    end if;

    select m.sender_id, m.amount into v_latest_sender, v_latest_amount
      from public.messages m
     where m.booking_id = old.id and m.kind = 'offer'
     order by m.created_at desc, m.id desc
     limit 1;

    v_on_table := coalesce(v_latest_amount, old.asking_price);

    if v_latest_sender is null or v_latest_sender = old.owner_id then
      if auth.uid() is distinct from old.sitter_id then
        raise exception 'Only the sitter can accept this price'
          using errcode = 'insufficient_privilege', hint = 'not_yours_to_accept';
      end if;
    elsif auth.uid() is distinct from old.owner_id then
      raise exception 'Only the owner can accept this price'
        using errcode = 'insufficient_privilege', hint = 'not_yours_to_accept';
    end if;

    -- A status-only accept (the pre-offers app) is fine while only the asking price is there.
    if new.agreed_price is null and v_latest_sender is null then
      new.agreed_price := v_on_table;
    elsif new.agreed_price is distinct from v_on_table then
      raise exception 'The price on the table has changed'
        using errcode = 'check_violation', hint = 'price_changed';
    end if;

    return new;
  end if;

  if new.agreed_price is distinct from old.agreed_price then
    raise exception 'The agreed price is set only by accepting'
      using errcode = 'insufficient_privilege';
  end if;

  if auth.uid() = old.owner_id
     and old.status in ('pending', 'signed') and new.status = 'cancelled' then
    return new;
  end if;

  if auth.uid() = old.sitter_id and (
       (old.status = 'pending' and new.status = 'declined')
    or (old.status = 'signed' and new.status = 'completed')
  ) then
    return new;
  end if;

  raise exception 'This booking cannot go from % to %', old.status, new.status
    using errcode = 'insufficient_privilege';
end;
$body$;

comment on trigger enforce_booking_rules on public.bookings is
  'Insert: pending only, own pet, offered and priced service, not self, not in the past; sets '
  'days and asking_price. Update: status only, plus agreed_price when accepting what is on the '
  'table (sitter: asking price or owner offer; owner: sitter counter). Service role and postgres '
  'bypass. See migrations 20260914193216 and 20260915141612.';

-- ---------------------------------------------------------------------------------------------
-- 5. Offer rules
-- ---------------------------------------------------------------------------------------------

create or replace function public.enforce_offer_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $body$
declare
  v_booking       public.bookings%rowtype;
  v_count         int;
  v_owner_latest  int;
  v_sitter_latest int;
begin
  if new.kind is distinct from 'offer' then
    return new;
  end if;

  -- Offers made in one transaction (a request with a first offer) still order correctly.
  new.created_at := clock_timestamp();

  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;

  -- Locked, so an accept and an offer on the same booking take turns.
  select * into v_booking from public.bookings where id = new.booking_id for update;
  if not found then
    raise exception 'No such booking' using errcode = 'check_violation';
  end if;

  if new.sender_id is distinct from v_booking.owner_id and new.sender_id is distinct from v_booking.sitter_id then
    raise exception 'Only the owner and the sitter make offers' using errcode = 'insufficient_privilege';
  end if;

  if v_booking.status <> 'pending' then
    raise exception 'Offers are made only on an open request'
      using errcode = 'check_violation', hint = 'request_closed';
  end if;

  if v_booking.service = 'grooming' then
    raise exception 'Grooming has a fixed price'
      using errcode = 'check_violation', hint = 'fixed_price';
  end if;

  if v_booking.start_at < now() - interval '15 minutes' then
    raise exception 'This request has already started'
      using errcode = 'check_violation', hint = 'request_started';
  end if;

  if v_booking.asking_price is null then
    raise exception 'This request has no asking price'
      using errcode = 'check_violation', hint = 'unpriced_service';
  end if;

  select count(*) into v_count
    from public.messages
   where booking_id = v_booking.id and kind = 'offer' and sender_id = new.sender_id;
  if v_count >= 3 then
    raise exception 'No offers left'
      using errcode = 'check_violation', hint = 'no_offers_left';
  end if;

  select amount into v_owner_latest
    from public.messages
   where booking_id = v_booking.id and kind = 'offer' and sender_id = v_booking.owner_id
   order by created_at desc, id desc limit 1;

  select amount into v_sitter_latest
    from public.messages
   where booking_id = v_booking.id and kind = 'offer' and sender_id = v_booking.sitter_id
   order by created_at desc, id desc limit 1;

  if new.amount >= v_booking.asking_price
     or (new.sender_id = v_booking.owner_id and (
           new.amount < ceil(v_booking.asking_price / 2.0)
           or new.amount >= coalesce(v_sitter_latest, v_booking.asking_price)))
     or (new.sender_id = v_booking.sitter_id and new.amount <= coalesce(v_owner_latest, 0)) then
    raise exception 'This offer is outside what can be offered now'
      using errcode = 'check_violation', hint = 'offer_out_of_bounds';
  end if;

  return new;
end;
$body$;

drop trigger if exists enforce_offer_rules on public.messages;
create trigger enforce_offer_rules
  before insert on public.messages
  for each row execute function public.enforce_offer_rules();

drop policy if exists "Booking parties can send offers" on public.messages;
create policy "Booking parties can send offers"
  on public.messages for insert to authenticated
  with check (kind = 'offer' and sender_id = (select auth.uid()) and public.is_booking_party(booking_id));

-- ---------------------------------------------------------------------------------------------
-- 6. Notifications
-- ---------------------------------------------------------------------------------------------

create or replace function public.on_message_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recipient uuid;
begin
  if NEW.kind = 'system' then
    return NEW;
  end if;

  select case when b.owner_id = NEW.sender_id then b.sitter_id else b.owner_id end
    into v_recipient
    from public.bookings b
   where b.id = NEW.booking_id;

  if v_recipient is null then
    return NEW;
  end if;

  if NEW.kind = 'offer' then
    -- An offer always notifies, except the one sent with the request itself: the sitter was
    -- just told about the request in this same transaction.
    if exists (
      select 1 from public.notifications n
       where n.user_id = v_recipient and n.booking_id = NEW.booking_id
         and n.type = 'booking_requested' and n.created_at = now()
    ) then
      return NEW;
    end if;

    insert into public.notifications (user_id, actor_id, booking_id, type)
    values (v_recipient, NEW.sender_id, NEW.booking_id, 'offer_received');
    return NEW;
  end if;

  -- If they already have anything unread about this booking, don't pile on.
  if exists (
    select 1 from public.notifications n
     where n.user_id = v_recipient
       and n.booking_id = NEW.booking_id
       and n.read_at is null
  ) then
    return NEW;
  end if;

  insert into public.notifications (user_id, actor_id, booking_id, type)
  values (v_recipient, NEW.sender_id, NEW.booking_id, 'message_received');

  return NEW;
end;
$function$;

create or replace function public.on_booking_event()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_recipient uuid;
  v_actor     uuid;
  v_type      text;
  v_event     text;
begin
  if TG_OP = 'INSERT' then
    insert into public.notifications (user_id, actor_id, booking_id, type)
    values (NEW.sitter_id, NEW.owner_id, NEW.id, 'booking_requested');

    insert into public.messages (booking_id, sender_id, kind, event)
    values (NEW.id, NEW.owner_id, 'system', 'requested');

    if NEW.notes is not null and length(btrim(NEW.notes)) > 0 then
      insert into public.messages (booking_id, sender_id, kind, body)
      values (NEW.id, NEW.owner_id, 'user', btrim(NEW.notes));
    end if;

    return NEW;
  end if;

  if NEW.status is not distinct from OLD.status then
    return NEW;
  end if;

  case NEW.status
    when 'signed' then
      if auth.uid() = NEW.owner_id then
        -- The owner took the sitter's counter: the sitter is the one to tell.
        v_recipient := NEW.sitter_id; v_actor := NEW.owner_id;
        v_type := 'price_agreed';     v_event := 'agreed';
      else
        v_recipient := NEW.owner_id;  v_actor := NEW.sitter_id;
        v_type := 'booking_accepted'; v_event := 'accepted';
      end if;
    when 'declined' then
      v_recipient := NEW.owner_id;  v_actor := NEW.sitter_id;
      v_type := 'booking_declined'; v_event := 'declined';
    when 'completed' then
      v_recipient := NEW.owner_id;  v_actor := NEW.sitter_id;
      v_type := 'booking_completed'; v_event := 'completed';
    when 'cancelled' then
      v_recipient := NEW.sitter_id; v_actor := NEW.owner_id;
      v_type := 'booking_cancelled'; v_event := 'cancelled';
    else
      return NEW;
  end case;

  insert into public.notifications (user_id, actor_id, booking_id, type)
  values (v_recipient, v_actor, NEW.id, v_type);

  insert into public.messages (booking_id, sender_id, kind, event)
  values (NEW.id, v_actor, 'system', v_event);

  return NEW;
end;
$function$;

-- ---------------------------------------------------------------------------------------------
-- 7. A request and its first offer, in one transaction
-- ---------------------------------------------------------------------------------------------

create or replace function public.create_booking_request(
  p_sitter_id    uuid,
  p_pet_id       uuid,
  p_service      text,
  p_start_at     timestamptz,
  p_end_at       timestamptz,
  p_address      text default null,
  p_notes        text default null,
  p_offer_amount int  default null,
  p_offer_note   text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid := auth.uid();
  v_id    uuid;
begin
  if v_owner is null then
    raise exception 'Sign in to send a request' using errcode = 'insufficient_privilege';
  end if;

  insert into public.bookings (owner_id, sitter_id, pet_id, service, start_at, end_at, address, notes, status)
  values (v_owner, p_sitter_id, p_pet_id, p_service, p_start_at, p_end_at,
          nullif(btrim(p_address), ''), nullif(btrim(p_notes), ''), 'pending')
  returning id into v_id;

  if p_offer_amount is not null then
    insert into public.messages (booking_id, sender_id, kind, amount, body)
    values (v_id, v_owner, 'offer', p_offer_amount, nullif(btrim(p_offer_note), ''));
  end if;

  return v_id;
end;
$$;

revoke all on function public.create_booking_request(uuid, uuid, text, timestamptz, timestamptz, text, text, int, text) from public, anon;
grant execute on function public.create_booking_request(uuid, uuid, text, timestamptz, timestamptz, text, text, int, text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 8. Data: prices for existing sitters, prices for existing bookings
-- ---------------------------------------------------------------------------------------------

-- From the old hourly rate r: walking round(0.6r) a day, daycare round(1.1r) a day, boarding
-- 3 x round(1.5r) for 3 days, grooming round(1.4r) a visit. Only profiles with no prices yet.
update public.profiles p
   set prices = (
     select coalesce(jsonb_object_agg(s.service, s.price), '{}'::jsonb)
       from (
         select 'walking' as service, jsonb_build_object('amount', greatest(1, round(0.6 * p.rate_per_hour))::int, 'days', 1) as price
          where p.services -> 'walking' = 'true'::jsonb
         union all
         select 'daycare', jsonb_build_object('amount', greatest(1, round(1.1 * p.rate_per_hour))::int, 'days', 1)
          where p.services -> 'daycare' = 'true'::jsonb
         union all
         select 'boarding', jsonb_build_object('amount', 3 * greatest(1, round(1.5 * p.rate_per_hour))::int, 'days', 3)
          where p.services -> 'boarding' = 'true'::jsonb
         union all
         select 'grooming', jsonb_build_object('amount', greatest(1, round(1.4 * p.rate_per_hour))::int)
          where p.services -> 'grooming' = 'true'::jsonb
       ) s
   )
 where p.is_sitter
   and p.rate_per_hour is not null
   and p.prices = '{}'::jsonb;

-- Not an update of status, so booking_event_notify does not fire and nobody is notified.
update public.bookings b
   set days = public.stay_days(b.start_at, b.end_at),
       asking_price = public.asking_price_for(p.prices, b.service, public.stay_days(b.start_at, b.end_at))
  from public.profiles p
 where p.id = b.sitter_id
   and b.days is null;

update public.bookings
   set agreed_price = asking_price
 where status in ('signed', 'completed')
   and agreed_price is null;
