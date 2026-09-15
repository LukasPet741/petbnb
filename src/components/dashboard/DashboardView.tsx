"use client";
import { useId } from "react";
import Link from "next/link";
import { ArrowRight, Cat, Dog, Plus } from "lucide-react";
import { motion } from "framer-motion";
import Avatar from "@/components/Avatar";
import NextUpCard from "@/components/dashboard/NextUpCard";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import { useLanguage } from "@/context/LanguageContext";
import { fadeUp, stagger } from "@/lib/motion";
import { pluralForm } from "@/lib/i18n/plural";
import { dayLabel, type DashBooking, type Hero, type Role } from "@/lib/dashboard";
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
}

function greetingKey(hour: number) {
  if (hour < 5 || hour >= 22) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/**
 * The signed-in home, variant A (2026-09-15): what needs you next, what just happened, and a
 * side column for what is waiting, your pets and saved sitters. Presentational — the page
 * owns the queries — so it renders the same in tests and in a sandbox as it does for real.
 */
export default function DashboardView(props: DashboardViewProps) {
  const { t, locale } = useLanguage();
  const waitingId = useId();
  const petsId = useId();
  const today = new Date(props.now);

  return (
    <motion.div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6" variants={stagger(0.06)} initial="hidden" animate="show">
      <motion.header variants={fadeUp} className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">
            {new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric" }).format(today)}
          </p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight">
            {t(`appShell.dashboard.greeting.${greetingKey(today.getHours())}`)}, {props.firstName}
          </h1>
        </div>
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-[var(--radius-input)] bg-brand text-white text-sm font-semibold hover:bg-brand-strong transition-colors"
        >
          {t("appShell.findASitter")}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </motion.header>

      <motion.div variants={fadeUp}>
        <NextUpCard hero={props.hero} hasPets={props.pets.length > 0} now={props.now} />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <motion.div variants={fadeUp}>
          <ActivityFeed
            notifications={props.notifications}
            loading={props.notificationsLoading}
            unreadCount={props.unreadCount}
            now={props.now}
            onMarkAllRead={props.onMarkAllRead}
            onOpen={props.onOpenNotification}
          />
        </motion.div>

        <motion.aside variants={fadeUp} className="space-y-6">
          {props.waiting.length > 0 && (
            <section aria-labelledby={waitingId} className="glass-card rounded-[var(--radius-card)] border p-5">
              <h2 id={waitingId} className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-strong">
                {t("appShell.dashboard.waiting.heading")}
              </h2>
              <ul className="mt-2">
                {props.waiting.map(({ booking, role }) => {
                  const person = booking.counterpart?.full_name ?? t("appShell.sitterFallback");
                  return (
                    <li key={booking.id} className="border-b border-ink/5 last:border-b-0">
                      <Link href="/bookings" className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-[var(--radius-input)] hover:bg-white/60 transition-colors">
                        <Avatar name={person} url={booking.counterpart?.avatar_url} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{person}</p>
                          <p className={`text-xs ${role === "sitter" ? "text-amber-strong font-medium" : "text-ink-soft"}`}>
                            {t(`appShell.dashboard.waiting.${role === "sitter" ? "yours" : "theirs"}`)}
                          </p>
                          <p className="text-xs text-ink-soft truncate">
                            {booking.pet?.name} · {t(`common.services.${booking.service}`)} · {dayLabel(booking.start_at, locale)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section aria-labelledby={petsId} className="glass-card rounded-[var(--radius-card)] border p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 id={petsId} className="font-display text-base font-semibold text-ink tracking-tight">{t("appShell.dashboard.pets.heading")}</h2>
              <Link
                href="/pets/new"
                aria-label={t("appShell.dashboard.pets.addPetTitle")}
                title={t("appShell.dashboard.pets.addPetTitle")}
                className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-ink-soft hover:text-brand hover:bg-white/60 transition-colors"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
            {props.pets.length === 0 ? (
              <Link href="/pets/new" className="text-sm font-medium text-brand">{t("appShell.dashboard.pets.addFirstPet")}</Link>
            ) : (
              <ul className="flex flex-wrap gap-4">
                {props.pets.slice(0, 6).map((pet) => (
                  <li key={pet.id}>
                    <Link href="/pets" className="group flex w-16 flex-col items-center gap-1.5">
                      {pet.photo_url ? (
                        <img src={pet.photo_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-16 w-16 rounded-2xl object-cover ring-1 ring-ink/5" />
                      ) : (
                        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-soft text-brand">
                          {pet.type === "cat" ? <Cat className="w-6 h-6" aria-hidden="true" /> : <Dog className="w-6 h-6" aria-hidden="true" />}
                        </span>
                      )}
                      <span className="w-full truncate text-center text-sm font-medium text-ink group-hover:text-brand transition-colors">{pet.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Link href="/saved" className="group flex items-center justify-between gap-3 glass-card rounded-[var(--radius-card)] border px-5 py-4 hover:shadow-[var(--shadow-md)] transition-shadow">
            <span>
              <span className="block text-sm font-semibold text-ink">{t("appShell.dashboard.saved.heading")}</span>
              <span className="block text-xs text-ink-soft mt-0.5">
                {props.savedCount > 0 ? t(`appShell.dashboard.saved.count.${pluralForm(locale, props.savedCount)}`, { count: props.savedCount }) : t("appShell.dashboard.saved.empty")}
              </span>
            </span>
            <ArrowRight className="w-4 h-4 text-ink-soft group-hover:text-brand group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
          </Link>
        </motion.aside>
      </div>
    </motion.div>
  );
}
