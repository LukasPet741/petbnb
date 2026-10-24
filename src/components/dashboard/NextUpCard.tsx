"use client";
import { useId } from "react";
import Link from "next/link";
import { ArrowRight, Check, MessageCircle, PawPrint } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useLanguage } from "@/context/LanguageContext";
import { SERVICE_PHOTO_FOCUS, servicePhoto } from "@/lib/images";
import { pluralForm } from "@/lib/i18n/plural";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import { dayLabel, type Hero } from "@/lib/dashboard";
import type { ServiceType } from "@/lib/types";
import { buttonClasses } from "@/components/ui/Button";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/**
 * What the lead card can do about a request right where it stands: the price on the table and
 * the sitter's three answers. The page works these out with the same rules as /bookings
 * (bookingPriceView, and the database checks the amount again on accept).
 */
export interface AnswerActions {
  /** "Asking €10" / "Offered €8". */
  priceLine: string | null;
  canAccept: boolean;
  acceptLabel?: string;
  /** "Waiting for the owner" when the sitter has countered and the owner has not replied. */
  waitingLabel?: string | null;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Tomorrow, 09:00" for the next two days; the date itself after that. */
function whenLabel(iso: string, now: number, t: Translate, locale: "en" | "lt"): string {
  const start = new Date(iso);
  const time = formatTime(start, locale);
  const days = Math.round((startOfDay(start) - startOfDay(new Date(now))) / 86_400_000);
  if (days === 0) return t("appShell.dashboard.hero.today", { time });
  if (days === 1) return t("appShell.dashboard.hero.tomorrow", { time });
  return `${dayLabel(iso, locale)}, ${time}`;
}

// The shared button looks (components/ui/Button), on links and buttons alike.
const primary = buttonClasses();
const secondary = buttonClasses({ variant: "secondary" });
const ghost = buttonClasses({ variant: "ghost" });

/**
 * The dashboard's lead card: the one thing that needs the visitor next (see pickHero).
 * A request to answer and a request still waiting read in amber; a confirmed booking in pine.
 *
 * Night Forest (2026-10-24): a request is answered on the card itself. Accept at the price on
 * the table, counter in the chat where offers live, or decline after a confirm, without the
 * detour through /bookings. Without `answer` (the price has not loaded yet) it falls back to
 * the old link there.
 */
export default function NextUpCard({
  hero,
  hasPets,
  now,
  answer = null,
}: {
  hero: Hero;
  hasPets: boolean;
  now: number;
  answer?: AnswerActions | null;
}) {
  const { t, locale } = useLanguage();
  const labelId = useId();

  if (hero.kind === "empty") {
    return (
      <div className="glass-card grid overflow-hidden rounded-[var(--radius-hero)] border sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="relative h-44 bg-surface-2 sm:h-auto">
          {/* Not HERO.main: that portrait crops to abstract fur in a wide band (see images.ts). */}
          <img src={servicePhoto("walking", 800)} alt="" referrerPolicy="no-referrer" style={{ objectPosition: SERVICE_PHOTO_FOCUS.walking }} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="flex flex-col justify-center gap-3 p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("appShell.dashboard.hero.emptyTitle")}</h2>
          <p className="max-w-md text-ink-soft">{t("appShell.dashboard.hero.emptyText")}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {!hasPets && (
              <Link href="/pets/new" className={primary}>
                <PawPrint className="h-4 w-4" aria-hidden="true" />
                {t("appShell.dashboard.hero.addPet")}
              </Link>
            )}
            <Link href="/browse" className={hasPets ? primary : secondary}>
              {t("appShell.findASitter")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { booking } = hero;
  const visitorIsSitter = hero.kind === "answer" || (hero.kind === "next" && hero.role === "sitter");
  const amber = hero.kind !== "next";
  const label = t(`appShell.dashboard.hero.${hero.kind === "answer" ? "answerLabel" : hero.kind === "awaiting" ? "awaitingLabel" : "nextLabel"}`);
  const person = booking.counterpart?.full_name ?? t("appShell.sitterFallback");
  const photo = booking.pet?.photo_url ?? servicePhoto(booking.service as ServiceType, 800);
  const count = hero.kind === "next" ? 1 : hero.count;
  const note = hero.kind === "answer" ? booking.notes?.trim() : null;
  const price =
    hero.kind === "answer"
      ? answer?.priceLine ?? null
      : booking.agreed_price != null
        ? t("common.pricing.agreed", { price: formatCurrency(booking.agreed_price, locale) })
        : null;

  const message = (className: string) => (
    <Link href={`/messages/${booking.id}`} className={className}>
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {t("appShell.dashboard.hero.message")}
    </Link>
  );

  let actions: React.ReactNode;
  if (hero.kind === "answer" && answer) {
    actions = (
      <>
        {answer.canAccept && answer.acceptLabel && (
          <button type="button" onClick={answer.onAccept} disabled={answer.busy} className={primary}>
            <Check className="h-4 w-4" strokeWidth={2.6} aria-hidden="true" />
            {answer.acceptLabel}
          </button>
        )}
        {/* One filled button: accepting is the answer the card is there for; the other two are quieter. */}
        <Link href={`/messages/${booking.id}`} className={cn(ghost, "px-3.5")}>
          {t("appShell.dashboard.hero.counter")}
        </Link>
        <button type="button" onClick={answer.onDecline} disabled={answer.busy} className={cn(ghost, "px-3.5 text-ink-soft")}>
          {t("appPages.bookings.declineButton")}
        </button>
      </>
    );
  } else if (hero.kind === "answer") {
    actions = (
      <>
        <Link href="/bookings" className={primary}>
          {t("appShell.dashboard.hero.answer")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        {message(secondary)}
      </>
    );
  } else {
    actions = (
      <>
        {message(primary)}
        {hero.kind === "next" && (
          <Link href="/bookings" className={secondary}>
            {t("appShell.dashboard.hero.details")}
          </Link>
        )}
      </>
    );
  }

  return (
    <section aria-labelledby={labelId} className="glass-card overflow-hidden rounded-[var(--radius-hero)] border">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-ink/8 px-5 py-3.5 sm:px-6">
        <h2 id={labelId} className={cn("inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em]", amber ? "text-amber-strong" : "text-brand")}>
          <span aria-hidden="true" className={cn("h-2 w-2 rounded-full ring-4", amber ? "bg-amber ring-amber-soft" : "bg-brand ring-brand-soft")} />
          {label}
        </h2>
        {count > 1 && (
          <p className="text-sm text-amber-strong">
            {t(`appShell.dashboard.hero.moreRequests.${pluralForm(locale, count)}`, { count })}
          </p>
        )}
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[minmax(0,11rem)_1fr] sm:p-6">
        <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-48 w-full rounded-[var(--radius-card)] bg-surface-2 object-cover sm:h-full sm:min-h-[13rem]" />
        <div className="flex min-w-0 flex-col gap-2.5">
          <p className="font-display text-3xl font-semibold leading-none tracking-tight text-ink sm:text-4xl">
            {whenLabel(booking.start_at, now, t, locale)}
          </p>
          <p className="text-ink">
            {booking.pet?.name ?? t("appShell.dashboard.fallbackPetName")} · {t(`common.services.${booking.service}`)}
          </p>
          <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-2">
            <Avatar name={person} url={booking.counterpart?.avatar_url} size="sm" />
            <span className="truncate text-sm font-medium text-ink">{person}</span>
            <span className="text-xs text-ink-soft">{t(`appShell.dashboard.hero.${visitorIsSitter ? "roleOwner" : "roleSitter"}`)}</span>
            {price && (
              <span className="ml-auto whitespace-nowrap rounded-full bg-brand-softer px-3 py-1 text-sm font-semibold text-brand">{price}</span>
            )}
          </div>
          {note && (
            <p className="line-clamp-3 rounded-[var(--radius-control)] bg-brand-softer px-3.5 py-2.5 text-sm leading-relaxed text-ink-soft">
              {`“${note}”`}
            </p>
          )}
          {hero.kind === "answer" && answer?.waitingLabel && (
            <p className="text-sm text-ink-soft">{answer.waitingLabel}</p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-2">{actions}</div>
        </div>
      </div>
    </section>
  );
}
