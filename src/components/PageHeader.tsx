import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** A single primary action (e.g. a Link styled as a button). Optional. */
  action?: ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-8">
      <div className="min-w-0">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-ink-soft mt-2 text-sm sm:text-base">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
