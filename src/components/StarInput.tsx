"use client";
import { useId } from "react";
import { Star } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/** The rating scale, matching the CHECK constraint on reviews.rating. */
const MAX_STARS = 5;

const RATINGS = Array.from({ length: MAX_STARS }, (_, i) => i + 1);

interface StarInputProps {
  /** The chosen rating, or 0 for nothing chosen yet. */
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  /** md is the overall rating; sm is a dimension row. */
  size?: "sm" | "md";
  /** Overrides the group label. Dimension rows name themselves. */
  label?: string;
  /**
   * Radio group name. Native radios group by name, so two forms open at once on the
   * bookings list would share a group and choosing a rating in one would clear the
   * other. Defaults to a generated id; pass the booking id where one is available.
   */
  name?: string;
}

/**
 * The rating control: five native radios that look like stars.
 *
 * Native inputs rather than clickable divs, because a radio group gets arrow-key
 * navigation, roving focus, form semantics and screen-reader group announcement from
 * the browser. A div with role="radio" would mean hand-writing all of that, badly.
 *
 * Stars.tsx stays the display component and is not reused here: it renders a single
 * labelled role="img", which is right for output and wrong for input.
 */
const SIZE_CLASS = { sm: "w-5 h-5", md: "w-7 h-7" } as const;

export default function StarInput({ value, onChange, disabled = false, name, size = "md", label }: StarInputProps) {
  const { t } = useLanguage();
  const generatedName = useId();
  const groupName = name ?? generatedName;

  return (
    <div
      role="radiogroup"
      aria-label={label ?? t("sitters.reviews.form.ratingLabel")}
      className="inline-flex items-center gap-1"
    >
      {RATINGS.map((rating) => {
        const filled = rating <= value;
        return (
          <label
            key={rating}
            className={`inline-flex ${disabled ? "cursor-default" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={groupName}
              value={rating}
              checked={value === rating}
              disabled={disabled}
              // The input itself is removed from view but stays in the accessibility
              // tree and keeps focus — sr-only, never display:none.
              className="sr-only peer"
              onChange={() => onChange(rating)}
            />
            <span className="sr-only">
              {t("sitters.reviews.form.starLabel", { count: rating })}
            </span>
            <Star
              aria-hidden="true"
              className={`${SIZE_CLASS[size]} transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand rounded-sm ${
                filled ? "text-amber" : "text-ink-soft/30"
              }`}
              fill={filled ? "currentColor" : "none"}
            />
          </label>
        );
      })}
    </div>
  );
}
