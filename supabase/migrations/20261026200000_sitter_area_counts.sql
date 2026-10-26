-- The places map's People layer: sitters per city, as totals only (PetBnB ecosystem plan, "The map").
--
-- Profiles store only a city, which is the right level for privacy. This function hands out a count
-- per city and never a row about a person; a city with fewer than 5 sitters is left out, so no one
-- can be singled out. Anyone may call it: the public map shows the counts.
--
-- Read by src/lib/useSitterAreas.ts, which until this is live counts the city column of the sitter
-- profiles a visitor can already read. No email, no change to any table; undone by
--   drop function public.sitter_counts_by_city();

create function public.sitter_counts_by_city()
returns table (city text, sitters integer)
language sql
stable
security definer
set search_path = ''
as $$
  select btrim(p.city), count(*)::integer
  from public.profiles p
  where p.is_sitter and p.deleted_at is null and p.city is not null and btrim(p.city) <> ''
  group by btrim(p.city)
  having count(*) >= 5
  order by count(*) desc;
$$;

revoke all on function public.sitter_counts_by_city() from public;
grant execute on function public.sitter_counts_by_city() to anon, authenticated;
