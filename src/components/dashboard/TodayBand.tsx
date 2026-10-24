"use client";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { pluralForm } from "@/lib/i18n/plural";
import { formatAverage } from "@/lib/reviews";
import type { DashStats } from "@/lib/dashboard";

function greetingKey(hour: number) {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * The top of the dashboard (Night Forest, 2026-10-24): the date and a greeting on the deep band,
 * one line on what needs the visitor, and their numbers beside it. The numbers stay away until
 * there is something to count, so a new account is greeted, not shown a row of zeros.
 */
export default function TodayBand({
  firstName,
  now,
  toAnswer,
  unread,
  stats,
  showFind,
}: {
  firstName: string;
  now: number;
  /** Requests waiting on the visitor's answer as a sitter. */
  toAnswer: number;
  unread: number;
  stats?: DashStats | null;
  /** The band's own Find a sitter, hidden when the lead card already carries one. */
  showFind: boolean;
}) {
  const { t, locale } = useLanguage();
  const today = new Date(now);
  const hasStats = !!stats && (stats.rating !== null || stats.completed > 0 || stats.upcoming > 0);

  const parts: React.ReactNode[] = [];
  if (toAnswer > 0) {
    parts.push(
      <span key="answer" className="font-semibold text-[var(--hero-accent)]">
        {t(`appShell.dashboard.today.toAnswer.${pluralForm(locale, toAnswer)}`, { count: toAnswer })}
      </span>,
    );
  }
  if (unread > 0) {
    parts.push(<span key="unread">{t(`appShell.dashboard.today.unread.${pluralForm(locale, unread)}`, { count: unread })}</span>);
  }

  return (
    <section className="relative isolate overflow-hidden rounded-[var(--radius-hero)] border border-[var(--chrome-line)] bg-[radial-gradient(120%_140%_at_100%_0%,var(--hero-to)_0%,var(--hero-from)_58%)] p-6 text-chrome-ink sm:p-8">
      <div aria-hidden="true" className="pb-grain absolute inset-0 -z-10" />
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1 basis-72">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-chrome-ink-soft">
            {new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(today)}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.05]">
            {t(`appShell.dashboard.greeting.${greetingKey(today.getHours())}`)}, {firstName}
          </h1>
          <p className="mt-3 text-chrome-ink-soft">
            {parts.length > 0
              ? parts.flatMap((part, i) => (i === 0 ? [part] : [<span key={`sep-${i}`} aria-hidden="true"> · </span>, part]))
              : t("appShell.dashboard.today.allClear")}
          </p>
          {showFind && (
            <Link
              href="/browse"
              className="pb-press mt-5 hidden h-11 items-center gap-2 rounded-full bg-[var(--hero-accent)] px-5 text-sm font-semibold text-brand-deep transition hover:brightness-105 sm:inline-flex"
            >
              {t("appShell.findASitter")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>

        {hasStats && stats && (
          <dl aria-label={t("appShell.dashboard.today.stats.label")} className="grid w-full grid-cols-3 gap-2.5 sm:w-auto sm:min-w-[25rem]">
            <div className="flex flex-col-reverse rounded-[var(--radius-card)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] px-4 py-3">
              <dt className="mt-1.5 text-xs text-chrome-ink-soft">
                {stats.rating
                  ? t(`appShell.dashboard.today.stats.reviews.${pluralForm(locale, stats.rating.count)}`, { count: stats.rating.count })
                  : t("appShell.dashboard.today.stats.noRating")}
              </dt>
              <dd className="flex items-center gap-1 font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">
                {stats.rating ? formatAverage(locale, stats.rating.average) : "–"}
                {stats.rating && <Star className="h-4 w-4 fill-amber text-amber" aria-hidden="true" />}
              </dd>
            </div>
            <div className="flex flex-col-reverse rounded-[var(--radius-card)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] px-4 py-3">
              <dt className="mt-1.5 text-xs text-chrome-ink-soft">{t("appShell.dashboard.today.stats.completed")}</dt>
              <dd className="font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">{stats.completed}</dd>
            </div>
            <div className="flex flex-col-reverse rounded-[var(--radius-card)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] px-4 py-3">
              <dt className="mt-1.5 text-xs text-chrome-ink-soft">{t("appShell.dashboard.today.stats.upcoming")}</dt>
              <dd className="font-display text-2xl font-bold leading-none tracking-tight sm:text-3xl">{stats.upcoming}</dd>
            </div>
          </dl>
        )}
      </div>
    </section>
  );
}
