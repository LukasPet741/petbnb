"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import Dialog from "@/components/ui/Dialog";
import Chip from "@/components/ui/Chip";
import LazyPlacesMap from "@/components/partners/LazyPlacesMap";
import PlaceMark from "@/components/partners/PlaceMark";
import AreaLegend, { useAreaLabel } from "@/components/partners/AreaLegend";
import { buttonClasses } from "@/components/ui/Button";
import { useLanguage } from "@/context/LanguageContext";
import {
  distinctLocations, formatPartnerPrice, isListed, mapPlaces, offeredCategories, partnerPlace, partnerWebsite, partnersDoing, partnersFor, trackedUrl,
  type Partner, type PartnerCategory,
} from "@/lib/partners";
import type { PetType } from "@/lib/types";
import { usePlaces } from "@/lib/usePlaces";
import { useSitterAreas } from "@/lib/useSitterAreas";
import { cn } from "@/lib/utils";

/** The animals the filter offers: the pet-profile species, less fish and "other". */
const SPECIES: PetType[] = ["dog", "cat", "small_mammal", "bird", "reptile"];

/**
 * /partners: every business that agreed to be featured, on a map and as logo cards. A card opens the
 * partner in the one dialog (a bottom sheet on a phone): who they are, what they offer and
 * for how much, where, and a link out to their own site.
 *
 * Every card says "Business": once businesses and private sitters share the site, EU
 * consumer rules (Omnibus) want owners told which is which.
 */
export default function PartnersDirectory() {
  const { t } = useLanguage();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [species, setSpecies] = useState<PetType | null>(null);
  const [category, setCategory] = useState<PartnerCategory | null>(null);
  const [allListed, setAllListed] = useState(false);
  const [showPeople, setShowPeople] = useState(true);
  const areas = useSitterAreas(showPeople);
  const areaLabel = useAreaLabel();
  const allPlaces = usePlaces();
  // An unknown slug (or one the places table has not answered with yet) simply opens nothing.
  const open = allPlaces.find((p) => p.slug === openSlug) ?? null;
  // /partners?p=dogiday opens that partner: the dashboard map's pins link here.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("p");
    if (slug) setOpenSlug(slug);
  }, []);
  const shown = useMemo(
    () => partnersDoing(category, partnersFor(species ? [species] : [], allPlaces)),
    [allPlaces, category, species],
  );
  const partners = shown.filter((p) => !isListed(p));
  const listed = shown.filter(isListed);
  const places = useMemo(() => mapPlaces(shown), [shown]);

  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-4 py-6 lg:py-10">
        <header className="pb-band rounded-[var(--radius-hero)] border border-[var(--chrome-line)] px-6 py-8 sm:px-10 sm:py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--hero-accent)]">{t("partners.eyebrow")}</p>
          <h1 className="mt-2 font-display text-3xl sm:text-5xl sm:leading-[1.05] font-semibold text-chrome-ink tracking-tight">
            {t("partners.heading")}
          </h1>
          <p className="mt-4 max-w-2xl text-chrome-ink-soft leading-relaxed sm:text-lg">{t("partners.intro")}</p>
        </header>

        <div className="mt-6 space-y-2">
          <ChipRow label={t("partners.filter.categoryLabel")}>
            <Chip pressed={category === null} onClick={() => setCategory(null)}>{t("partners.filter.all")}</Chip>
            {offeredCategories(allPlaces).map((c) => (
              <Chip key={c} pressed={category === c} onClick={() => setCategory(c)}>{t(`partners.categories.${c}`)}</Chip>
            ))}
          </ChipRow>
          <ChipRow label={t("partners.filter.label")}>
            <Chip pressed={species === null} onClick={() => setSpecies(null)}>{t("partners.filter.all")}</Chip>
            {SPECIES.map((s) => (
              <Chip key={s} pressed={species === s} onClick={() => setSpecies(s)}>{t(`partners.filter.${s}`)}</Chip>
            ))}
          </ChipRow>
          <ChipRow label={t("partners.people.layerLabel")}>
            <Chip pressed={showPeople} onClick={() => setShowPeople(!showPeople)}>{t("partners.people.toggle")}</Chip>
          </ChipRow>
        </div>

        {/* isolate: Leaflet's panes sit at z-index 400+, which would paint over the sticky header. */}
        <div className="relative isolate mt-4 h-72 overflow-hidden rounded-[var(--radius-card)] border border-ink/8 bg-surface-2 sm:h-96">
          <LazyPlacesMap places={places} onSelect={setOpenSlug} label={t("partners.map.label")} areas={showPeople ? areas : []} areaLabel={areaLabel} />
        </div>
        {showPeople && <AreaLegend areas={areas} className="mt-2" />}

        {shown.length === 0 && (
          <p className="mt-6 text-ink-soft">{t("partners.filter.none")}</p>
        )}

        {partners.length > 0 && (
          <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {partners.map((partner) => (
              <li key={partner.slug}>
                <PartnerCard partner={partner} onOpen={() => setOpenSlug(partner.slug)} />
              </li>
            ))}
          </ul>
        )}

        {/* Listed from public information: a plain list under the partners, never a partner's card. */}
        {listed.length > 0 && (
          <section aria-labelledby="listed-places" className="mt-10">
            <h2 id="listed-places" className="font-display text-xl font-semibold text-ink">{t("partners.listed.heading")}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t("partners.listed.intro")}</p>
            <ul className="mt-4 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
              {(allListed ? listed : listed.slice(0, LISTED_PREVIEW)).map((place) => (
                <li key={place.slug} className="border-b border-ink/8">
                  <button
                    type="button"
                    onClick={() => setOpenSlug(place.slug)}
                    className="group flex w-full items-center gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <PlaceMark place={place} className="h-11 w-11" />
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium text-ink transition-colors group-hover:text-brand">{place.name}</span>
                      <span className="truncate text-sm text-ink-soft">
                        {place.categories.map((c) => t(`partners.categories.${c}`)).join(" · ")} · {partnerPlace(place)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!allListed && listed.length > LISTED_PREVIEW && (
              <button type="button" onClick={() => setAllListed(true)} className="mt-4 text-sm font-semibold text-brand underline-offset-4 hover:underline">
                {t("partners.listed.showAll", { count: listed.length })}
              </button>
            )}
          </section>
        )}

        <section className="mt-12 rounded-[var(--radius-card)] border border-ink/8 bg-surface p-6 sm:p-8">
          <h2 className="font-display text-xl font-semibold text-ink">{t("partners.join.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{t("partners.join.text")}</p>
        </section>
      </main>
      <PublicFooter />

      <PartnerDialog partner={open} onClose={() => setOpenSlug(null)} />
    </div>
  );
}

/** Listed places shown before "Show all": enough to read as a directory, short enough to scroll past. */
const LISTED_PREVIEW = 12;

/** A labelled row of filter chips that scrolls sideways on a phone instead of wrapping. */
function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0">
      <span aria-hidden="true" className="shrink-0 pr-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{label}</span>
      {children}
    </div>
  );
}

function PartnerCard({ partner, onOpen }: { partner: Partner; onOpen: () => void }) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={t("partners.open", { name: partner.name })}
      className="pb-press group flex h-full w-full flex-col rounded-[var(--radius-card)] border border-ink/8 bg-surface text-left shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {/* A real logo sits on white, as it was drawn (either theme); the letter stand-in on the deep band. */}
      <div className={cn("relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-t-[var(--radius-card)] p-6", partner.logo ? "bg-white" : "pb-band")}>
        {partner.founding && (
          <span className="absolute left-2 top-2 whitespace-nowrap rounded-full bg-[var(--hero-accent)] px-2 py-0.5 text-xs font-semibold text-brand-deep shadow-[var(--shadow-sm)]">
            {t("partners.founding")}
          </span>
        )}
        {partner.logo ? (
          <img src={partner.logo} alt="" className="max-h-full max-w-[85%] object-contain pt-4 transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <PlaceMark place={partner} onBand className="h-16 w-16 text-3xl sm:h-20 sm:w-20 sm:text-4xl transition-transform duration-300 group-hover:scale-105" />
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="font-display text-lg font-semibold leading-tight text-ink">{partner.name}</span>
        <span className="inline-flex items-center gap-1 text-sm text-ink-soft">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {partnerPlace(partner)}
        </span>
        <span className="text-sm text-ink-soft">
          {partner.categories.map((c) => t(`partners.categories.${c}`)).join(" · ")}
        </span>
        <span className="mt-auto pt-2">
          <Tag>{t("partners.business")}</Tag>
        </span>
      </div>
    </button>
  );
}

function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "brand" }) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
      tone === "brand" ? "bg-brand-soft text-brand-strong" : "bg-ink/6 text-ink-soft",
    )}>
      {children}
    </span>
  );
}

function PartnerDialog({ partner, onClose }: { partner: Partner | null; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const website = partner ? partnerWebsite(partner) : null;
  const priced = partner?.services.some((s) => s.price) ?? false;
  // Focus the top of the sheet: the default, the first link, is the website button at the
  // bottom, and focusing it scrolled a long sheet past the partner's name.
  const top = useRef<HTMLDivElement>(null);

  return (
    <Dialog
      open={partner !== null}
      onClose={onClose}
      size="lg"
      initialFocus={top}
      icon={partner && <PlaceMark place={partner} className="h-14 w-14 text-2xl" />}
      title={partner?.name}
      description={partner && partner.categories.map((c) => t(`partners.categories.${c}`)).join(" · ")}
      footer={website && (
        <a href={website} target="_blank" rel="noopener" className={buttonClasses({ block: true, size: "lg" })}>
          {t("partners.website")}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </a>
      )}
    >
      {partner && (
        <div className="flex flex-col gap-6">
          <div ref={top} tabIndex={-1} className="flex flex-wrap gap-1.5 outline-none">
            <Tag>{t("partners.business")}</Tag>
            {partner.founding && <Tag tone="brand">{t("partners.founding")}</Tag>}
            {isListed(partner) && <Tag>{t("partners.listed.tag")}</Tag>}
          </div>

          {partner.description && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.about")}</h3>
              <p className="mt-2 leading-relaxed text-ink">{partner.description[locale]}</p>
            </section>
          )}

          {isListed(partner) && <p className="text-sm leading-relaxed text-ink-soft">{t("partners.listed.note")}</p>}

          {partner.services.length > 0 && <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.services")}</h3>
            <ul className="mt-2 divide-y divide-ink/8 rounded-[var(--radius-input)] border border-ink/8">
              {partner.services.map((service) => (
                <li key={service.name.en} className="flex items-baseline justify-between gap-4 px-4 py-3">
                  {service.url ? (
                    <a href={trackedUrl(service.url)} target="_blank" rel="noopener" className="inline-flex items-baseline gap-1 text-ink underline decoration-ink/25 underline-offset-4 hover:text-brand hover:decoration-brand">
                      {service.name[locale]}
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 self-center" aria-hidden="true" />
                    </a>
                  ) : (
                    <span className="text-ink">{service.name[locale]}</span>
                  )}
                  {service.price && (
                    <span className="shrink-0 font-semibold text-ink">
                      {formatPartnerPrice(service.price, locale, t("common.pricing.from"))}
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {!priced && (
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {partner.pricesNote && `${partner.pricesNote[locale]} `}
                {t("partners.pricesOnSite")}
              </p>
            )}
          </section>}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.where")}</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-ink">
              {distinctLocations(partner.locations).map((place) => (
                <li key={`${place.city}-${place.address ?? place.area ?? ""}`} className="flex items-start gap-2">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  <span>
                    {[place.city, place.area, place.address].filter(Boolean).join(", ")}
                    {place.note && <span className="block text-sm text-ink-soft">{place.note[locale]}</span>}
                  </span>
                </li>
              ))}
              {partner.hours && (
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
                  {partner.hours[locale]}
                </li>
              )}
            </ul>
          </section>
        </div>
      )}
    </Dialog>
  );
}
