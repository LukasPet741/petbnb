"use client";
import { Star, StarHalf } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { formatAverage } from "@/lib/reviews";

/** The rating scale, matching the CHECK constraint on reviews.rating. */
const MAX_STARS = 5;

type StarState = "full" | "half" | "empty";
type StarSize = "sm" | "md";

const SIZE_CLASS: Record<StarSize, string> = {
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
};

/**
 * The rating rounded to the nearest half star, clamped to the 1-5 scale.
 *
 * Rounding to the half rather than flooring keeps the picture within a quarter
 * star of the exact average, which is always printed next to it — so the two
 * never contradict each other by enough for a reader to notice.
 *
 * Clamping is not paranoia: this value arrives from a view and from seed data as
 * well as from the constrained column, the same reason averageRating() discards
 * out-of-range inputs rather than trusting them.
 */
export function starFill(value: number): number {
  if (Number.isNaN(value)) return 0;
  const clamped = Math.min(MAX_STARS, Math.max(0, value));
  return Math.round(clamped * 2) / 2;
}

function stateAt(index: number, fill: number): StarState {
  if (fill >= index + 1) return "full";
  if (fill >= index + 0.5) return "half";
  return "empty";
}

/**
 * Five stars, filled to a rating. Deliberately dumb: it renders whatever value it
 * is given, including zero. Deciding that an unrated sitter shows no stars at all
 * belongs to RatingSummary, which is the component that knows the review count.
 */
export default function Stars({
  value,
  size = "sm",
  animate = false,
}: {
  value: number;
  size?: StarSize;
  /** Filled stars pop in one after another as they scroll into view. Off under reduced motion. */
  animate?: boolean;
}) {
  const { t, locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const moving = animate && !reduceMotion;
  const fill = starFill(value);
  const iconClass = `${SIZE_CLASS[size]} text-amber`;
  const safeValue = Number.isFinite(value) ? Math.min(MAX_STARS, Math.max(0, value)) : 0;

  return (
    <span
      role="img"
      aria-label={t("sitters.reviews.starsAriaLabel", {
        rating: formatAverage(locale, safeValue),
        max: MAX_STARS,
      })}
      data-animated={moving || undefined}
      className="inline-flex items-center gap-0.5"
    >
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const state = stateAt(i, fill);
        // whileInView rather than on mount, so cards further down the grid pop in as they
        // scroll into sight. Empty stars stay still: only the rating itself is the moment.
        return (
          <motion.span
            key={i}
            data-star={state}
            className="inline-flex"
            initial={moving && state !== "empty" ? { scale: 0.4, opacity: 0 } : false}
            whileInView={moving ? { scale: 1, opacity: 1 } : undefined}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 420, damping: 18, delay: i * 0.06 }}
          >
            {state === "half" ? (
              <StarHalf className={iconClass} fill="currentColor" aria-hidden="true" />
            ) : (
              <Star
                className={state === "full" ? iconClass : `${SIZE_CLASS[size]} text-ink-soft/25`}
                fill={state === "full" ? "currentColor" : "none"}
                aria-hidden="true"
              />
            )}
          </motion.span>
        );
      })}
    </span>
  );
}
