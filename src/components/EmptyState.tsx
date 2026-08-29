import type { ReactNode, ElementType } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  /** A single optional CTA. */
  action?: ReactNode;
  /** Icon tile color treatment. Defaults to "neutral" (current look, unchanged). */
  tone?: "neutral" | "encouraging" | "error";
}

const toneClasses: Record<NonNullable<EmptyStateProps["tone"]>, string> = {
  neutral: "bg-brand-soft text-brand",
  encouraging: "bg-amber-soft text-amber-strong",
  error: "bg-danger-soft text-danger",
};

export default function EmptyState({ icon: Icon, title, description, action, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className="bg-surface rounded-2xl border border-black/5 p-12 sm:p-16 text-center">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4 ${toneClasses[tone]}`}>
        <Icon className="w-7 h-7" />
      </div>
      <p className="text-ink font-medium">{title}</p>
      {description && <p className="text-ink-soft text-sm mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
