"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Review } from "@/lib/types";

/** Postgres unique_violation: booking_id already has a review. */
const UNIQUE_VIOLATION = "23505";

export interface ReviewTarget {
  bookingId: string;
  sitterId: string;
  ownerId: string;
}

export interface ReviewInput {
  rating: number;
  body: string | null;
}

/**
 * The signed-in owner's own reviews for a page's worth of completed bookings, keyed
 * by booking id, plus the one call that writes them.
 *
 * One `.in()` query for the whole list rather than one per card, for the same reason
 * as useSitterRatings: the bookings list renders every completed booking at once and
 * a query per card would turn one page load into a dozen round trips.
 *
 * A booking absent from the map has not been reviewed. That is the normal case, not a
 * failure, and a failed read yields an empty map for the same reason — the review
 * affordance decorates a bookings list that has to render without it.
 */
export function useMyReviews(bookingIds: string[]) {
  const [reviews, setReviews] = useState<Map<string, Review>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyed on the contents rather than the array identity. Every call site builds this
  // list inline from state, so a fresh array arrives on every render and an
  // identity-keyed effect would re-query forever.
  const key = bookingIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) return;

    let active = true;
    setLoading(true);

    supabase
      .from("reviews")
      .select("*")
      .in("booking_id", ids)
      .then(({ data, error: readError }) => {
        if (!active) return;
        setLoading(false);
        if (readError || !data) {
          setReviews(new Map());
          return;
        }
        setReviews(new Map((data as Review[]).map((row) => [row.booking_id, row])));
      });

    return () => {
      active = false;
    };
  }, [key]);

  const remember = useCallback((row: Review) => {
    setReviews((prev) => new Map(prev).set(row.booking_id, row));
  }, []);

  /**
   * Writes a review, choosing INSERT or UPDATE by whether one is already known.
   *
   * owner_id and sitter_id are sent explicitly on insert because the RLS policy
   * re-verifies both against the booking — the database will not infer them. The
   * update sends only rating and body, which is all the narrowed reviews.Update type
   * and the policy's WITH CHECK allow.
   *
   * Returns whether the review reached the database. A boolean rather than a throw:
   * a refusal is an expected outcome the form has to react to, not an exception, and
   * the caller needs the answer to decide whether to close itself.
   */
  const saveReview = useCallback(
    async (target: ReviewTarget, input: ReviewInput): Promise<boolean> => {
      setError(null);

      const update = async (): Promise<boolean> => {
        const { data, error: updateError } = await supabase
          .from("reviews")
          .update({ rating: input.rating, body: input.body })
          .eq("booking_id", target.bookingId)
          .select()
          .single();
        if (updateError || !data) {
          setError("sitters.reviews.form.error");
          return false;
        }
        remember(data as Review);
        return true;
      };

      if (reviews.has(target.bookingId)) {
        return update();
      }

      const { data, error: insertError } = await supabase
        .from("reviews")
        .insert({
          booking_id: target.bookingId,
          owner_id: target.ownerId,
          sitter_id: target.sitterId,
          rating: input.rating,
          body: input.body,
        })
        .select()
        .single();

      if (insertError) {
        // The row exists after all — another tab, or a map this hook has not caught
        // up with. That means the review is there, not that anything went wrong.
        if ((insertError as { code?: string }).code === UNIQUE_VIOLATION) {
          return update();
        }
        setError("sitters.reviews.form.error");
        return false;
      }

      if (!data) {
        setError("sitters.reviews.form.error");
        return false;
      }
      remember(data as Review);
      return true;
    },
    [reviews, remember],
  );

  return { reviews, saveReview, loading, error };
}
