"use client";
import { useId } from "react";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { useLanguage } from "@/context/LanguageContext";
import { groupByDay } from "@/lib/dashboard";
import { pluralForm } from "@/lib/i18n/plural";
import { notificationActor, notificationMeta, notificationSentence } from "@/lib/notification-text";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";

export interface ActivityFeedProps {
  notifications: AppNotification[];
  loading: boolean;
  unreadCount: number;
  now: number;
  onMarkAllRead: () => void;
  onOpen: (n: AppNotification) => void;
}

/**
 * The latest notifications, built for scanning rather than reading (the research behind
 * dashboard variant A): who did what, then when; grouped under Today and Earlier; one quiet
 * dot for unread; mark-all only while there is something to clear. The bell keeps the full list.
 */
export default function ActivityFeed({ notifications, loading, unreadCount, now, onMarkAllRead, onOpen }: ActivityFeedProps) {
  const { t, locale } = useLanguage();
  const headingId = useId();
  const groups = groupByDay(notifications, now);

  const row = (n: AppNotification) => {
    const inner = (
      <>
        <Avatar name={notificationActor(n, t)} url={n.actor?.avatar_url} size="md" />
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm text-ink leading-snug", !n.read_at && "font-medium")}>{notificationSentence(n, t)}</p>
          <p className="text-xs text-ink-soft mt-1">{notificationMeta(n, t)}</p>
        </div>
        {!n.read_at && <span aria-hidden="true" className="mt-1.5 h-2 w-2 rounded-full bg-brand flex-shrink-0" />}
      </>
    );
    const rowClass = "flex items-start gap-3 py-3 -mx-2 px-2 rounded-[var(--radius-input)]";
    return (
      <li key={n.id} className="border-b border-ink/5 last:border-b-0">
        {n.booking_id ? (
          <Link
            href={`/messages/${n.booking_id}`}
            onClick={() => onOpen(n)}
            className={cn(rowClass, "hover:bg-white/60 transition-colors focus-visible:outline-2 focus-visible:outline-brand")}
          >
            {inner}
          </Link>
        ) : (
          <div className={rowClass}>{inner}</div>
        )}
      </li>
    );
  };

  const group = (key: "today" | "earlier", items: AppNotification[]) =>
    items.length > 0 && (
      <div>
        <h3 className="mt-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t(`appShell.dashboard.feed.${key}`)}</h3>
        <ul>{items.map(row)}</ul>
      </div>
    );

  return (
    <section aria-labelledby={headingId} className="glass-card rounded-[var(--radius-card)] border p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          <h2 id={headingId} className="font-display text-lg font-semibold text-ink tracking-tight">
            {t("appShell.dashboard.feed.heading")}
          </h2>
          {unreadCount > 0 && (
            <span className="whitespace-nowrap rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand-strong">
              {t(`appShell.dashboard.feed.newCount.${pluralForm(locale, unreadCount)}`, { count: unreadCount })}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="min-h-[44px] whitespace-nowrap text-sm font-medium text-brand hover:text-brand-strong transition-colors focus-visible:outline-2 focus-visible:outline-brand rounded-lg px-1"
          >
            {t("messages.notifications.markAllRead")}
          </button>
        )}
      </div>

      {loading && notifications.length === 0 ? (
        <div className="mt-4 space-y-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="h-10 w-10 rounded-full bg-surface-2 animate-pulse" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 rounded bg-surface-2 animate-pulse" />
                <div className="h-3 w-20 rounded bg-surface-2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm font-medium text-ink">{t("messages.notifications.empty")}</p>
          <p className="mt-1.5 text-xs text-ink-soft leading-relaxed">{t("messages.notifications.emptyHint")}</p>
        </div>
      ) : (
        <>
          {group("today", groups.today)}
          {group("earlier", groups.earlier)}
        </>
      )}
    </section>
  );
}
