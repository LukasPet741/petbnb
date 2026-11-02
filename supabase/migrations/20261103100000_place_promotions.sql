-- Promoted placement paid through Stripe (docs/promoted-placement.md). The stripe-promote edge
-- function receives Stripe's signed events and calls the two functions below with the service role;
-- nobody else can read the table or call them. places.is_promoted follows the subscriptions: a place
-- is promoted while one of its subscriptions is paying (active, trialing, or past_due while Stripe
-- retries the card). An admin can still promote a place by hand; only a subscription event for
-- that same place recomputes its flag. Needs 20261103090000.

create table public.place_promotions (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  place_id uuid not null references public.places(id) on delete cascade,
  stripe_customer_id text check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  status text not null default 'active'
    check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index place_promotions_place_id_idx on public.place_promotions (place_id);

alter table public.place_promotions enable row level security;
revoke all on public.place_promotions from anon, authenticated;

-- The place's flag, from its subscriptions.
create function public._refresh_place_promotion(p_place uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.places
  set is_promoted = exists (
    select 1 from public.place_promotions r
    where r.place_id = p_place and r.status in ('active', 'trialing', 'past_due')
  )
  where id = p_place;
$$;

-- A paid checkout for a place: 'started', 'known' when Stripe resends it, 'unknown_place' otherwise.
create function public.start_place_promotion(p_subscription text, p_place uuid, p_customer text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.places where id = p_place) then
    return 'unknown_place';
  end if;
  insert into public.place_promotions (stripe_subscription_id, place_id, stripe_customer_id)
  values (p_subscription, p_place, p_customer)
  on conflict (stripe_subscription_id) do nothing;
  if not found then
    return 'known';
  end if;
  perform public._refresh_place_promotion(p_place);
  return 'started';
end;
$$;

-- A subscription changed status: 'updated', or 'unknown' for a subscription we never started.
-- Canceled is final in Stripe, so a late event cannot bring a canceled promotion back.
create function public.set_place_promotion_status(p_subscription text, p_status text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_place uuid;
begin
  update public.place_promotions
  set status = p_status, updated_at = now()
  where stripe_subscription_id = p_subscription and status <> 'canceled'
  returning place_id into v_place;
  if v_place is null then
    return 'unknown';
  end if;
  perform public._refresh_place_promotion(v_place);
  return 'updated';
end;
$$;

revoke all on function public._refresh_place_promotion(uuid) from public, anon, authenticated;
revoke all on function public.start_place_promotion(text, uuid, text) from public, anon, authenticated;
revoke all on function public.set_place_promotion_status(text, text) from public, anon, authenticated;
grant execute on function public.start_place_promotion(text, uuid, text) to service_role;
grant execute on function public.set_place_promotion_status(text, text) to service_role;
