import type { ReactNode, ElementType } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  /** A single optional CTA — the empty state is where creating starts (plan §2.4). */
  action?: ReactNode;
  /** Icon tile color treatment. Defaults to "neutral". */
  tone?: "neutral" | "encouraging" | "error";
}

const toneClasses: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "bg-brand-soft text-brand",
  encouraging: "bg-amber-soft text-amber-strong",
  error: "bg-danger-soft text-danger",
};

/**
 * Nothing here yet (plan §2.3): a linen brand moment rather than a grey box, the icon in a
 * round tile, a title in the display face, one line on what to do, and one action.
 */
export default function EmptyState({ icon: Icon, title, description, action, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className="bg-linen rounded-[var(--radius-hero)] border border-ink/5 px-6 py-12 sm:px-12 sm:py-16 text-center">
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[var(--shadow-sm)] ${toneClasses[tone]}`}>
        <Icon className="w-7 h-7" />
      </div>
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {description && <p className="text-ink-soft text-sm mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
