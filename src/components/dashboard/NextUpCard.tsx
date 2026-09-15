"use client";
import Link from "next/link";
import { ArrowRight, MessageCircle, PawPrint } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useLanguage } from "@/context/LanguageContext";
import { SERVICE_PHOTO_FOCUS, servicePhoto } from "@/lib/images";
import { pluralForm } from "@/lib/i18n/plural";
import { formatTime } from "@/lib/utils";
import { dayLabel, type Hero } from "@/lib/dashboard";
import type { ServiceType } from "@/lib/types";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

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

const primary =
  "inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-input)] bg-brand text-white text-sm font-semibold hover:bg-brand-strong transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const secondary =
  "inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-input)] border border-ink/10 bg-white/70 text-ink text-sm font-semibold hover:bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

/**
 * The dashboard's lead card: the one thing that needs the visitor next (see pickHero).
 * A request to answer and a request still waiting read in amber; a confirmed booking in pine.
 */
export default function NextUpCard({ hero, hasPets, now }: { hero: Hero; hasPets: boolean; now: number }) {
  const { t, locale } = useLanguage();

  if (hero.kind === "empty") {
    return (
      <div className="glass-card rounded-[var(--radius-card)] border overflow-hidden grid sm:grid-cols-[minmax(0,15rem)_1fr]">
        <div className="relative h-40 sm:h-auto bg-surface-2">
          {/* Not HERO.main: that portrait crops to abstract fur in a wide band (see images.ts). */}
          <img src={servicePhoto("walking", 800)} alt="" referrerPolicy="no-referrer" style={{ objectPosition: SERVICE_PHOTO_FOCUS.walking }} className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="p-6 sm:p-8 flex flex-col justify-center gap-3">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">{t("appShell.dashboard.hero.emptyTitle")}</h2>
          <p className="text-ink-soft max-w-md">{t("appShell.dashboard.hero.emptyText")}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {!hasPets && (
              <Link href="/pets/new" className={primary}>
                <PawPrint className="w-4 h-4" aria-hidden="true" />
                {t("appShell.dashboard.hero.addPet")}
              </Link>
            )}
            <Link href="/browse" className={hasPets ? primary : secondary}>
              {t("appShell.findASitter")}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
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

  const message = (
    <Link href={`/messages/${booking.id}`} className={hero.kind === "answer" ? secondary : primary}>
      <MessageCircle className="w-4 h-4" aria-hidden="true" />
      {t("appShell.dashboard.hero.message")}
    </Link>
  );

  return (
    <div className="glass-card rounded-[var(--radius-card)] border overflow-hidden grid sm:grid-cols-[minmax(0,15rem)_1fr]">
      <div className="relative h-44 sm:h-auto bg-surface-2">
        <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <div className="p-6 sm:p-8 flex flex-col justify-center gap-2.5 min-w-0">
        <p className={`text-xs font-semibold uppercase tracking-[0.08em] ${amber ? "text-amber-strong" : "text-brand"}`}>{label}</p>
        <p className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight leading-none">
          {whenLabel(booking.start_at, now, t, locale)}
        </p>
        <p className="text-ink">
          {booking.pet?.name ?? t("appShell.dashboard.fallbackPetName")} · {t(`common.services.${booking.service}`)}
        </p>
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={person} url={booking.counterpart?.avatar_url} size="sm" />
          <span className="text-sm font-medium text-ink truncate">{person}</span>
          <span className="text-xs text-ink-soft">{t(`appShell.dashboard.hero.${visitorIsSitter ? "roleOwner" : "roleSitter"}`)}</span>
        </div>
        {count > 1 && (
          <p className="text-sm text-amber-strong">
            {t(`appShell.dashboard.hero.moreRequests.${pluralForm(locale, count)}`, { count })}
          </p>
        )}
        <div className="flex flex-wrap gap-3 mt-2">
          {hero.kind === "answer" && (
            <Link href="/bookings" className={primary}>
              {t("appShell.dashboard.hero.answer")}
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
          {message}
          {hero.kind === "next" && (
            <Link href="/bookings" className={secondary}>
              {t("appShell.dashboard.hero.details")}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
