"use client";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import StarInput from "@/components/StarInput";
import { normaliseReviewBody, isValidRating, REVIEW_BODY_MAX_LENGTH } from "@/lib/reviews";

export interface ReviewSubmission {
  rating: number;
  body: string | null;
}

interface ReviewFormProps {
  /** Prefilled when an existing review is being edited. */
  initialRating?: number;
  initialBody?: string;
  onSubmit: (review: ReviewSubmission) => void | Promise<void>;
  onCancel: () => void;
  /** A failure to report without clearing what the user typed. */
  error?: string | null;
  /** Radio group name; see StarInput. */
  name?: string;
}

/**
 * Rating plus optional words.
 *
 * Owns no data access: it reports what was entered and lets the caller decide whether
 * that becomes an INSERT or an UPDATE. That split is what keeps it testable without a
 * Supabase mock, and what lets the same component serve both writing and editing.
 */
export default function ReviewForm({
  initialRating = 0,
  initialBody = "",
  onSubmit,
  onCancel,
  error = null,
  name,
}: ReviewFormProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(initialRating);
  const [body, setBody] = useState(initialBody);
  const [submitting, setSubmitting] = useState(false);

  const canPost = isValidRating(rating) && !submitting;

  const handleSubmit = async () => {
    // booking_id is UNIQUE, so a double-post races itself and the loser comes back
    // as 23505. Not sending it twice is cheaper than explaining that.
    if (!canPost) return;
    setSubmitting(true);
    try {
      await onSubmit({ rating, body: normaliseReviewBody(body) });
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
