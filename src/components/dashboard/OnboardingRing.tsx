"use client";
import { useId } from "react";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { onboardingPercent, type OnboardingStep } from "@/lib/sitter-onboarding";

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * "Get bookable": a ring that fills as a sitter finishes their profile, beside the steps left.
 * Done steps stay visible but struck through, so the ring's number is explained on the card.
 * Under reduced motion the ring is drawn at its final length at once.
 */
export default function OnboardingRing({ steps }: { steps: OnboardingStep[] }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const headingId = useId();
  const percent = onboardingPercent(steps);
  const offset = CIRCUMFERENCE * (1 - percent / 100);

  return (
    <section
      aria-labelledby={headingId}
      className="glass-card rounded-[var(--radius-card)] border p-5 sm:p-6 grid gap-5 sm:grid-cols-[auto_1fr] items-center"
    >
      <div
        role="progressbar"
        aria-label={t("appShell.dashboard.onboarding.title")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="relative mx-auto h-24 w-24"
      >
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={RADIUS} fill="none" strokeWidth="7" className="stroke-ink/10" />
          <motion.circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            className="stroke-brand"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: reduceMotion ? offset : CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-xl font-semibold text-ink tabular-nums">
          {percent}%
        </span>
      </div>

      <div className="min-w-0">
        <h2 id={headingId} className="font-display text-lg font-semibold text-ink tracking-tight">
          {t("appShell.dashboard.onboarding.title")}
        </h2>
        <p className="text-sm text-ink-soft mt-0.5">{t("appShell.dashboard.onboarding.subtitle")}</p>
        <ul className="mt-3 grid gap-x-4 sm:grid-cols-2">
          {steps.map((step) => (
            <li key={step.key}>
              {step.done ? (
                <span className="flex min-h-11 items-center gap-2 text-sm text-ink-soft line-through decoration-ink/20">
                  <Check className="h-4 w-4 flex-shrink-0 text-brand" aria-hidden="true" />
                  {t(`appShell.dashboard.onboarding.steps.${step.key}`)}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="group -mx-2 flex min-h-11 items-center gap-2 rounded-[var(--radius-input)] px-2 text-sm font-medium text-ink hover:bg-white/60 transition-colors"
                >
                  <span className="h-4 w-4 flex-shrink-0 rounded-full ring-1 ring-ink/25" aria-hidden="true" />
                  {t(`appShell.dashboard.onboarding.steps.${step.key}`)}
                  <ChevronRight className="ml-auto h-4 w-4 flex-shrink-0 text-ink-soft group-hover:text-brand" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
