import type { ReactNode, ElementType } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  /** A single optional CTA. */
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="bg-surface rounded-2xl border border-black/5 p-12 sm:p-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-brand" />
      </div>
      <p className="text-ink font-medium">{title}</p>
      {description && <p className="text-ink-soft text-sm mt-1.5 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
