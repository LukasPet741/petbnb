"use client";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealOnScroll } from "@/lib/motion";
import { SECTION } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const PERKS = ["ownRate", "chooseServices", "ownHours", "free"] as const;

/**
 * The page's closing call to action, and the only signup CTA in the body. The
 * old page also ended on a "create a free account" block, which competed with
 * this one for the same intent; one door per intent is the point.
 *
 * A light card since Night Forest (2026-10-24): the footer right under it is deep green,
 * and two deep blocks in a row read as one heavy slab at the end of the page.
 */
export default function FoundingPanel() {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  // Someone signed in has no account to create: Sitter mode lives on their profile.
  const { user } = useAuth();

  return (
    <section id="become-a-sitter" className="scroll-mt-16 py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <motion.div
          {...revealOnScroll(0, reduceMotion)}
          className="glass-card grid overflow-hidden rounded-[var(--radius-hero)] border lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
        >
          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-14">
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink md:text-5xl md:leading-[1.05]">
              {t("home.becomeSitter.titleLine1")}
              <br />
              {t("home.becomeSitter.titleLine2")}
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-ink-soft">{t("home.becomeSitter.subtitle")}</p>
            <ul className="mt-6 flex flex-wrap gap-2">
              {PERKS.map((key) => (
                <li key={key} className="inline-flex items-center gap-1.5 rounded-full bg-brand-softer px-3 py-1.5 text-sm font-medium text-ink">
                  <Check className="h-3.5 w-3.5 text-brand" strokeWidth={3} aria-hidden="true" />
                  {t(`home.becomeSitter.perks.${key}`)}
                </li>
              ))}
            </ul>
            <Link href={user ? "/profile" : "/signup"} className={cn(buttonClasses({ size: "lg" }), "mt-8 w-fit")}>
              {t(user ? "home.becomeSitter.ctaSignedIn" : "home.becomeSitter.cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="relative min-h-[16rem] lg:min-h-0">
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
