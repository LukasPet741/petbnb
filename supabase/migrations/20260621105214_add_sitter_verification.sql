
alter table public.profiles
  add column is_verified boolean not null default false,
  add column verified_at timestamptz,
  add column verified_full_name text,
  add column smart_id_session_id text;

-- Enforce at the database level: a booking can only be created if the sitter is verified.
create or replace function public.check_sitter_verified()
returns trigger as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = NEW.sitter_id and is_sitter = true and is_verified = true
  ) then
    raise exception 'Sitter is not ID-verified and cannot accept bookings';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger enforce_sitter_verified
  before insert on public.bookings
  for each row execute function public.check_sitter_verified();
