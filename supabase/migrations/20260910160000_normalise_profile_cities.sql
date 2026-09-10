-- Normalise the free-text city column to one spelling per city.
--
-- city is a plain text input on the profile form, so the database stores whatever was
-- typed. Production had drifted into three entries for two places:
--
--   "kaunas"      alongside "Kaunas"     — 1 row, differing only in case
--   "Mažeikiai "  alongside nothing      — 1 row, a trailing space
--
-- Both the city filter and the landing page's city list group on the exact string, so
-- each variant counted as its own city; the sitter profile page renders the raw value,
-- so one sitter's page read "kaunas". The trailing space was the worse of the two,
-- because nothing about it is visible on screen.
--
-- initcap() lowercases the remainder of each word and uppercases its first letter,
-- which matches normaliseCity() in src/lib/utils.ts — the same normalisation now runs
-- on save, so this is a one-off repair rather than a recurring cleanup. The regexp
-- collapses internal runs of whitespace so two-word names survive intact.
--
-- Previewed before running: exactly two rows change, "kaunas" to "Kaunas" and
-- "Mažeikiai " to "Mažeikiai". No other row is touched, because the WHERE clause
-- compares each value against its own normalised form.

update public.profiles
   set city = initcap(btrim(regexp_replace(city, '\s+', ' ', 'g')))
 where city is not null
   and city <> initcap(btrim(regexp_replace(city, '\s+', ' ', 'g')));
