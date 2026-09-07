"use client";
import Link from "next/link";
import { ArrowRight, MapPin, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import { SECTION } from "@/lib/images";
import { topCities } from "@/lib/home";
import { pluralForm } from "@/lib/i18n/plural";
import { type Profile } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { type HomeStatus } from "@/components/home/status";

/** Four columns by two rows is eight cells. The lead city takes 2x2 and the
 *  other four take one each, so five cities fill the grid exactly with no
 *  blank tile. Change the city count and this array changes with it. */
const CELLS = ["md:col-span-2 lg:col-span-2 lg:row-span-2", "", "", "", ""];

const MAX_FACES = 4;

export default function CityGrid({ sitters, status }: { sitters: Profile[]; status: HomeStatus }) {
  const { t, locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const cities = topCities(sitters, CELLS.length);

  const countLabel = (n: number) =>
    t(`home.cities.sitterCount.${pluralForm(locale, n)}`, { count: n });

  const gridClass =
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2 gap-4 lg:h-[380px]";

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="max-w-lg">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">
              {t("home.cities.title")}
            </h2>
            <p className="text-ink-soft">{t("home.cities.subtitle")}</p>
          </div>
          <Link
            href="/sitters"
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:gap-2.5 transition-all whitespace-nowrap"
          >
            {t("home.cities.seeAll")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {status === "loading" ? (
          <div className={gridClass}>
            {CELLS.map((cell, i) => (
              <div
                key={i}
                className={`${cell} min-h-[140px] rounded-[var(--radius-card)] bg-surface-2 animate-pulse`}
              />
            ))}
          </div>
        ) : status === "error" ? (
          <EmptyState
            icon={AlertCircle}
            title={t("home.cities.errorTitle")}
            description={t("home.cities.errorDesc")}
            tone="error"
          />
        ) : cities.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={t("home.cities.emptyTitle")}
            description={t("home.cities.emptyDesc")}
            tone="encouraging"
          />
        ) : (
          <div className={gridClass}>
            {cities.map((city, i) => {
              const lead = i === 0;
              const withPhoto = city.sitters.filter((s) => s.avatar_url).slice(0, MAX_FACES);
              const stack = withPhoto.length ? withPhoto : city.sitters.slice(0, MAX_FACES);
              const rest = city.sitters.length - stack.length;

              return (
                <motion.div
                  key={city.key}
                  initial={reduceMotion ? false : { opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.3 }}
                  transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.06 }}
                  className={CELLS[i]}
                >
                  <Link
                    href={`/sitters?city=${encodeURIComponent(city.name)}`}
                    className={`group relative flex h-full min-h-[140px] flex-col justify-end overflow-hidden rounded-[var(--radius-card)] border border-black/5 p-5 shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] ${
                      lead ? "text-white" : "bg-surface text-ink"
                    }`}
                  >
                    {/* The lead cell carries a photograph so the grid is not five
                        identical white tiles. The scrim is what keeps the label
                        legible over an image whose contents we cannot control. */}
                    {lead && (
                      <>
                        <img
                          src={SECTION.care}
                          alt=""
                          aria-hidden="true"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/45 to-ink/10" />
                      </>
                    )}

                    <div className="relative">
                      <div className="mb-3 flex items-center">
                        {stack.map((s) => (
                          <Avatar
                            key={s.id}
                            name={s.full_name ?? city.name}
                            url={s.avatar_url}
                            size="sm"
                            className="-mr-3 last:mr-0 ring-2 ring-canvas"
                          />
                        ))}
                        {rest > 0 && (
                          <span
                            /* On the lead cell this sits directly on the photograph, so it gets a
                               frosted chip. The other cells are on flat --canvas, where there is
                               nothing behind the glass and it would only render grey. */
                            className={`ml-4 text-xs font-medium ${lead ? "glass-chip rounded-full px-2 py-0.5 text-white" : "text-ink-soft"}`}
                          >
                            +{rest}
                          </span>
                        )}
                      </div>
                      <h3
                        className={`font-display font-semibold tracking-tight ${lead ? "text-3xl md:text-4xl" : "text-xl"}`}
                      >
                        {city.name}
                      </h3>
                      <p className={`mt-1 text-sm ${lead ? "text-white/75" : "text-ink-soft"}`}>
                        {countLabel(city.sitters.length)}
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
