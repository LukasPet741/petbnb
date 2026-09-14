"use client";
import Avatar from "@/components/Avatar";
import { useLanguage } from "@/context/LanguageContext";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { bookingDuration, estimatedTotal } from "@/lib/booking-duration";
import type { Profile, ServiceType } from "@/lib/types";

/**
 * The live summary beside the booking form: what you are about to request, filling in
 * as you type.
 *
 * Owns no data access, exactly like ReviewForm. The page hands it the sitter and the
 * four values the form holds; it decides only how to present them. That is what keeps
 * its tests free of Supabase and router mocks.
 *
 * It renders half-filled for most of the time anyone spends on this page, so every row
 * has a deliberate "not chosen yet" state rather than collapsing or showing a zero.
 *
 * It never prints the hourly rate. The only euro figure here is the computed estimate,
 * so a price on screen always corresponds to the booking actually described above it —
 * a standing rate beside an incomplete range reads as a quote, and it would be wrong.
 */

interface BookingSummaryProps {
  sitter: Profile | null;
  service: ServiceType | "";
  /** Raw `datetime-local` values, straight from the form. */
  startAt: string;
  endAt: string;
}

/** One label/value row. Values that are not known yet get the muted placeholder. */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-black/5 last:border-0">
      <span className="text-xs text-ink-soft flex-shrink-0">{label}</span>
      <span className="text-sm text-ink text-right min-w-0">{children}</span>
    </div>
  );
}

export default function BookingSummary({ sitter, service, startAt, endAt }: BookingSummaryProps) {
  const { t, locale } = useLanguage();
  const notChosen = (
    <span className="text-ink-soft/60">{t("appPages.bookingsNew.summaryNotChosen")}</span>
  );

  const duration = bookingDuration(startAt, endAt);
  // datetime-local values are "YYYY-MM-DDTHH:mm" in local time, so the first ten
  // characters are the local calendar date.
  const sameDay = startAt.slice(0, 10) === endAt.slice(0, 10);
  const total = duration.valid ? estimatedTotal(duration.hours, sitter?.rate_per_hour ?? null) : null;

  // At most one decimal: 1.5 stays 1.5, 3 stays 3 rather than becoming 3.0.
  const hoursLabel = duration.valid
    ? t("appPages.bookingsNew.summaryDurationHours", {
        hours: new Intl.NumberFormat(locale === "lt" ? "lt-LT" : "en-GB", {
          maximumFractionDigits: 1,
        }).format(duration.hours),
      })
    : null;

  return (
    <aside className="glass-panel border rounded-[var(--radius-card)] p-5">
      <h2 className="font-display text-base font-semibold text-ink tracking-tight mb-3">
        {t("appPages.bookingsNew.summaryTitle")}
      </h2>

      {sitter && (
        <div className="flex items-center gap-3 pb-3 mb-1 border-b border-black/5">
          <Avatar name={sitter.full_name ?? ""} url={sitter.avatar_url} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-ink truncate">{sitter.full_name}</div>
            <div className="text-xs text-ink-soft truncate">{sitter.city}</div>
          </div>
        </div>
      )}

      <Row label={t("appPages.bookingsNew.summaryServiceLabel")}>
        {service ? t(`common.services.${service}`) : notChosen}
      </Row>

      <Row label={t("appPages.bookingsNew.summaryWhenLabel")}>
        {startAt && endAt ? (
          // Two short lines rather than one long one: the column is 20rem, and the
          // single-line form wrapped wherever the space happened to fall. A same-day
          // booking -- most walks and daycare -- needs its date only once.
          <span className="tabular-nums">
            {sameDay ? (
              <>
                <span className="block">{formatDate(startAt, locale)}</span>
                <span className="block">
                  {formatTime(startAt, locale)}–{formatTime(endAt, locale)}
                </span>
              </>
            ) : (
              <>
                <span className="block">
                  {formatDate(startAt, locale)} {formatTime(startAt, locale)} →
                </span>
                <span className="block">
                  {formatDate(endAt, locale)} {formatTime(endAt, locale)}
                </span>
              </>
            )}
          </span>
        ) : (
          notChosen
        )}
      </Row>

      <Row label={t("appPages.bookingsNew.summaryDurationLabel")}>
        {hoursLabel ??
          (startAt && endAt ? (
            // Both dates are chosen, so "not chosen yet" would be untrue. The form
            // names the actual problem beside the field; this only points at it.
            <span className="text-danger">{t("appPages.bookingsNew.summaryInvalidRange")}</span>
          ) : (
            notChosen
          ))}
      </Row>

      <Row label={t("appPages.bookingsNew.summaryEstimateLabel")}>
        {total !== null ? (
          <span className="font-semibold tabular-nums">{formatCurrency(total, locale)}</span>
        ) : startAt && endAt ? (
          // Both dates are in, yet no figure: a bad range, or a sitter with no rate.
          // Unknown, not unchosen -- and never €0.
          <span className="text-ink-soft/60">—</span>
        ) : (
          notChosen
        )}
      </Row>

      <p className="text-xs text-ink-soft/70 mt-3">{t("appPages.bookingsNew.finalPriceNote")}</p>
    </aside>
  );
}
