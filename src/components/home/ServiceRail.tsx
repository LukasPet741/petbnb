"use client";
import Link from "next/link";
import { Dog, Home, Sun, Scissors } from "lucide-react";
import { type ServiceType } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

/** The four services are search facets, not a product story, so they get a
 *  filter rail rather than a row of feature cards. Every pill is a real link:
 *  /sitters reads the `service` param and filters on it. */
const SERVICES: Array<{ key: ServiceType; icon: typeof Dog }> = [
  { key: "walking", icon: Dog },
  { key: "boarding", icon: Home },
  { key: "daycare", icon: Sun },
  { key: "grooming", icon: Scissors },
];

export default function ServiceRail() {
  const { t } = useLanguage();

  return (
    <nav aria-label={t("home.services.railLabel")} className="border-y border-black/5 bg-surface">
      <ul className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-center gap-2">
        {SERVICES.map(({ key, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/sitters?service=${key}`}
              className="min-h-[44px] inline-flex items-center gap-2 px-4 rounded-full border border-black/10 bg-canvas text-sm font-medium text-ink hover:border-brand/40 hover:bg-brand-softer transition-colors"
            >
              <Icon className="w-4 h-4 text-brand" aria-hidden="true" />
              {t(`common.services.${key}`)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
