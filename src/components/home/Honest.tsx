"use client";
import Link from "next/link";
import { Coins, Database, ScanFace, ShieldOff, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

/**
 * The things a visitor would otherwise only find by reading the terms: no fees, no
 * checks on profiles, no insurance, where the data lives.
 *
 * Two reasons this earns its place rather than padding the page. It is the only
 * content here that a commercial marketplace could not copy — the absences are the
 * differentiator. And it is the honest counterweight to a site that otherwise looks
 * like a real booking platform: someone about to hand over their animal should know
 * nobody checked the person.
 *
 * Four open cards since Night Forest (2026-10-24), no longer an accordion: each fact is a
 * sentence or two, so hiding three of them behind a tap saved little, and an accordion here
 * sat straight on top of the FAQ's, two identical blocks in a row.
 */
const POINTS: { key: "fees" | "vetting" | "insurance" | "data"; icon: LucideIcon }[] = [
  { key: "fees", icon: Coins },
  { key: "vetting", icon: ScanFace },
  { key: "insurance", icon: ShieldOff },
  { key: "data", icon: Database },
];

export default function Honest() {
  const { t } = useLanguage();

  return (
    <section>
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-16">
        <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink tracking-tight">
          {t("home.honest.title")}
        </h2>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map(({ key, icon: Icon }) => (
            <li key={key} className="glass-card flex gap-4 rounded-[var(--radius-card)] border p-4 sm:block sm:p-5">
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-ink sm:mt-4">{t(`home.honest.points.${key}.title`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-soft sm:mt-1.5">{t(`home.honest.points.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/legal/terms" className="text-brand hover:underline">
            {t("home.honest.termsLink")}
          </Link>
          <Link href="/legal/privacy" className="text-brand hover:underline">
            {t("home.honest.privacyLink")}
          </Link>
        </div>
      </div>
    </section>
  );
}
