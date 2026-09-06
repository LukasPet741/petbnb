-- Trigger functions have no business being reachable at /rest/v1/rpc/<name>.
-- Postgres would reject a direct call anyway, but leaving them exposed in the
-- API schema weakens the "notifications are unforgeable" property this design
-- rests on, and the linter flags it.
revoke all on function public.on_booking_event() from public, anon, authenticated;
revoke all on function public.on_message_insert() from public, anon, authenticated;

-- Pre-existing trigger functions, same one-line fix.
revoke all on function public.check_sitter_verified() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Pre-existing: check_sitter_verified gates EVERY booking insert but ran with a
-- mutable search_path, so a hostile schema earlier on the path could shadow
-- `profiles` and defeat the check. Pin it, matching the other functions here.
create or replace function public.check_sitter_verified()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = NEW.sitter_id and is_sitter = true and is_verified = true
  ) then
    raise exception 'Sitter is not ID-verified and cannot accept bookings';
  end if;
  return NEW;
end;
$$;

revoke all on function public.check_sitter_verified() from public, anon, authenticated;

-- is_booking_party is deliberately left executable: it is called during RLS
-- policy evaluation, which runs as the querying role, so `authenticated` needs
-- EXECUTE. It returns false when auth.uid() is null, so anon gains nothing.
