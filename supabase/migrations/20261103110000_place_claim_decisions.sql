-- Deciding "Is this your business?" claims (20261026220000) in one call each, for the local
-- `npm run business` tool (tools/business), which runs with the service role on Lukas's machine.
-- Until now an approval was three hand-written updates. Nobody else can call these.

-- Approve: the claimant becomes the place's owner, if it still has none, and every other open
-- claim for that place is closed with a reason its claimant sees. A listed place (public
-- information, "not a partner yet") becomes a partner: its owner has now agreed to the page.
-- Answers 'approved', 'not_pending' (unknown or already decided) or 'place_owned'.
create function public.approve_place_claim(p_claim uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_place uuid;
  v_user uuid;
begin
  select place_id, user_id into v_place, v_user
  from public.place_claims
  where id = p_claim and status = 'pending'
  for update;
  if v_place is null then
    return 'not_pending';
  end if;

  update public.places
  set owner_user_id = v_user, tier = case when tier = 'listed' then 'partner' else tier end
  where id = v_place and owner_user_id is null;
  if not found then
    return 'place_owned';
  end if;

  update public.place_claims set status = 'approved', decided_at = now() where id = p_claim;
  update public.place_claims
  set status = 'rejected', decided_reason = 'Patvirtintas kitas šios vietos prašymas. Another claim for this place was approved.', decided_at = now()
  where place_id = v_place and status = 'pending' and id <> p_claim;
  return 'approved';
end;
$$;

-- Reject with the reason the claimant reads on My business. Answers 'rejected', 'not_pending' or
-- 'reason_required'.
create function public.reject_place_claim(p_claim uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    return 'reason_required';
  end if;
  update public.place_claims
  set status = 'rejected', decided_reason = left(btrim(p_reason), 500), decided_at = now()
  where id = p_claim and status = 'pending';
  if not found then
    return 'not_pending';
  end if;
  return 'rejected';
end;
$$;

-- Places already given to an owner by hand stop saying they are not a partner.
update public.places set tier = 'partner'
where tier = 'listed' and owner_user_id is not null;

revoke all on function public.approve_place_claim(uuid) from public, anon, authenticated;
revoke all on function public.reject_place_claim(uuid, text) from public, anon, authenticated;
grant execute on function public.approve_place_claim(uuid) to service_role;
grant execute on function public.reject_place_claim(uuid, text) to service_role;
