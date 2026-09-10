"use client";
import Stars from "./Stars";
import { formatAverage, reviewCountForm } from "@/lib/reviews";
import { useLanguage } from "@/context/LanguageContext";

type SummarySize = "sm" | "md";

const TEXT_CLASS: Record<SummarySize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

/**
 * A sitter's rating as one line: stars, the average, the review count.
 *
 * The unrated case is the interesting one. `average` is null rather than 0 for a
 * sitter nobody has reviewed (see averageRating), and the two empty states differ
 * on purpose:
 *
 *   "hide"  — render nothing. Used on cards. Every sitter is unrated on day one,
 *             and 25 cards each saying "no reviews yet" reads as a dead marketplace.
 *   "label" — say so explicitly. Used on the profile, where the reader has chosen
 *             this one sitter and silence would just look like a missing feature.
 *
 * Neither state renders five grey stars: that reads as "rated zero", which is the
 * precise misreading the null-not-zero rule exists to prevent.
 */
export default function RatingSummary({
  average,
  count,
  size = "sm",
  emptyState = "hide",
  className = "",
}: {
  average: number | null;
  count: number;
  size?: SummarySize;
  emptyState?: "hide" | "label";
  /** Spacing from the caller. Applied to whichever state renders, so a hidden
   *  summary leaves no empty, margined box behind on the card. */
  className?: string;
}) {
  const { t, locale } = useLanguage();
  const isRated = average != null && Number.isFinite(average) && count > 0;

  if (!isRated) {
    if (emptyState === "hide") return null;
    return (
      <span className={`${TEXT_CLASS[size]} text-ink-soft ${className}`}>
        {t("sitters.reviews.none")}
      </span>
    );
  }

  const form = reviewCountForm(locale, count);

  return (
    <span className={`inline-flex items-center gap-1.5 ${TEXT_CLASS[size]} ${className}`}>
      <Stars value={average} size={size} />
      <span className="font-medium text-ink">{formatAverage(locale, average)}</span>
      <span className="text-ink-soft/50" aria-hidden="true">
        ·
      </span>
      <span className="text-ink-soft">{t(`sitters.reviews.count.${form}`, { count })}</span>
    </span>
  );
}
