"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  emptyDimensions,
  type Review,
  type ReviewDimension,
  type ReviewDirection,
} from "@/lib/types";

/** Postgres unique_violation: this author already reviewed this booking. */
const UNIQUE_VIOLATION = "23505";

export interface ReviewTarget {
  bookingId: string;
  /** Who the review is about. */
  subjectId: string;
  /** Who is writing it — always the signed-in user. */
  authorId: string;
  direction: ReviewDirection;
}

export interface ReviewInput {
  rating: number;
  body: string | null;
  /** Only the dimensions this direction asks about; the rest are nulled for us. */
  dimensions: Partial<Record<ReviewDimension, number | null>>;
}

/**
 * The signed-in user's own reviews for a page's worth of completed bookings, keyed by
 * booking id, plus the one call that writes them.
 *
 * One `.in()` query for the whole list rather than one per card, for the same reason as
 * useSitterRatings: the bookings list renders every completed booking at once.
 *
 * Filtered to this author AND this direction. A booking now carries up to two reviews —
 * one each way — and without both filters the other party's review of you would appear
 * inside your own form, prefilled and ready to be overwritten.
 *
 * A booking absent from the map has not been reviewed by you. That is the normal case,
 * not a failure, and a failed read yields an empty map for the same reason: the review
 * affordance decorates a bookings list that has to render without it.
 */
export function useMyReviews(
  bookingIds: string[],
  authorId: string | undefined,
  direction: ReviewDirection,
) {
  const [reviews, setReviews] = useState<Map<string, Review>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keyed on the contents rather than the array identity. Every call site builds this
  // list inline from state, so a fresh array arrives on every render and an
  // identity-keyed effect would re-query forever.
  const key = bookingIds.join(",");

  useEffect(() => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0 || !authorId) return;

    let active = true;
    setLoading(true);

    supabase
      .from("reviews")
      .select("*")
      .eq("author_id", authorId)
      .eq("direction", direction)
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
  }, [key, authorId, direction]);

  const remember = useCallback((row: Review) => {
    setReviews((prev) => new Map(prev).set(row.booking_id, row));
  }, []);

  /**
   * Writes a review, choosing INSERT or UPDATE by whether one is already known.
   *
   * author_id, subject_id and direction are all sent explicitly on insert because the
   * RLS policy re-verifies every one of them against the booking — the database will
   * not infer them, and a direction that disagrees with the caller's role on that
   * booking is refused outright.
   *
   * Both paths send all five dimension columns. Sending only the three this direction
   * asks about would, on an update, leave a value from a previous edit in place; if it
   * belonged to the other direction, reviews_dimensions_match_direction would then
   * reject the whole row.
   *
   * Returns whether the review reached the database. A boolean rather than a throw: a
   * refusal is an expected outcome the form has to react to, not an exception.
   */
  const saveReview = useCallback(
    async (target: ReviewTarget, input: ReviewInput): Promise<boolean> => {
      setError(null);

      const dimensions = { ...emptyDimensions(target.direction), ...input.dimensions };

      const update = async (): Promise<boolean> => {
        const { data, error: updateError } = await supabase
          .from("reviews")
          .update({ rating: input.rating, body: input.body, ...dimensions })
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
          author_id: target.authorId,
          subject_id: target.subjectId,
          direction: target.direction,
          rating: input.rating,
          body: input.body,
          ...dimensions,
        })
        .select()
        .single();

      if (insertError) {
        // The row exists after all — another tab, or a map this hook has not caught up
        // with. That means the review is there, not that anything went wrong.
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
