-- Places: every pet business on the map (PetBnB ecosystem plan, "Data model").
--
-- Replaces the hand-typed list in src/lib/partners.ts once the app reads from it. A place is a
-- business, never a private person: its addresses are public and drawn as pins. Sitters stay in
-- profiles and are never placed on the map.
--
-- Reads: anyone, for published places. Writes: none through the API yet; places are entered with
-- the service role until the admin editor and the "Is this your business?" claim flow exist.

create table public.places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  categories text[] not null default '{}' check (categories <@ array[
    'vet', 'shop', 'grooming', 'boarding', 'daycare', 'training', 'walking'
  ]),
  -- The animals they take, in the pets table's own words, so "takes my pet" is one comparison.
  accepts text[] not null default '{}' check (accepts <@ array[
    'dog', 'cat', 'bird', 'reptile', 'small_mammal', 'fish', 'other'
  ]),
  tier text not null default 'listed' check (tier in ('listed', 'partner', 'bookable', 'promoted')),
  -- 'public': entered from public information, facts only, until the business claims it.
  source text not null default 'partner' check (source in ('partner', 'public')),
  status text not null default 'draft' check (status in ('draft', 'preview', 'published', 'hidden')),
  description_lt text,
  description_en text,
  prices_note_lt text,
  prices_note_en text,
  hours_lt text,
  hours_en text,
  website_url text check (website_url ~ '^https://'),
  logo_path text,
  is_founding_partner boolean not null default false,
  consent_logo boolean not null default false,
  consent_photos boolean not null default false,
  consent_note text,
  owner_user_id uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A partner's logo is shown only with its yes to it. A public listing may show the icon the
  -- business publishes on its own site, to identify it next to "Not a partner yet".
  constraint places_logo_needs_consent check (logo_path is null or consent_logo or source = 'public')
);

create table public.place_locations (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  city text not null,
  area text,
  address text,
  note_lt text,
  note_en text,
  lat double precision check (lat between 53.8 and 56.5),
  lng double precision check (lng between 20.9 and 26.9),
  -- Only the area is known: the map marks it as approximate.
  approximate boolean not null default false,
  sort_order int not null default 0,
  constraint place_locations_coords_together check ((lat is null) = (lng is null))
);

create table public.place_services (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places(id) on delete cascade,
  name_lt text not null,
  name_en text not null,
  price_from numeric(10, 2) check (price_from >= 0),
  price_to numeric(10, 2) check (price_to >= price_from),
  unit_lt text,
  unit_en text,
  url text check (url ~ '^https://'),
  sort_order int not null default 0
);

create index place_locations_place_id_idx on public.place_locations (place_id);
create index place_locations_city_idx on public.place_locations (city);
create index place_services_place_id_idx on public.place_services (place_id);
create index places_owner_user_id_idx on public.places (owner_user_id);
create index places_status_idx on public.places (status);

create function public.places_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger places_touch_updated_at before update on public.places
  for each row execute function public.places_touch_updated_at();

alter table public.places enable row level security;
alter table public.place_locations enable row level security;
alter table public.place_services enable row level security;

create policy "Anyone reads published places" on public.places
  for select to anon, authenticated
  using (status = 'published');

create policy "Anyone reads the locations of published places" on public.place_locations
  for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.status = 'published'));

create policy "Anyone reads the services of published places" on public.place_services
  for select to anon, authenticated
  using (exists (select 1 from public.places p where p.id = place_id and p.status = 'published'));

-- No write policies, and no write grants either (Supabase grants them on every new table).
revoke insert, update, delete, truncate on public.places, public.place_locations, public.place_services from anon, authenticated;

-- The two partners already on /partners, as src/lib/partners.ts has them. Both agreed by email on
-- 26 Oct 2026, logo included; the logo files come from their own sites (scripts/place-logos.mjs).
with dogiday as (
  insert into public.places (slug, name, categories, accepts, tier, source, status, description_lt, description_en,
    prices_note_lt, prices_note_en, hours_lt, hours_en, website_url, logo_path, is_founding_partner, consent_logo, consent_photos,
    consent_note, published_at)
  values ('dogiday', 'Dogiday', array['boarding', 'daycare', 'grooming'], array['dog'], 'partner', 'partner', 'published',
    'Šunų viešbutis, dienos centras ir kirpykla Vilniaus Antakalnyje. Šunys čia apsistoja trumpam ar ilgesniam laikui, praleidžia dieną dienos centre arba užsuka nusikirpti. Dirba tik su šunimis.',
    'A dog hotel, day centre and grooming salon in Antakalnis, Vilnius. Dogs stay for a few days or longer, spend the day at the day centre, or come in for a groom. Dogs only.',
    'Kainos priklauso nuo viešnagės trukmės, šuns dydžio ir švenčių laikotarpio.',
    'Prices depend on the length of the stay, the dog''s size and holiday periods.',
    'Kasdien 7:30–19:30', 'Every day 7:30–19:30', 'https://dogiday.lt', '/partners/dogiday.png', true, true, true,
    'Email from Dogiday, 26 Oct 2026', now())
  returning id
), dogiday_location as (
  insert into public.place_locations (place_id, city, area, lat, lng, approximate)
  select id, 'Vilnius', 'Antakalnis', 54.7056, 25.3145, true from dogiday
)
insert into public.place_services (place_id, name_lt, name_en, sort_order)
select dogiday.id, s.name_lt, s.name_en, s.sort_order
from dogiday, (values
  ('Trumpalaikis apgyvendinimas', 'Short-term boarding', 1),
  ('Ilgalaikis apgyvendinimas', 'Long-term boarding', 2),
  ('Dienos centras', 'Day centre', 3),
  ('Šunų kirpimas', 'Dog grooming', 4)
) as s(name_lt, name_en, sort_order);

with dogpunk as (
  insert into public.places (slug, name, categories, accepts, tier, source, status, description_lt, description_en,
    prices_note_lt, prices_note_en, website_url, logo_path, is_founding_partner, consent_logo, consent_note, published_at)
  values ('dogpunk', 'DogPunk', array['training'], array['dog'], 'partner', 'partner', 'published',
    'Šunų dresūros mokykla Vilniuje ir Panevėžyje. Individualios pamokos ir grupiniai kursai: nuo pirmųjų žingsnių iki pilno paklusnumo, elgesio mieste, triukų ir reabilitacijos bailiems bei jautriems šunims. Taip pat siūlo vebinarų įrašus apie šunų elgesį.',
    'A dog training school in Vilnius and Panevėžys. Individual lessons and group courses: from the first steps to full obedience, manners in the city, tricks, and rehabilitation for fearful and sensitive dogs. Also sells recorded webinars on dog behaviour.',
    'Kiekvieno kurso kaina nurodyta jo puslapyje.', 'Each course''s price is on its own page.',
    'https://mokyksuni.lt/', '/partners/dogpunk.png', true, true, 'Email from DogPunk, 26 Oct 2026', now())
  returning id
), dogpunk_locations as (
  insert into public.place_locations (place_id, city, address, note_lt, note_en, lat, lng, sort_order)
  select id, l.city, l.address, 'Salėje ir lauke visame mieste', 'Indoors, and outdoors across the city', l.lat, l.lng, l.sort_order
  from dogpunk, (values
    ('Vilnius', 'Kalvarijų g. 143', 54.7185, 25.2902, 1),
    ('Panevėžys', 'Ramygalos g. 94B', 55.7183, 24.3646, 2)
  ) as l(city, address, lat, lng, sort_order)
)
insert into public.place_services (place_id, name_lt, name_en, url, sort_order)
select dogpunk.id, s.name_lt, s.name_en, s.url, s.sort_order
from dogpunk, (values
  ('Individualios pamokos', 'Individual lessons', 'https://mokyksuni.lt/klases/individuali-sunu-dresura/', 1),
  ('1 klasė – Pirmokai', 'Class 1 – First-years', 'https://mokyksuni.lt/klases/profesionali-sunu-dresura-vilniuje-kaip-aukleti-maza-suniuka/', 2),
  ('2 klasė – Studentai', 'Class 2 – Students', 'https://mokyksuni.lt/klases/sunu-mokykla-vilniuje-pazenge-pazengusiems/', 3),
  ('3 klasė – Profesoriai', 'Class 3 – Professors', 'https://mokyksuni.lt/klases/sunu-dresavimas-vilniuje-pazengusiems/', 4),
  ('Kursas „Paaugliai“', 'Teens course', 'https://mokyksuni.lt/klases/kursas-paaugliai/', 5),
  ('Pilno paklusnumo kursas', 'Full obedience course', 'https://mokyksuni.lt/klases/pilno-paklusnumo-kursas/', 6),
  ('Smagiai ir mandagiai mieste', 'Fun and polite in the city', 'https://mokyksuni.lt/klases/drasuros-kursai-sunims-mieste/', 7),
  ('Reabilitacija bailiems ir jautriems šunims', 'Rehab for fearful and sensitive dogs', 'https://mokyksuni.lt/klases/reabilitacijos-kursai-bailiems-ir-jautriems-sunims/', 8),
  ('„Šunų meditacija“', 'Dog meditation', 'https://mokyksuni.lt/klases/kursas-sunu-meditacija/', 9),
  ('Linksmas triukų kursas', 'Fun tricks course', 'https://mokyksuni.lt/klases/triuku-kursas/', 10)
) as s(name_lt, name_en, url, sort_order);
