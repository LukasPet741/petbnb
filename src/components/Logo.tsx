/**
 * PetBnB mark: a bold geometric "B" monogram badge.
 *
 * Built from primitives only (rects + circles, no hand-drawn bezier paths):
 * a rounded-square badge, a stem, two stacked lobes cut flush by the stem,
 * and a small accent dot where the lobes meet it. The two lobes stand for
 * the two sides of the marketplace (owners and sitters); the dot marks the
 * point where they connect, echoing a booking a sitter has confirmed.
 *
 * Colors are read from the project's CSS custom properties (--ink, --brand,
 * --brand-strong, --amber in globals.css), so the mark recolors automatically
 * wherever those tokens are updated. No hex is hardcoded here.
 */

interface LogoMarkProps {
  /** Pixel size of the square mark. Defaults to 32. */
  size?: number;
  className?: string;
}

export function LogoMark({ size = 32, className }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PetBnB"
      className={className}
    >
      {/* Badge */}
      <rect x="6" y="6" width="108" height="108" rx="26" fill="var(--ink)" />

      {/* B monogram: two lobes, flush-cut on the left by the stem */}
      <circle cx="54" cy="44" r="19" fill="var(--brand)" />
      <circle cx="54" cy="77" r="21" fill="var(--brand)" />
      <rect x="32" y="27" width="16" height="66" rx="5" fill="var(--brand-strong)" />

      {/* Accent dot where the two lobes meet the stem */}
      <circle cx="48" cy="60" r="6" fill="var(--amber)" />
    </svg>
  );
}

interface LogoProps {
  /** Pixel size of the mark (square). Defaults to 32. */
  size?: number;
  /** Also render the "PetBnB" wordmark next to the mark. Defaults to false. */
  showWordmark?: boolean;
  /** Extra classes on the outer wrapper. */
  className?: string;
  /** Extra classes on the wordmark text (e.g. to override color on a dark footer). */
  wordmarkClassName?: string;
}

export default function Logo({
  size = 32,
  showWordmark = false,
  className,
  wordmarkClassName,
}: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} />
      {showWordmark && (
        <span
          className={`font-display font-semibold tracking-tight ${wordmarkClassName ?? "text-ink"}`}
          style={{ fontSize: Math.round(size * 0.56) }}
        >
          PetBnB
        </span>
      )}
    </span>
  );
}
