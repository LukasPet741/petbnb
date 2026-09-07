"use client";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { SECTION } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";

const PERKS = ["ownRate", "chooseServices", "ownHours", "free"] as const;

/**
 * The page's closing call to action, and the only signup CTA in the body. The
 * old page also ended on a "create a free account" block, which competed with
 * this one for the same intent; one door per intent is the point.
 */
export default function FoundingPanel() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="grid overflow-hidden rounded-[var(--radius-card)] bg-ink lg:grid-cols-2"
        >
          <div className="flex flex-col justify-center p-8 sm:p-10 lg:p-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
              {t("home.becomeSitter.titleLine1")}
              <br />
              {t("home.becomeSitter.titleLine2")}
            </h2>
            <p className="text-white/60 mb-8 leading-relaxed max-w-md">
              {t("home.becomeSitter.subtitle")}
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
              {PERKS.map((key) => (
                <li key={key} className="flex items-center gap-2 text-white/80 text-sm">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand/30">
                    <Check className="h-3 w-3 text-white" aria-hidden="true" />
                  </span>
                  {t(`home.becomeSitter.perks.${key}`)}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-flex w-fit min-h-[44px] items-center gap-2 rounded-full bg-brand px-6 py-3 font-medium text-white transition-all hover:bg-brand-strong hover:shadow-[var(--shadow-sm)]"
            >
              {t("home.becomeSitter.cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative min-h-[240px] lg:min-h-0">
            <img
              src={SECTION.becomeSitter}
              alt={t("home.becomeSitter.imageAlt")}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
