import { useId } from "react";

/**
 * PetBnB mark (look A, Calm, chosen 2026-10-10): a crescent moon keeps watch over a paw.
 * Someone is looking after your pet while you are away.
 *
 * The same shapes as src/app/icon.svg, the file the favicon, the Apple icon and the share
 * card are made from; Logo.test.tsx keeps the two drawings equal. Here the colours are the
 * app's CSS variables (--brand, --linen, --amber in globals.css), so the mark follows the
 * tokens wherever they change.
 *
 * Each mark gets its own mask id: the header, the footer and the sidebar can all be on one
 * page, and a shared id would make every crescent use the first mask it finds.
 */

interface LogoMarkProps {
  /** Pixel size of the square mark. Defaults to 32. */
  size?: number;
  className?: string;
  /** Hide the mark from screen readers, for when the name is written next to it. */
  decorative?: boolean;
}

export function LogoMark({ size = 32, className, decorative = false }: LogoMarkProps) {
  const mask = `petbnb-moon-${useId().replace(/[^\w-]/g, "")}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": "PetBnB" })}
    >
      <defs>
        <mask id={mask}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="74" cy="46" r="29" fill="#000" />
        </mask>
      </defs>
      <rect width="120" height="120" rx="28" fill="var(--brand)" />
      <circle cx="56" cy="60" r="36" fill="var(--linen)" mask={`url(#${mask})`} />
      <ellipse cx="79" cy="57" rx="8.5" ry="7.5" fill="var(--amber)" />
      <circle cx="68" cy="47" r="3.8" fill="var(--amber)" />
      <circle cx="75" cy="40.5" r="3.8" fill="var(--amber)" />
      <circle cx="84" cy="40.5" r="3.8" fill="var(--amber)" />
      <circle cx="91" cy="47" r="3.8" fill="var(--amber)" />
    </svg>
  );
}

interface LogoProps {
  /** Pixel size of the mark (square). Defaults to 32. */
  size?: number;
  /** Also render the "petbnb" wordmark next to the mark. Defaults to false. */
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
      <LogoMark size={size} decorative={showWordmark} />
      {showWordmark && (
        <span
          className={`font-display font-bold tracking-[-0.04em] ${wordmarkClassName ?? "text-ink"}`}
          style={{ fontSize: Math.round(size * 0.56) }}
        >
          petbnb
        </span>
      )}
    </span>
  );
}
