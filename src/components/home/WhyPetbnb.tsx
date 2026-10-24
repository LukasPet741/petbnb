"use client";
import { MessageCircle, Route } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealOnScroll } from "@/lib/motion";
import VerifiedSeal from "@/components/VerifiedSeal";
import RouteMap from "@/components/home/RouteMap";
import { formatCurrency } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Why petbnb (Night Forest, 2026-10-24): the four things the hero's floating cards hint at,
 * said in words. A bento rather than four equal cards: the two with something to show (the
 * chat, the map) take two columns, the two that are one fact each (no commission, the seal)
 * take one. The chat and the map are illustrations, hidden from assistive tech; each tile's
 * heading and sentence carry the meaning.
 */
export default function WhyPetbnb() {
  const { t, locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const offer = formatCurrency(12, locale);
  const counter = formatCurrency(14, locale);

  return (
    <section id="why" className="scroll-mt-16 py-12 md:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand">{t("home.why.eyebrow")}</p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-semibold tracking-tight text-ink text-balance md:text-5xl md:leading-[1.05]">
          {t("home.why.title")}
        </h2>

        <div className="mt-8 grid gap-4 md:mt-10 md:grid-cols-3">
          <motion.article
            {...revealOnScroll(0, reduceMotion)}
            className="relative isolate overflow-hidden rounded-[var(--radius-hero)] border border-[var(--chrome-line)] bg-[linear-gradient(160deg,var(--hero-from),var(--hero-to))] p-6 text-chrome-ink sm:p-8 md:col-span-2"
          >
            <div aria-hidden="true" className="pb-grain absolute inset-0 -z-10" />
            <div className="grid items-center gap-6 sm:grid-cols-2 sm:gap-8">
              <div>
                <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-[var(--chrome-active)] text-[var(--hero-accent)]">
                  <MessageCircle className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("home.why.bargain.title")}</h3>
                <p className="mt-3 leading-relaxed text-chrome-ink-soft">{t("home.why.bargain.body")}</p>
              </div>
              <div aria-hidden="true" className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] p-4">
                <p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-[var(--hero-accent)] px-3.5 py-2 text-sm text-brand-deep">
                  {t("home.why.bargain.mine", { price: offer })}
                </p>
                <p className="max-w-[88%] self-start rounded-2xl rounded-bl-md bg-[var(--chrome-active)] px-3.5 py-2 text-sm leading-snug">
                  {t("home.why.bargain.theirs", { price: counter })}
                </p>
                <div className="mt-1.5 flex gap-2">
                  <span className="grid h-11 flex-1 place-items-center rounded-full bg-[var(--hero-accent)] px-2 text-sm font-semibold text-brand-deep">
                    {t("home.why.bargain.accept", { price: counter })}
                  </span>
                  <span className="grid h-11 flex-1 place-items-center rounded-full border border-[var(--chrome-line)] px-2 text-sm font-semibold">
                    {t("home.why.bargain.counter")}
                  </span>
                </div>
              </div>
            </div>
          </motion.article>

          <motion.article
            {...revealOnScroll(1, reduceMotion)}
            className="glass-card flex flex-col justify-between gap-6 rounded-[var(--radius-hero)] border p-6 sm:min-h-[17rem] sm:p-8"
          >
            <p className="font-display text-7xl font-bold leading-[0.85] tracking-[-0.05em] text-brand sm:text-8xl">{t("home.why.fees.big")}</p>
            <div>
              <h3 className="text-lg font-semibold text-ink">{t("home.why.fees.title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("home.why.fees.body")}</p>
            </div>
          </motion.article>

          <motion.article
            {...revealOnScroll(0, reduceMotion)}
            className="glass-card flex flex-col justify-between gap-6 rounded-[var(--radius-hero)] border p-6 sm:min-h-[17rem] sm:p-8"
          >
            <span className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-brand-soft ring-[10px] ring-brand-softer">
              <VerifiedSeal method="smart_id_demo" className="h-10 w-10" />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink">{t("home.why.seal.title")}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("home.why.seal.body")}</p>
            </div>
          </motion.article>

          <motion.article
            {...revealOnScroll(1, reduceMotion)}
            className="grid items-center gap-6 rounded-[var(--radius-hero)] bg-brand-soft p-6 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] sm:gap-8 sm:p-8 md:col-span-2"
          >
            <div>
              <span className="grid h-11 w-11 place-items-center rounded-[var(--radius-control)] bg-surface text-brand">
                <Route className="h-5 w-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">{t("home.why.walks.title")}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">{t("home.why.walks.body")}</p>
            </div>
            <div aria-hidden="true" className="relative h-56 overflow-hidden rounded-[var(--radius-card)]">
              <RouteMap className="absolute inset-0 h-full w-full" />
              <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-amber-strong">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber" />
                  {t("home.why.walks.live")}
                </span>
                <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink">{t("home.why.walks.distance")}</span>
                <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink">{t("home.why.walks.time")}</span>
              </div>
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  );
}
