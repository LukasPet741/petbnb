import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * "watch": the one loader (plan §2.2). The mark's moon breathes while something is on its
 * way. `bare` is the moon alone, in the current text colour, for inside a button.
 */
export default function MoonLoader({
  size = 32,
  label,
  bare = false,
  className,
}: {
  size?: number;
  /** Shown beside the mark and announced; without it the loader is decoration. */
  label?: string;
  bare?: boolean;
  className?: string;
}) {
  const mask = `pb-wait-${useId().replace(/[^\w-]/g, "")}`;
  const svg = (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" className="flex-shrink-0">
      <defs>
        <mask id={mask}>
          <rect width="120" height="120" fill="#fff" />
          <circle cx="74" cy="46" r="29" fill="#000" />
        </mask>
      </defs>
      {!bare && <rect width="120" height="120" rx="28" fill="var(--brand)" />}
      <circle
        cx="56"
        cy="60"
        r={bare ? 44 : 36}
        fill={bare ? "currentColor" : "var(--linen)"}
        mask={`url(#${mask})`}
        style={{ animation: "pb-breathe 1.6s var(--ease-calm) infinite" }}
      />
      {!bare && <ellipse cx="79" cy="57" rx="9" ry="8" fill="var(--amber)" />}
    </svg>
  );
  if (!label) return <span className={cn("inline-flex", className)}>{svg}</span>;
  return (
    <span role="status" className={cn("inline-flex items-center gap-2.5 text-sm font-semibold text-ink-soft", className)}>
      {svg}
      {label}
    </span>
  );
}
