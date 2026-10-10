import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A round 44 px button with only an icon, so its name is required (plan §2.3). */
export default function IconButton({
  label,
  tone = "plain",
  className,
  children,
  type = "button",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> & {
  label: string;
  /** plain: white with a hairline; soft: an inset fill, for closing things. */
  tone?: "plain" | "soft";
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "pb-press inline-flex items-center justify-center w-11 h-11 rounded-full text-ink flex-shrink-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        tone === "plain" ? "bg-surface border border-ink/10 hover:bg-brand-softer" : "bg-surface-2 hover:bg-brand-soft",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
