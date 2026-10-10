import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import MoonLoader from "./MoonLoader";

/**
 * The one button (plan §2.3). Pill-shaped, pressed with Calm's 0.97 (.pb-press, plain
 * CSS, so it works before the page hydrates), focus ring in brand green.
 * `ButtonLink` is the same look on a link, for navigation.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "danger-soft";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong shadow-[var(--shadow-sm)]",
  secondary: "bg-surface text-ink border border-ink/12 hover:bg-brand-softer",
  ghost: "bg-transparent text-brand hover:bg-brand-softer",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-soft": "bg-danger-soft text-danger hover:brightness-95",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-sm gap-2",
  lg: "h-13 px-6 text-base gap-2",
};

interface Look {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
}

export function buttonClasses({ variant = "primary", size = "md", block = false }: Look = {}) {
  return cn(
    "pb-press inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap select-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    "disabled:opacity-45 disabled:cursor-not-allowed",
    VARIANT[variant],
    SIZE[size],
    block && "w-full",
  );
}

// ComponentProps<"button"> carries `ref`, which React 19 passes as a plain prop.
type ButtonProps = ComponentProps<"button"> & Look & { loading?: boolean };

export default function Button({ variant, size, block, loading = false, className, children, type = "button", disabled, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClasses({ variant, size, block }), className)}
      {...rest}
    >
      {loading && <MoonLoader bare size={18} />}
      {children}
    </button>
  );
}

export function ButtonLink({ variant, size, block, className, ...rest }: ComponentProps<typeof Link> & Look) {
  return <Link className={cn(buttonClasses({ variant, size, block }), className)} {...rest} />;
}
