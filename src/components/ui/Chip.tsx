import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A filter toggle (plan §2.3). Selected is always brand green with a check — never black,
 * and never colour alone.
 */
export default function Chip({
  pressed,
  count,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { pressed: boolean; count?: number; icon?: ReactNode }) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={cn(
        "pb-press inline-flex items-center gap-1.5 h-10 px-4 rounded-full border text-sm font-semibold whitespace-nowrap",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        pressed ? "bg-brand border-brand text-white" : "bg-surface border-ink/12 text-ink hover:border-ink/25",
        className,
      )}
      {...rest}
    >
      {pressed ? <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" /> : icon}
      {children}
      {count != null && <span className={cn("text-xs font-semibold", pressed ? "text-white/80" : "text-ink-soft")}>{count}</span>}
    </button>
  );
}
