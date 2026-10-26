"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import Chip from "@/components/ui/Chip";
import LazyPlacesMap from "@/components/partners/LazyPlacesMap";
import { useLanguage } from "@/context/LanguageContext";
import { joinPetNames, mapPlaces, partnersFor } from "@/lib/partners";
import { usePlaces } from "@/lib/usePlaces";
import { useSitterAreas } from "@/lib/useSitterAreas";
import AreaLegend, { useAreaLabel } from "@/components/partners/AreaLegend";
import type { PetType } from "@/lib/types";

/**
 * The dashboard's map: partner places that take the visitor's own pets (a cat owner does not
 * see a dogs-only hotel). Every pet is on at first; a pet's chip takes it out, and "All places"
 * drops the filter. With no pets yet, every partner. A pin opens that partner on /partners.
 */
export default function PlacesNearCard({ pets }: { pets: { id: string; name: string; type: string }[] }) {
  const { t, locale } = useLanguage();
  const router = useRouter();
  const allPlaces = usePlaces();
  const areas = useSitterAreas();
  const areaLabel = useAreaLabel();
  // null: every place, whatever it takes.
  const [chosen, setChosen] = useState<string[] | null>(() => (pets.length > 0 ? pets.map((p) => p.id) : null));
  const picked = useMemo(() => (chosen ? pets.filter((p) => chosen.includes(p.id)) : []), [chosen, pets]);
  const places = useMemo(
    () => mapPlaces(partnersFor([...new Set(picked.map((p) => p.type as PetType))], allPlaces)),
    [allPlaces, picked],
  );

  const toggle = (id: string) => {
    const next = chosen?.includes(id) ? chosen.filter((x) => x !== id) : [...(chosen ?? []), id];
    setChosen(next.length > 0 ? next : null);
  };

  return (
    <section aria-labelledby="places-near" className="glass-card overflow-hidden rounded-[var(--radius-card)] border">
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div className="min-w-0">
          <h2 id="places-near" className="font-display text-base font-semibold tracking-tight text-ink">{t("partners.near.title")}</h2>
          <p className="mt-0.5 truncate text-xs text-ink-soft">
            {picked.length > 0
              ? t("partners.near.forPets", { names: joinPetNames(picked.map((p) => p.name), locale) })
              : t("partners.near.all")}
          </p>
        </div>
        <Link href="/partners" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand">
          {t("partners.near.seeAll")}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {pets.length > 0 && (
        <div role="group" aria-label={t("partners.filter.label")} className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Chip pressed={chosen === null} onClick={() => setChosen(null)}>{t("partners.near.allPlaces")}</Chip>
          {pets.map((pet) => (
            <Chip key={pet.id} pressed={chosen?.includes(pet.id) ?? false} onClick={() => toggle(pet.id)}>{pet.name}</Chip>
          ))}
        </div>
      )}
      {/* isolate: Leaflet's panes sit at z-index 400+, which would paint over the app's sticky chrome. */}
      <div className="relative isolate h-64 border-t border-ink/8 bg-surface-2">
        <LazyPlacesMap places={places} onSelect={(slug) => router.push(`/partners?p=${slug}`)} label={t("partners.map.label")} areas={areas} areaLabel={areaLabel} />
      </div>
      <AreaLegend areas={areas} className="border-t border-ink/8 px-5 py-3" />
    </section>
  );
}
