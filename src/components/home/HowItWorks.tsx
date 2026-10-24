"use client";
import { ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealOnScroll } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";

const STEPS = ["find", "request", "confirm"] as const;

/**
 * The three steps, each carrying the guarantee that answers the doubt raised at
 * that step. The old page kept those guarantees in a separate "trust" section
 * three screens further down, which is the wrong place for them: the worry
 * about being charged before a sitter agrees arrives while you are reading
 * about sending the request, not later.
 *
 * Night Forest (2026-10-24) sets it on a full-width deep band, the page's one dark
 * stripe between the hero and the footer, with the step numbers drawn large: the
 * rhythm of light and dark sections is what keeps a long page from reading as one list.
 */
export default function HowItWorks() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="how-it-works"
      className="relative isolate scroll-mt-16 bg-[linear-gradient(180deg,var(--hero-from),var(--hero-to))] py-14 text-chrome-ink md:py-20"
    >
      <div aria-hidden="true" className="pb-grain absolute inset-0 -z-10" />
      <div className="max-w-6xl mx-auto px-4">
        <div className="mb-10 max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hero-accent)]">{t("home.how.eyebrow")}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight md:text-5xl md:leading-[1.05]">{t("home.how.title")}</h2>
          <p className="mt-3 text-chrome-ink-soft">{t("home.how.subtitle")}</p>
        </div>

        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((key, i) => (
            <motion.li
              key={key}
              {...revealOnScroll(i, reduceMotion, 0.1)}
              className="flex flex-col rounded-[var(--radius-hero)] border border-[var(--chrome-line)] bg-[var(--chrome-active)] p-6 sm:p-7"
            >
              <span aria-hidden="true" className="font-display text-5xl font-bold leading-none tracking-tight text-[var(--hero-accent)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-5 text-lg font-semibold">{t(`home.how.steps.${key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-chrome-ink-soft">{t(`home.how.steps.${key}.desc`)}</p>
              <p className="mt-auto flex items-start gap-2 pt-5 text-sm leading-relaxed text-chrome-ink">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--hero-accent)]" aria-hidden="true" />
                {t(`home.how.steps.${key}.note`)}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
