"use client";
import { Users } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { pluralForm } from "@/lib/i18n/plural";
import { PRIVACY_FLOOR, type AreaCircle } from "@/lib/areaCounts";
import { cn } from "@/lib/utils";

/** "Vilnius: 6 sitters", for an area's hover text on the map. */
export function useAreaLabel() {
  const { t, locale } = useLanguage();
  return (area: AreaCircle) => `${area.city}: ${t(`partners.people.sitters.${pluralForm(locale, area.count)}`, { count: area.count })}`;
}

/** The People layer in words, under the map: the counts, and why a city may be missing. */
export default function AreaLegend({ areas, className }: { areas: AreaCircle[]; className?: string }) {
  const { t } = useLanguage();
  if (areas.length === 0) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs leading-relaxed text-ink-soft", className)}>
      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-strong" aria-hidden="true" />
      <span>
        {t("partners.people.legend", { list: areas.map((a) => `${a.city} ${a.count}`).join(" · ") })}{" "}
        {t("partners.people.floor", { floor: PRIVACY_FLOOR })}
      </span>
    </p>
  );
}
