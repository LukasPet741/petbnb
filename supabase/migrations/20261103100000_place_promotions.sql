-- Promoted placement paid through Stripe (docs/promoted-placement.md). The stripe-promote edge
-- function receives Stripe's signed events and calls the two functions below with the service role;
-- nobody else can read the table or call them. places.is_promoted follows the subscriptions: a place
-- is promoted while one of its subscriptions is paying (active, trialing, or past_due while Stripe
-- retries the card). An admin can still promote a place by hand; only a subscription event for
-- that same place recomputes its flag. Needs 20261103090000.
--
-- Stripe does not send events in order. Each status carries the time Stripe created its event
-- (status_at), and an older event never overwrites a newer one. A status that arrives before its
-- checkout is kept on a row with no place yet, and the checkout picks it up.

create table public.place_promotions (
  stripe_subscription_id text primary key check (stripe_subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  -- Null while Stripe has sent a status for this subscription but not yet its checkout.
  place_id uuid references public.places(id) on delete cascade,
  stripe_customer_id text check (stripe_customer_id is null or stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
  status text not null default 'active'
    check (status in ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused')),
  status_at timestamptz not null,
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

-- A paid checkout for a place, at Stripe's event time: 'started', 'known' when Stripe resends it,
-- or 'unknown_place'. A newer status already recorded for the subscription (a cancellation that
-- overtook the checkout) wins over the checkout's 'active'.
create function public.start_place_promotion(p_subscription text, p_place uuid, p_customer text, p_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.places where id = p_place) then
    return 'unknown_place';
  end if;
  insert into public.place_promotions (stripe_subscription_id, place_id, stripe_customer_id, status, status_at)
  values (p_subscription, p_place, p_customer, 'active', p_at)
  on conflict (stripe_subscription_id) do update
  set place_id = excluded.place_id,
      stripe_customer_id = coalesce(public.place_promotions.stripe_customer_id, excluded.stripe_customer_id),
      status = case when public.place_promotions.status_at > excluded.status_at then public.place_promotions.status else excluded.status end,
      status_at = greatest(public.place_promotions.status_at, excluded.status_at),
      updated_at = now()
  where public.place_promotions.place_id is null;
  if not found then
    return 'known';
  end if;
  perform public._refresh_place_promotion(p_place);
  return 'started';
end;
$$;

-- A subscription's status, at Stripe's event time: 'updated'; 'recorded' when its checkout has not
-- arrived yet; 'stale' when a newer event already set it, or it was canceled (final in Stripe).
create function public.set_place_promotion_status(p_subscription text, p_status text, p_at timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_place uuid;
begin
  insert into public.place_promotions (stripe_subscription_id, status, status_at)
  values (p_subscription, p_status, p_at)
  on conflict (stripe_subscription_id) do update
  set status = excluded.status, status_at = excluded.status_at, updated_at = now()
  where public.place_promotions.status <> 'canceled' and public.place_promotions.status_at <= excluded.status_at
  returning place_id into v_place;
  if not found then
    return 'stale';
  end if;
  if v_place is null then
    return 'recorded';
  end if;
  perform public._refresh_place_promotion(v_place);
  return 'updated';
end;
$$;

revoke all on function public._refresh_place_promotion(uuid) from public, anon, authenticated;
revoke all on function public.start_place_promotion(text, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.set_place_promotion_status(text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.start_place_promotion(text, uuid, text, timestamptz) to service_role;
grant execute on function public.set_place_promotion_status(text, text, timestamptz) to service_role;
