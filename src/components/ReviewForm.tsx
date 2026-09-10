"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import StarInput from "@/components/StarInput";
import { normaliseReviewBody, isValidRating, REVIEW_BODY_MAX_LENGTH } from "@/lib/reviews";
import { dimensionsFor, type ReviewDimension, type ReviewDirection } from "@/lib/types";

export interface ReviewSubmission {
  rating: number;
  body: string | null;
  /** Only the dimensions actually answered. Absent is not zero. */
  dimensions: Partial<Record<ReviewDimension, number>>;
}

type DimensionValues = Partial<Record<ReviewDimension, number | null>>;

interface ReviewFormProps {
  direction: ReviewDirection;
  initialRating?: number;
  initialBody?: string;
  initialDimensions?: DimensionValues;
  onSubmit: (review: ReviewSubmission) => void | Promise<void>;
  onCancel: () => void;
  error?: string | null;
  name?: string;
}

/** Dimension column to its translation key. camelCase because the dictionary is. */
const DIMENSION_KEY: Record<ReviewDimension, string> = {
  pet_wellbeing: "petWellbeing",
  communication: "communication",
  reliability: "reliability",
  pet_as_described: "petAsDescribed",
  handover: "handover",
};

/**
 * The overall star and an optional comment, plus the dimensions for this direction
 * behind a disclosure.
 *
 * Owns no data access: it reports what was entered and lets the caller decide whether
 * that becomes an INSERT or an UPDATE. The dimensions are collapsed because one tap on
 * the overall star has to stay a complete review — a form that opens with four rating
 * questions is a form people abandon, and every dimension column is nullable precisely
 * so that it can be skipped.
 */
export default function ReviewForm({
  direction,
  initialRating = 0,
  initialBody = "",
  initialDimensions,
  onSubmit,
  onCancel,
  error = null,
  name,
}: ReviewFormProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  const [dimensions, setDimensions] = useState<DimensionValues>(initialDimensions ?? {});
  const [showDetail, setShowDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canPost = isValidRating(rating) && !submitting;

  const handleSubmit = async () => {
    // booking_id and author are UNIQUE together, so a double-post races itself and the
    // loser comes back as 23505. Not sending it twice is cheaper than explaining that.
    if (!canPost) return;
    setSubmitting(true);
    try {
      // Only answered dimensions travel. An unanswered one is absent rather than 0,
      // which would fail the 1..5 CHECK; useMyReviews nulls the rest.
      const answered: Partial<Record<ReviewDimension, number>> = {};
      for (const dimension of dimensionsFor(direction)) {
        const value = dimensions[dimension];
        if (typeof value === "number" && value > 0) answered[dimension] = value;
      }
      await onSubmit({ rating, body: normaliseReviewBody(body), dimensions: answered });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-ink/8">
      <StarInput value={rating} onChange={setRating} disabled={submitting} name={name} />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={submitting}
        maxLength={REVIEW_BODY_MAX_LENGTH}
        rows={3}
        placeholder={t("sitters.reviews.form.bodyPlaceholder")}
        aria-label={t("sitters.reviews.form.bodyLabel")}
        className="mt-2 w-full rounded-input border border-ink/10 bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand/40 resize-y"
      />

      <button
        type="button"
        onClick={() => setShowDetail((open) => !open)}
        aria-expanded={showDetail}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink transition-colors"
      >
        {showDetail ? (
          <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        {t("sitters.reviews.form.detailToggle")}
      </button>

      {showDetail && (
        <div className="mt-2 space-y-1.5">
          {dimensionsFor(direction).map((dimension) => (
            <div key={dimension} className="flex items-center justify-between gap-3">
              <span className="text-xs text-ink-soft">
                {t(`sitters.reviews.form.dimension.${DIMENSION_KEY[dimension]}`)}
              </span>
              <StarInput
                value={dimensions[dimension] ?? 0}
                onChange={(value) => setDimensions((prev) => ({ ...prev, [dimension]: value }))}
                disabled={submitting}
                size="sm"
                name={`${name ?? "review"}-${dimension}`}
                label={t(`sitters.reviews.form.dimension.${DIMENSION_KEY[dimension]}`)}
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {t(error)}
        </p>
      )}

      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {t("sitters.reviews.form.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canPost}
          className="px-4 py-1.5 rounded-input bg-brand text-white text-sm font-medium hover:bg-brand-strong disabled:opacity-40 disabled:hover:bg-brand"
        >
          {t("sitters.reviews.form.post")}
        </button>
      </div>
    </div>
  );
}
