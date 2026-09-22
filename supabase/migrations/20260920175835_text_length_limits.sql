-- Applied to production 2026-09-20 as 20260920175835.
-- From the 2026-09-20 security scan; see docs/security/2026-09-20-hardening.sql §7.
--
-- reviews.body and an offer note are held by CHECK constraints; full_name, city,
-- about_me, pet name, pet bio and a chat line had nothing. maxLength was added to the
-- inputs (src/lib/text-limits.ts), which stops a person but not a script -- one row with
-- a megabyte in about_me is carried by every /browse response. Keep these equal to
-- src/lib/text-limits.ts. No existing row exceeded any of them on 2026-09-20.
alter table public.profiles
  add constraint profiles_full_name_length check (full_name is null or char_length(full_name) <= 80),
  add constraint profiles_city_length      check (city      is null or char_length(city)      <= 80),
  add constraint profiles_about_me_length  check (about_me  is null or char_length(about_me)  <= 1200);

alter table public.pets
  add constraint pets_name_length check (char_length(name) <= 40),
  add constraint pets_bio_length  check (bio is null or char_length(bio) <= 600);

alter table public.messages
  add constraint messages_body_length check (body is null or char_length(body) <= 2000);
