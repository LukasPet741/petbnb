import { type Profile } from "./types";

/**
 * Pure data shaping for the landing page. The page fetches `profiles` ONCE and
 * hands the same array to every section, so all of this has to be derivable
 * from that one array with no further queries.
 *
 * Everything here is deterministic on purpose. The previous landing page
 * shuffled with `Math.random()` in render-adjacent code, which made the hero
 * unassertable in tests and the section order change on every mount. With 25
 * sitters, "most experienced first" is a defensible editorial order and it
 * stays put between renders.
 */

const MAX_QUOTE_LENGTH = 220;

/**
 * Collapses whitespace and caps a sitter bio at `max` characters, cutting on a
 * word boundary where that keeps most of the window.
 *
 * The word-boundary retreat is deliberately conditional. Retreating to the last
 * space no matter how early it falls turns a bio like "A" followed by a 400
 * character unbroken run into the single-character quote "a…", which then gets
 * rendered as somebody's featured testimonial. Below 60% of the window we keep
 * the hard cut instead: a severed word reads better than one letter.
 */
export function excerpt(text: string, max = MAX_QUOTE_LENGTH) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  const keepBoundary = lastSpace > max * 0.6;
  return `${keepBoundary ? cut.slice(0, lastSpace) : cut}…`;
}

export interface CitySummary {
  /** Display spelling: the most common trimmed variant found in the data. */
  name: string;
  /** Case-insensitive grouping key, also what /sitters?city= matches on. */
  key: string;
  sitters: Profile[];
}

function cleanCity(city: string | null | undefined): string {
  return (city ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Groups sitters by city, case-insensitively, and returns the busiest cities.
 *
 * Production data really does contain both "Kaunas" and "kaunas", and
 * "Mažeikiai " with a trailing space. Grouping on the raw string would print
 * the same city twice in the grid, so we group on a folded key and display the
 * spelling that occurs most often (ties resolved by first appearance).
 */
export function topCities(profiles: Profile[], limit = 5): CitySummary[] {
  type Group = { spellings: Map<string, number>; sitters: Profile[] };
  const groups = new Map<string, Group>();

  for (const profile of profiles) {
    if (!profile.is_sitter) continue;
    const name = cleanCity(profile.city);
    if (!name) continue;
    const key = name.toLocaleLowerCase("lt");
    const group: Group = groups.get(key) ?? { spellings: new Map(), sitters: [] };
    group.spellings.set(name, (group.spellings.get(name) ?? 0) + 1);
    group.sitters.push(profile);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, { spellings, sitters }]) => {
      const name = [...spellings.entries()].reduce((best, entry) =>
        entry[1] > best[1] ? entry : best
      )[0];
      return { key, name, sitters };
    })
    .sort((a, b) => b.sitters.length - a.sitters.length || a.name.localeCompare(b.name, "lt"))
    .slice(0, limit);
}

/** Most experienced first, then by name so the order never wobbles. */
function byStanding(a: Profile, b: Profile) {
  return (
    (b.experience_years ?? -1) - (a.experience_years ?? -1) ||
    (a.full_name ?? "").localeCompare(b.full_name ?? "", "lt")
  );
}

/**
 * Sitters who actually wrote something about themselves. A voices wall built
 * from empty bios is just a grid of names, so an unwritten bio disqualifies.
 */
export function pickVoices(profiles: Profile[], limit = 6): Profile[] {
  return profiles
    .filter((p) => p.is_sitter && excerpt(p.about_me ?? "").length > 0)
    .sort(byStanding)
    .slice(0, limit);
}

