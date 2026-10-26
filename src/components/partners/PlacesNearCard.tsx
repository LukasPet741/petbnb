"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import LazyPlacesMap from "@/components/partners/LazyPlacesMap";
import { useLanguage } from "@/context/LanguageContext";
import { mapPlaces, partnersFor } from "@/lib/partners";
import type { PetType } from "@/lib/types";

/**
 * The dashboard's map: partner places that take the visitor's own pets (a cat owner does not
 * see a dogs-only hotel). With no pets yet, every partner. A pin opens that partner on /partners.
 */
export default function PlacesNearCard({ pets }: { pets: { name: string; type: string }[] }) {
  const { t } = useLanguage();
  const router = useRouter();
  const species = useMemo(() => [...new Set(pets.map((p) => p.type as PetType))], [pets]);
  const places = useMemo(() => mapPlaces(partnersFor(species)), [species]);

  return (
    <section aria-labelledby="places-near" className="glass-card overflow-hidden rounded-[var(--radius-card)] border">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <h2 id="places-near" className="font-display text-base font-semibold tracking-tight text-ink">{t("partners.near.title")}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {pets.length > 0
              ? t("partners.near.forPets", { names: pets.map((p) => p.name).join(", ") })
              : t("partners.near.all")}
          </p>
        </div>
        <Link href="/partners" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand">
          {t("partners.near.seeAll")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="h-64 border-t border-ink/8 bg-surface-2">
        <LazyPlacesMap places={places} onSelect={(slug) => router.push(`/partners?p=${slug}`)} label={t("partners.map.label")} />
      </div>
    </section>
  );
}
