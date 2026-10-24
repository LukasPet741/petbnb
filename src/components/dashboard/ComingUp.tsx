"use client";
import { useId } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { cn, formatTime } from "@/lib/utils";
import { dayKey, type DashBooking, type Role } from "@/lib/dashboard";
import { buttonClasses } from "@/components/ui/Button";

/**
 * "Coming up" (Night Forest, 2026-10-24): the next seven days as a strip, a dot on each day with
 * a confirmed booking (pine for your pet, brass for a pet you sit), then the bookings themselves
 * and, for a sitter, any finished booking still waiting to be marked done.
 */
export default function ComingUp({
  now,
  agenda,
  booked,
  toFinish,
  busy = false,
  onMarkDone,
}: {
  now: number;
  agenda: { booking: DashBooking; role: Role }[];
  booked: Map<string, Role>;
  toFinish: DashBooking[];
  busy?: boolean;
  onMarkDone?: (booking: DashBooking) => void;
}) {
  const { t, locale } = useLanguage();
  const headingId = useId();
  const weekday = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-GB", { weekday: "short" });
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    return d;
  });
  const roleLabel = (role: Role) => t(role === "owner" ? "appShell.dashboard.agenda.yourPet" : "appShell.dashboard.agenda.youSit");

  const dateBlock = (iso: string, muted = false) => {
    const d = new Date(iso);
    return (
      <span className={cn("w-12 flex-shrink-0 text-center leading-tight", muted && "opacity-70")}>
        <span className="block text-xs font-semibold uppercase tracking-wide text-ink-soft">{weekday.format(d)}</span>
        <span className="font-display text-xl font-semibold text-ink">{d.getDate()}</span>
      </span>
    );
  };

  return (
    <section aria-labelledby={headingId} className="glass-card rounded-[var(--radius-card)] border p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="font-display text-lg font-semibold tracking-tight text-ink">
          {t("appShell.dashboard.agenda.heading")}
        </h2>
        <Link href="/bookings" className="inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap text-sm font-medium text-brand hover:gap-2 transition-all">
          {t("appShell.dashboard.agenda.allBookings")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <ol aria-label={t("appShell.dashboard.agenda.weekLabel")} className="mt-2 grid grid-cols-7 gap-1.5">
        {days.map((d, i) => {
          const role = booked.get(dayKey(d.getTime()));
          const today = i === 0;
          return (
            <li
              key={d.toDateString()}
              className={cn(
                "flex flex-col items-center rounded-[var(--radius-control)] py-2",
                today ? "bg-[var(--hero-from)] text-chrome-ink" : "bg-brand-softer text-ink",
              )}
            >
              <span className="text-xs font-medium opacity-80">{weekday.format(d)}</span>
              <span className="font-display text-lg font-semibold leading-tight">{d.getDate()}</span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 h-1.5 w-1.5 rounded-full",
                  role === "sitter" ? "bg-amber" : role === "owner" ? (today ? "bg-[var(--hero-accent)]" : "bg-brand") : "bg-transparent",
                )}
              />
              {role && <span className="sr-only">{roleLabel(role)}</span>}
            </li>
          );
        })}
      </ol>

      {agenda.length === 0 && toFinish.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">{t("appShell.dashboard.agenda.empty")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/8">
          {agenda.map(({ booking, role }) => {
            const person = booking.counterpart?.full_name ?? t("appShell.sitterFallback");
            return (
              <li key={booking.id}>
                <Link
                  href={`/messages/${booking.id}`}
                  className="-mx-2 flex items-center gap-3.5 rounded-[var(--radius-control)] px-2 py-3 transition-colors hover:bg-surface/60"
                >
                  {dateBlock(booking.start_at)}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {booking.pet?.name ?? t("appShell.dashboard.fallbackPetName")} · {t(`common.services.${booking.service}`)}
                    </span>
                    <span className="block truncate text-xs text-ink-soft">
                      {formatTime(booking.start_at, locale)}–{formatTime(booking.end_at, locale)} · {person}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
                      role === "owner" ? "bg-brand-soft text-brand-strong" : "bg-amber-soft text-amber-strong",
                    )}
                  >
                    {roleLabel(role)}
                  </span>
                </Link>
              </li>
            );
          })}
          {toFinish.map((booking) => {
            const pet = booking.pet?.name ?? t("appShell.dashboard.fallbackPetName");
            const person = booking.counterpart?.full_name ?? t("appPages.bookings.ownerLabel");
            return (
              <li key={booking.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-2 py-3">
                {dateBlock(booking.start_at, true)}
                <span className="min-w-0 flex-1 basis-40">
                  <span className="block text-sm font-semibold text-ink">{t("appShell.dashboard.agenda.finishTitle", { pet })}</span>
                  <span className="block text-xs leading-relaxed text-ink-soft">{t("appShell.dashboard.agenda.finishText", { person })}</span>
                </span>
                {onMarkDone && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onMarkDone(booking)}
                    className={cn(buttonClasses({ variant: "secondary", size: "sm" }), "ml-auto")}
                  >
                    {t("appPages.bookings.markCompletedButton")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
