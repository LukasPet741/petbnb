"use client";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import Stars from "@/components/Stars";
import ReviewForm, { type ReviewSubmission } from "@/components/ReviewForm";
import type { Review } from "@/lib/types";
import type { ReviewTarget } from "@/hooks/useMyReviews";

interface BookingReviewProps {
  target: ReviewTarget;
  /** The owner's existing review for this booking, if there is one. */
  review: Review | undefined;
  /** Resolves true when the review actually reached the database. */
  onSave: (target: ReviewTarget, input: ReviewSubmission) => Promise<boolean>;
  error: string | null;
}

/**
 * The review affordance for one completed booking: an invitation, the review itself,
 * or the form.
 *
 * Owns only whether the form is open. The review data and the write both belong to
 * useMyReviews on the page, so several of these can sit in one list without each
 * running its own query.
 *
 * There is no delete. The RLS policy permits one, deliberately — an author owns their
 * words — but exposing it here would let a sitter talk an owner into removing a bad
 * review, which is the failure mode that makes ratings worthless.
 */
export default function BookingReview({ target, review, onSave, error }: BookingReviewProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const handleSubmit = async (input: ReviewSubmission) => {
    try {
      if (await onSave(target, input)) setOpen(false);
    } catch {
      // Leave the form open and filled in. The page surfaces the reason through
      // `error`; closing would throw away what they wrote and hide the failure.
    }
  };

  if (open) {
    return (
      <ReviewForm
        initialRating={review?.rating ?? 0}
        initialBody={review?.body ?? ""}
        onSubmit={handleSubmit}
        onCancel={() => setOpen(false)}
        error={error}
        name={`rating-${target.bookingId}`}
      />
    );
  }

  if (review) {
    return (
      <div className="mt-3 pt-3 border-t border-ink/8 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Stars value={review.rating} />
            <span className="text-xs font-medium text-ink-soft">
              {t("sitters.reviews.form.yourReview")}
            </span>
          </div>
          {review.body && (
            <p className="mt-1 text-sm text-ink-soft whitespace-pre-line">{review.body}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-strong transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
          {t("sitters.reviews.form.edit")}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-ink/8">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-strong transition-colors"
      >
        {t("sitters.reviews.form.leave")}
      </button>
    </div>
  );
}
