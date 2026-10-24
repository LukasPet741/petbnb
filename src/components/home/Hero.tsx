"use client";
import { MapPin, ArrowRight, Check, PawPrint, Star } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HERO } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";
import { buttonClasses } from "@/components/ui/Button";
import VerifiedSeal from "@/components/VerifiedSeal";
import RouteMap from "@/components/home/RouteMap";
import { cn, formatCurrency } from "@/lib/utils";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

// One recipe for the cards that float over the photograph.
const CARD = "rounded-[var(--radius-card)] border border-ink/8 bg-surface text-ink shadow-[var(--shadow-lg)]";

/**
 * Night Forest (2026-10-24, chosen by Lukas from three directions): the headline set large on
 * the deep band, its second line in the bright accent, the search card under it, and on the
 * other side a framed portrait with glimpses of the app floating over its edges: a price agreed
 * in the chat, the Smart-ID seal, a live walk, reviews both ways. The four things the site does
 * that a classifieds board does not, shown before anyone reads a word about them.
 *
 * The glimpses are drawn, not screenshotted, and carry no person: no name, no face, no review
 * anybody wrote. They are illustration, hidden from assistive tech; the bento further down says
 * the same things in words. The hero takes no sitter data, so it cannot degrade when the
 * profiles query fails; the sitters themselves start in the ribbon right under it.
 */
export default function Hero() {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [city, setCity] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    router.push(q ? `/browse?city=${encodeURIComponent(q)}` : "/browse");
  };

  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_85%_0%,var(--hero-to)_0%,var(--hero-from)_62%)] text-chrome-ink">
      <div aria-hidden className="pb-grain absolute inset-0 -z-10" />

      <div className="max-w-6xl mx-auto grid items-center gap-10 px-4 pt-10 pb-12 sm:pt-14 sm:pb-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-14 lg:pt-16 lg:pb-20">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } } }}
          className="w-full max-w-[38rem]"
        >
          <motion.p
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--chrome-line)] bg-[var(--chrome-active)] px-3.5 py-1.5 text-sm font-medium text-chrome-ink"
          >
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--hero-accent)]" />
            {t("home.hero.eyebrow")}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] text-chrome-ink text-balance sm:text-6xl lg:text-[3.8rem] lg:leading-[0.98]"
          >
            {t("home.hero.titleLine1")}
            <br />
            <span className="text-[var(--hero-accent)]">{t("home.hero.titleLine2")}</span>
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-5 max-w-lg text-lg leading-relaxed text-chrome-ink-soft">
            {t("home.hero.subtitle")}
          </motion.p>

          {/* The search card: the one light surface on the band, so the eye lands on it. */}
          <motion.form
            onSubmit={handleSearch}
            variants={fadeUp}
            className="mt-8 flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-2 text-ink shadow-[var(--shadow-lg)] sm:flex-row sm:rounded-full"
          >
            {/* min-w-0 is load-bearing: an input's min-content width comes from its
                default size attribute (~180px), so flex-1 alone cannot shrink it
                beside a nowrap button with a Lithuanian label at 360px. */}
            <div className="relative min-w-0 flex-1">
              <MapPin className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
              {/* 16px text: anything smaller and iOS zooms the page when the field takes focus. */}
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("home.hero.cityPlaceholder")}
                aria-label={t("home.hero.cityPlaceholder")}
                autoComplete="address-level2"
                inputMode="search"
                enterKeyHint="search"
                className="h-12 w-full rounded-full border-0 bg-brand-softer pl-11 pr-4 text-base text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <button type="submit" className={cn(buttonClasses({ size: "lg" }), "h-12")}>
              {t("home.hero.searchButton")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </motion.form>
        </motion.div>

        <div className="relative mx-auto h-[25rem] w-full max-w-md sm:h-[30rem] lg:mx-0 lg:h-[37.5rem] lg:max-w-none">
          <img
            src={HERO.portrait}
            alt={t("home.hero.photoAlt")}
            className="absolute right-0 top-0 h-[21rem] w-full rounded-[var(--radius-hero)] bg-[var(--hill-mid)] object-cover shadow-[var(--shadow-lg)] ring-1 ring-[var(--chrome-line)] sm:h-[26rem] lg:right-6 lg:top-8 lg:h-[32.5rem] lg:w-[23.75rem]"
          />

          <div aria-hidden="true">
            {/* A price agreed in the chat: offer, counter, done. */}
            <div className={cn(CARD, "absolute bottom-0 left-3 w-64 p-3.5 lg:-left-9 lg:bottom-auto lg:top-24")}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <PawPrint className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{t("home.hero.glimpse.offerTitle")}</p>
                  <p className="text-xs text-ink-soft">{t("home.hero.glimpse.offerSub")}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-1.5 text-sm leading-snug">
                <p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-brand px-3 py-2 text-on-brand">
                  {t("home.hero.glimpse.offerMine", { price: formatCurrency(70, locale) })}
                </p>
                <p className="max-w-[88%] self-start rounded-2xl rounded-bl-md bg-brand-softer px-3 py-2">
                  {t("home.hero.glimpse.offerTheirs", { price: formatCurrency(75, locale) })}
                </p>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2 rounded-[var(--radius-control)] bg-brand-soft px-3 py-2 text-brand-strong">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  {t("home.hero.glimpse.agreed")}
                </span>
                <span className="font-display text-base font-bold">{formatCurrency(75, locale)}</span>
              </div>
            </div>

            {/* The seal a Smart-ID check puts on a profile. */}
            <div className={cn(CARD, "absolute right-3 top-3 flex items-center gap-2.5 rounded-full py-2 pl-2 pr-4 lg:right-0 lg:top-0")}>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-soft">
                <VerifiedSeal method="smart_id_demo" size="md" />
              </span>
              <span className="text-sm font-semibold leading-tight">
                {t("home.hero.glimpse.sealTitle")}
                <span className="block text-xs font-medium text-ink-soft">{t("home.hero.glimpse.sealSub")}</span>
              </span>
            </div>

            {/* A walk followed on the map. Wide screens only: on a phone two cards are plenty. */}
            <div className={cn(CARD, "absolute bottom-0 left-2 hidden w-60 overflow-hidden lg:block")}>
              <RouteMap className="block h-24 w-full" />
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{t("home.hero.glimpse.walkTitle")}</p>
                  <p className="text-xs text-ink-soft">{t("home.hero.glimpse.walkStats")}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-xs font-bold tracking-wider text-amber-strong">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                  {t("home.hero.glimpse.live")}
                </span>
              </div>
            </div>

            {/* Reviews go both ways: a fact about the site, not a quote anybody wrote. */}
            <div className={cn(CARD, "absolute -right-5 bottom-20 hidden w-56 p-4 lg:block")}>
              <div className="flex gap-0.5 text-amber">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-2 text-sm font-semibold">{t("home.hero.glimpse.reviewsTitle")}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink-soft">{t("home.hero.glimpse.reviewsBody")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
