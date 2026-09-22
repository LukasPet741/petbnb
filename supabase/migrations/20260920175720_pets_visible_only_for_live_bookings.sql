-- Applied to production 2026-09-20 as 20260920175720.
-- From the 2026-09-20 security scan; see docs/security/2026-09-20-hardening.sql §3.
--
-- public.pets deliberately has no public SELECT: a pet's name, bio, photo and notes are
-- private to its owner. The sitter exception had no status filter, so anyone named on a
-- booking kept that read for ever -- including a booking they declined a second later,
-- and one the owner cancelled. Requesting a sitter was enough to hand them the record
-- permanently.
--
-- 'completed' stays in the list on purpose: a past sitter still sees the pet on their
-- finished bookings and in the review they write.
drop policy if exists "Sitters can view pets in their bookings" on public.pets;
create policy "Sitters can view pets in their bookings" on public.pets
  for select using (
    exists (
      select 1 from public.bookings
       where bookings.pet_id = pets.id
         and bookings.sitter_id = (select auth.uid())
         and bookings.status in ('pending', 'signed', 'completed')
    )
  );
