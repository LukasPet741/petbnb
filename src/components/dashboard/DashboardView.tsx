"use client";
import { useId } from "react";
import Link from "next/link";
import { ArrowRight, Cat, Dog, Plus } from "lucide-react";
import { motion } from "framer-motion";
import Avatar from "@/components/Avatar";
import NextUpCard, { type AnswerActions } from "@/components/dashboard/NextUpCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import OnboardingRing from "@/components/dashboard/OnboardingRing";
import TodayBand from "@/components/dashboard/TodayBand";
import ComingUp from "@/components/dashboard/ComingUp";
import PlacesNearCard from "@/components/partners/PlacesNearCard";
import { onboardingPercent, type OnboardingStep } from "@/lib/sitter-onboarding";
import { useLanguage } from "@/context/LanguageContext";
import { fadeUp, stagger } from "@/lib/motion";
import { pluralForm } from "@/lib/i18n/plural";
import { dayLabel, type DashBooking, type DashStats, type Hero, type Role } from "@/lib/dashboard";
import type { AppNotification } from "@/lib/types";

export interface DashboardViewProps {
  firstName: string;
  now: number;
  hero: Hero;
  waiting: { booking: DashBooking; role: Role }[];
  pets: { id: string; name: string; type: string; photo_url: string | null }[];
  savedCount: number;
  notifications: AppNotification[];
  notificationsLoading: boolean;
  unreadCount: number;
  onMarkAllRead: () => void;
  onOpenNotification: (n: AppNotification) => void;
  /** A sitter's steps towards being bookable; null for everyone else. Hidden once all are done. */
  onboarding?: OnboardingStep[] | null;
  /** The Today band's numbers; left out, the band only greets. */
  stats?: DashStats | null;
  /** Accept / counter / decline on the lead card, when it holds a request to answer. */
  answer?: AnswerActions | null;
  /** Confirmed bookings ahead, the week's booked days, and finished bookings to mark done. */
  agenda?: { booking: DashBooking; role: Role }[];
  booked?: Map<string, Role>;
  toFinish?: DashBooking[];
  onMarkDone?: (booking: DashBooking) => void;
  /** True while a write from this page is in flight; its buttons wait. */
  busy?: boolean;
}

/**
 * The signed-in home, Night Forest (2026-10-24, chosen by Lukas): a deep "Today" band with the
 * greeting and the visitor's numbers, then the one thing that needs them next, answerable in
 * place, and a week ahead; the side column keeps the latest notifications, pets and saved
 * sitters. Presentational — the page owns the queries and the writes — so it renders the same
 * in tests and in a sandbox as it does for real.
 */
export default function DashboardView(props: DashboardViewProps) {
  const { t, locale } = useLanguage();
  const waitingId = useId();
  const petsId = useId();
  const toAnswer = props.hero.kind === "answer" ? props.hero.count : 0;

  return (
    <motion.div className="max-w-6xl mx-auto space-y-5 px-4 py-5 sm:px-6 sm:py-10" variants={stagger(0.06)} initial="hidden" animate="show">
      <motion.div variants={fadeUp}>
        <TodayBand
          firstName={props.firstName}
          now={props.now}
          toAnswer={toAnswer}
          unread={props.unreadCount}
          stats={props.stats}
          // The empty lead card carries its own Find a sitter, and on a phone the tab bar has Browse.
          showFind={props.hero.kind !== "empty"}
        />
      </motion.div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <motion.div variants={fadeUp}>
            <NextUpCard hero={props.hero} hasPets={props.pets.length > 0} now={props.now} answer={props.answer} />
          </motion.div>

          {props.waiting.length > 0 && (
            <motion.section variants={fadeUp} aria-labelledby={waitingId} className="glass-card rounded-[var(--radius-card)] border p-5">
              <h2 id={waitingId} className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-strong">
                {t("appShell.dashboard.waiting.heading")}
              </h2>
              <ul className="mt-2">
                {props.waiting.map(({ booking, role }) => {
                  const person = booking.counterpart?.full_name ?? t("appShell.sitterFallback");
                  return (
                    <li key={booking.id} className="border-b border-ink/5 last:border-b-0">
                      <Link href="/bookings" className="-mx-2 flex items-center gap-3 rounded-[var(--radius-input)] px-2 py-3 transition-colors hover:bg-surface/60">
                        <Avatar name={person} url={booking.counterpart?.avatar_url} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{person}</p>
                          <p className={`text-xs ${role === "sitter" ? "font-medium text-amber-strong" : "text-ink-soft"}`}>
                            {t(`appShell.dashboard.waiting.${role === "sitter" ? "yours" : "theirs"}`)}
                          </p>
                          <p className="truncate text-xs text-ink-soft">
                            {booking.pet?.name} · {t(`common.services.${booking.service}`)} · {dayLabel(booking.start_at, locale)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          )}

          <motion.div variants={fadeUp}>
            <ComingUp
              now={props.now}
              agenda={props.agenda ?? []}
              booked={props.booked ?? new Map()}
              toFinish={props.toFinish ?? []}
              busy={props.busy}
              onMarkDone={props.onMarkDone}
            />
          </motion.div>

          <motion.div variants={fadeUp}>
            <PlacesNearCard pets={props.pets} />
          </motion.div>
        </div>

        <motion.aside variants={fadeUp} className="min-w-0 space-y-5">
          {props.onboarding && onboardingPercent(props.onboarding) < 100 && <OnboardingRing steps={props.onboarding} />}

          <ActivityFeed
            notifications={props.notifications}
            loading={props.notificationsLoading}
            unreadCount={props.unreadCount}
            now={props.now}
            onMarkAllRead={props.onMarkAllRead}
            onOpen={props.onOpenNotification}
          />

          <section aria-labelledby={petsId} className="glass-card rounded-[var(--radius-card)] border p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 id={petsId} className="font-display text-base font-semibold tracking-tight text-ink">{t("appShell.dashboard.pets.heading")}</h2>
              <Link
                href="/pets/new"
                aria-label={t("appShell.dashboard.pets.addPetTitle")}
                title={t("appShell.dashboard.pets.addPetTitle")}
                className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink-soft transition-colors hover:bg-surface/60 hover:text-brand"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {props.pets.length === 0 ? (
              <Link href="/pets/new" className="text-sm font-medium text-brand">{t("appShell.dashboard.pets.addFirstPet")}</Link>
            ) : (
              <ul className="flex flex-wrap gap-4">
                {props.pets.slice(0, 6).map((pet) => (
                  <li key={pet.id}>
                    <Link href="/pets" className="group flex w-20 flex-col items-center gap-1.5">
                      {pet.photo_url ? (
                        <img src={pet.photo_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-20 w-20 rounded-[var(--radius-card)] object-cover ring-1 ring-ink/5" />
                      ) : (
                        <span className="grid h-20 w-20 place-items-center rounded-[var(--radius-card)] bg-brand-soft text-brand">
                          {pet.type === "cat" ? <Cat className="h-7 w-7" aria-hidden="true" /> : <Dog className="h-7 w-7" aria-hidden="true" />}
                        </span>
                      )}
                      <span className="w-full truncate text-center text-sm font-medium text-ink transition-colors group-hover:text-brand">{pet.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/saved" className="glass-card group flex items-center justify-between gap-3 rounded-[var(--radius-card)] border px-5 py-4 transition-shadow hover:shadow-[var(--shadow-md)]">
            <span>
              <span className="block text-sm font-semibold text-ink">{t("appShell.dashboard.saved.heading")}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">
                {props.savedCount > 0 ? t(`appShell.dashboard.saved.count.${pluralForm(locale, props.savedCount)}`, { count: props.savedCount }) : t("appShell.dashboard.saved.empty")}
              </span>
            </span>
            <ArrowRight className="h-4 w-4 text-ink-soft transition-all group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
          </Link>
        </motion.aside>
      </div>
    </motion.div>
  );
}
