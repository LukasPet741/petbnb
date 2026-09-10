import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Database } from "@/lib/supabase";
import type { SitterRating } from "@/lib/types";

type RatingRow = Database["public"]["Views"]["sitter_ratings"]["Row"];

/** The inclusive range the reviews.rating CHECK constraint enforces. */
const MIN_RATING = 1;
const MAX_RATING = 5;

/**
 * The ratings for a page's worth of sitters, keyed by sitter id.
 *
 * One `.in()` query for the whole list rather than one per card: the listings show
 * up to 25 sitters, and a query per card would turn a page load into 25 round trips
 * against a view that is a single GROUP BY.
 *
 * A sitter with no reviews has no row in sitter_ratings at all, so absence from the
 * returned map is the normal unrated case, not a failure. A failed query yields an
 * empty map for the same reason: ratings decorate a listing that has to render
 * without them.
 */
export function useSitterRatings(sitterIds: string[]): Map<string, SitterRating> {
  const [ratings, setRatings] = useState<Map<string, SitterRating>>(new Map());

  // Keyed on the contents rather than the array identity. Every call site builds
  // this list inline from state, so a fresh array arrives on every render and an
  // identity-keyed effect would re-query forever.
  const key = sitterIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;

    let active = true;
    supabase
      .from("sitter_ratings")
      .select("*")
      .in("sitter_id", ids)
      .then(({ data, error }: { data: RatingRow[] | null; error: unknown }) => {
        if (!active) return;
        if (error || !data) {
          setRatings(new Map());
          return;
        }
        const next = new Map<string, SitterRating>();
        for (const row of data) {
          // Out-of-range averages are dropped rather than shown, matching
          // averageRating(): one stray 0 or 50 would silently distort a card.
          const inRange =
            Number.isFinite(row.average_rating) &&
            row.average_rating >= MIN_RATING &&
            row.average_rating <= MAX_RATING;
          next.set(row.sitter_id, {
            average: inRange ? row.average_rating : null,
            count: row.review_count,
          });
        }
        setRatings(next);
      });

    return () => {
      active = false;
    };
  }, [key]);

  return ratings;
}
