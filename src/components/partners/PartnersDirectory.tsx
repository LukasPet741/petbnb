"use client";
import { useRef, useState } from "react";
import { ArrowUpRight, Clock, MapPin } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import Dialog from "@/components/ui/Dialog";
import { buttonClasses } from "@/components/ui/Button";
import { useLanguage } from "@/context/LanguageContext";
import { PARTNERS, formatPartnerPrice, partnerPlace, partnerWebsite, trackedUrl, type Partner } from "@/lib/partners";
import { cn } from "@/lib/utils";

/**
 * /partners: every business that agreed to be featured, as logo cards. A card opens the
 * partner in the one dialog (a bottom sheet on a phone): who they are, what they offer and
 * for how much, where, and a link out to their own site.
 *
 * Every card says "Business": once businesses and private sitters share the site, EU
 * consumer rules (Omnibus) want owners told which is which.
 */
export default function PartnersDirectory() {
  const { t } = useLanguage();
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const open = PARTNERS.find((p) => p.slug === openSlug) ?? null;

  return (
    <div className="min-h-[100dvh]">
      <PublicHeader />
      <main className="max-w-6xl mx-auto px-4 py-10 lg:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">{t("partners.eyebrow")}</p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight">
          {t("partners.heading")}
        </h1>
        <p className="mt-3 max-w-2xl text-ink-soft leading-relaxed">{t("partners.intro")}</p>

        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {PARTNERS.map((partner) => (
            <li key={partner.slug}>
              <PartnerCard partner={partner} onOpen={() => setOpenSlug(partner.slug)} />
            </li>
          ))}
        </ul>

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

function PartnerLogo({ partner, className }: { partner: Partner; className?: string }) {
  if (partner.logo) {
    return <img src={partner.logo} alt="" className={cn("object-contain", className)} />;
  }
  // No logo yet: the name's first letter, so the grid still reads as a wall of brands.
  return (
    <span aria-hidden="true" className={cn("inline-flex items-center justify-center rounded-full bg-brand-soft font-display font-semibold text-brand-strong", className)}>
      {partner.name.charAt(0)}
    </span>
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
      <div className="relative flex aspect-[4/3] items-center justify-center rounded-t-[var(--radius-card)] bg-surface-2 p-6">
        {partner.founding && (
          <span className="absolute left-2 top-2 whitespace-nowrap rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-brand-strong shadow-[var(--shadow-sm)]">
            {t("partners.founding")}
          </span>
        )}
        <PartnerLogo partner={partner} className="h-16 w-16 text-3xl sm:h-20 sm:w-20 sm:text-4xl" />
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
      icon={partner && <PartnerLogo partner={partner} className="h-14 w-14 text-2xl" />}
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
          </div>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.about")}</h3>
            <p className="mt-2 leading-relaxed text-ink">{partner.description[locale]}</p>
          </section>

          <section>
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
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.where")}</h3>
            <ul className="mt-2 flex flex-col gap-1.5 text-ink">
              {partner.locations.map((place) => (
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
