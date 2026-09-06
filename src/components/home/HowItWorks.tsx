"use client";
import { ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

const STEPS = ["find", "request", "confirm"] as const;

/**
 * The three steps, each carrying the guarantee that answers the doubt raised at
 * that step. The old page kept those guarantees in a separate "trust" section
 * three screens further down, which is the wrong place for them: the worry
 * about being charged before a sitter agrees arrives while you are reading
 * about sending the request, not later.
 */
export default function HowItWorks() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4">
        <div className="max-w-xl mb-10">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">
            {t("home.how.title")}
          </h2>
          <p className="text-ink-soft">{t("home.how.subtitle")}</p>
        </div>

        <ol className="relative grid gap-8 md:grid-cols-3 md:gap-6">
          {/* The rule is the sequence made visible. It is decorative only in the
              sense that the order is already in the DOM, so it is hidden from
              assistive tech and drawn behind the markers. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-[7px] top-2 bottom-2 w-px bg-brand/20 md:left-0 md:right-0 md:top-[7px] md:bottom-auto md:h-px md:w-auto"
          />
          {STEPS.map((key, i) => (
            <motion.li
              key={key}
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.1 }}
              className="relative pl-8 md:pl-0 md:pt-8"
            >
              <span
                aria-hidden="true"
                className="absolute left-0 top-1.5 h-4 w-4 rounded-full border-[3px] border-canvas bg-brand md:top-0"
              />
              <h3 className="font-semibold text-ink text-lg mb-2">
                {t(`home.how.steps.${key}.title`)}
              </h3>
              <p className="text-sm text-ink-soft leading-relaxed mb-4">
                {t(`home.how.steps.${key}.desc`)}
              </p>
              <p className="flex items-start gap-2 rounded-[var(--radius-input)] bg-brand-softer p-3 text-sm text-brand-strong leading-relaxed">
                <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                {t(`home.how.steps.${key}.note`)}
              </p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
