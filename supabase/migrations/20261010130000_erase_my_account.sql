-- "Delete my account" (unification plan §2.4; GDPR art. 17 right to erasure).
-- NOT APPLIED until Lukas says yes; run after 20261010120000 (it uses pets.archived_at).
--
-- Deleting the auth user would cascade through profiles into every booking, and with them
-- the other party's messages and reviews. So the account is emptied instead of deleted:
-- what is only the person's goes, what is also someone else's record stays under an empty
-- profile with no name, and signing in becomes impossible.
--
-- Refused while a booking is still open (pending, or accepted and not yet over): the other
-- party is counting on it, so the person cancels or finishes it first.
-- The photos (avatar, pets) are removed by the app straight after, through the Storage API,
-- because Storage refuses deletes made in SQL.

alter table public.profiles add column if not exists deleted_at timestamptz;

comment on column public.profiles.deleted_at is
  'Set by erase_my_account: the profile is an empty shell kept for the other party''s bookings, messages and reviews.';

create or replace function public.erase_my_account(p_confirm_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles p where p.id = v_uid for update;
  if not found or v_profile.deleted_at is not null then
    raise exception 'no_account' using errcode = 'P0002';
  end if;

  -- The typed confirmation, checked here as well as in the dialog.
  if coalesce(btrim(v_profile.full_name), '') <> ''
     and lower(btrim(coalesce(p_confirm_name, ''))) <> lower(btrim(v_profile.full_name)) then
    raise exception 'name_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.bookings b
    where (b.owner_id = v_uid or b.sitter_id = v_uid)
      and (b.status = 'pending' or (b.status = 'signed' and b.end_at > now()))
  ) then
    raise exception 'open_bookings' using errcode = 'P0001';
  end if;

  -- Collars, as unpair_collar does: a demo collar goes, a real one is freed with its fixes gone.
  delete from public.collar_locations l
    using public.collar_devices d
    where l.device_id = d.id and d.owner_id = v_uid;
  delete from public.collar_devices d where d.owner_id = v_uid and d.is_demo;
  update public.collar_devices d set owner_id = null, claimed_at = null, label = null
    where d.owner_id = v_uid;

  -- Pets: deleted unless on a booking; those are archived with only the name left.
  delete from public.pets p
    where p.owner_id = v_uid
      and not exists (select 1 from public.bookings b where b.pet_id = p.id);
  update public.pets p
    set archived_at = coalesce(p.archived_at, now()), photo_url = null, bio = null, weight_kg = null
    where p.owner_id = v_uid;

  -- What is only theirs.
  delete from public.favorites f where f.user_id = v_uid or f.sitter_id = v_uid;
  delete from public.notifications n where n.user_id = v_uid;
  delete from public.sitter_days_off s where s.sitter_id = v_uid;
  delete from public.smart_id_demo_sessions s where s.user_id = v_uid;

  -- The profile stays as an empty shell for the other party's history.
  update public.profiles p set
    full_name = null, phone = null, city = null, about_me = null, avatar_url = null,
    is_sitter = false, services = null, prices = '{}'::jsonb, rate_per_hour = null,
    experience_years = null, last_active_at = null,
    is_verified = false, verified_at = null, verified_full_name = null,
    smart_id_session_id = null, verification_method = 'none',
    deleted_at = now()
  where p.id = v_uid;

  -- No more signing in: no password, no Google or Facebook link, no sessions, no email.
  delete from auth.identities i where i.user_id = v_uid;
  delete from auth.sessions s where s.user_id = v_uid;
  delete from auth.mfa_factors m where m.user_id = v_uid;
  update auth.users u set
    email = null, phone = null, encrypted_password = null,
    email_confirmed_at = null, phone_confirmed_at = null,
    raw_user_meta_data = '{}'::jsonb,
    banned_until = now() + interval '100 years',
    deleted_at = now()
  where u.id = v_uid;
end;
$$;

revoke all on function public.erase_my_account(text) from public, anon;
grant execute on function public.erase_my_account(text) to authenticated;
