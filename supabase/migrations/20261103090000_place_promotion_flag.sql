-- Promotion becomes a flag beside the tier (docs/promoted-placement.md). As a tier, 'promoted'
-- replaced 'bookable', so promoting a Bookable place ended its booking requests. Now a place keeps
-- its tier and is promoted on top of it. Only an admin sets the flag: owners hold column grants for
-- their words alone (20261026220000), and this adds none. Needs 20261026180000.
-- The app reads places with or without this column (placesDb.isMissingColumn), so it may ship first.

alter table public.places add column is_promoted boolean not null default false;

-- A place promoted as a tier stays promoted, as a partner.
update public.places set is_promoted = true, tier = 'partner' where tier = 'promoted';

alter table public.places drop constraint places_tier_check;
alter table public.places add constraint places_tier_check check (tier in ('listed', 'partner', 'bookable'));
