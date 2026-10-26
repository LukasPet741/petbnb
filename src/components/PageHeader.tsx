import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** The page's sidebar icon, set in a small tile above the title. Optional. */
  icon?: LucideIcon;
  /** A single primary action, drawn for the deep band: `variant: "accent"` or `"on-chrome"`. Optional. */
  action?: ReactNode;
}

/**
 * The top of every app page (Night Forest, 2026-10-26): the dashboard's deep band, so each page
 * opens in the same material as the first screen after sign-in.
 */
export default function PageHeader({ title, subtitle, icon: Icon, action }: PageHeaderProps) {
  return (
    <header className="pb-band mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-hero)] border border-[var(--chrome-line)] px-5 py-5 sm:px-8 sm:py-7">
      <div className="min-w-0 flex-1 basis-64">
        <div className="flex items-center gap-3.5">
          {Icon && (
            <span aria-hidden="true" className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-[var(--radius-control)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] text-[var(--hero-accent)]">
              <Icon className="h-5 w-5" />
            </span>
          )}
          <h1 className="min-w-0 font-display text-3xl sm:text-4xl font-semibold text-chrome-ink tracking-tight">{title}</h1>
        </div>
        {subtitle && <p className="text-chrome-ink-soft mt-2 text-sm sm:text-base">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
