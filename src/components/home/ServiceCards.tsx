"use client";
import Link from "next/link";
import { Dog, House, Sun, Scissors } from "lucide-react";
import { type ServiceType } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

/**
 * This was a rail of four bare filter pills. It read as chrome rather than content:
 * the section carried five words across its whole height, and the landing page as a
 * whole averaged 64 words per screen.
 *
 * Each service now says what it actually involves. Every card is still a real link —
 * /sitters reads the `service` param and filters on it — so the density is added
 * without inventing anything or costing a click.
 */
const SERVICES: Array<{ key: ServiceType; icon: typeof Dog }> = [
  { key: "walking", icon: Dog },
  { key: "boarding", icon: House },
  { key: "daycare", icon: Sun },
  { key: "grooming", icon: Scissors },
];

export default function ServiceCards() {
  const { t } = useLanguage();

  return (
    <section
      aria-label={t("home.services.railLabel")}
      className="border-y border-black/5 bg-surface"
    >
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-14">
        <h2 className="font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
          {t("home.services.title")}
        </h2>
        <p className="text-ink-soft mt-2 mb-8 max-w-2xl">{t("home.services.subtitle")}</p>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map(({ key, icon: Icon }) => (
            <li key={key}>
              <Link
                href={`/sitters?service=${key}`}
                className="group h-full flex flex-col rounded-[var(--radius-card)] border border-black/5 bg-canvas p-5 hover:border-brand/40 hover:shadow-[var(--shadow-md)] transition-all"
              >
                <Icon className="w-5 h-5 text-brand mb-3" aria-hidden="true" />
                <h3 className="font-semibold text-ink mb-1.5 group-hover:text-brand-strong transition-colors">
                  {t(`common.services.${key}`)}
                </h3>
                <p className="text-sm text-ink-soft leading-relaxed">
                  {t(`home.services.items.${key}.desc`)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
