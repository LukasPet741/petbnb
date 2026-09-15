"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { type ServiceType } from "@/lib/types";
import { SERVICE_PHOTO_FOCUS, servicePhoto } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Four photo tiles. At rest a tile shows the service's name and one line over its
 * photograph; its details slide up on hover or keyboard focus. Chosen 2026-09-15 over
 * the previous cards, which carried ~25 words each (variant B of four mocked).
 *
 * The details are always in the DOM, never rendered on hover: a phone has no hover, so
 * below `pointer-fine` the panel simply stays up and the resting caption is not drawn,
 * and the list scrolls sideways instead of stacking four tall tiles.
 *
 * Each tile is one link, stretched over the whole photo, named by its call to action
 * ("Find a groomer", not "Find a sitter": the wording names who does the job). The
 * visible CTA inside the panel is decoration for that link and hidden from assistive tech.
 */
const SERVICES: ServiceType[] = ["walking", "boarding", "daycare", "grooming"];

export default function ServiceCards() {
  const { t } = useLanguage();

  return (
    <section aria-label={t("home.services.railLabel")}>
      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand">
          {t("home.services.eyebrow")}
        </p>
        <h2 className="mt-1 font-display text-2xl sm:text-3xl font-semibold text-ink tracking-tight">
          {t("home.services.title")}
        </h2>

        <ul className="-mx-4 mt-6 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
          {SERVICES.map((key) => (
            <li
              key={key}
              className="group relative aspect-[3/4] w-[78%] shrink-0 snap-start overflow-hidden rounded-[18px] bg-surface-2 text-white sm:w-auto"
            >
              {/* The photograph a sitter's profile cover uses for this service, requested at
                  its own 3:2 and cropped to the tile by CSS: a server-side crop to a new
                  shape is what once cut the walking dogs' ears off. */}
              <img
                src={servicePhoto(key, 1200)}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                style={{ objectPosition: SERVICE_PHOTO_FOCUS[key] }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent from-45% to-ink/75" />

              {/* Resting caption, only where a pointer can hover to replace it. It repeats
                  the panel's name, so it is hidden from assistive tech. */}
              <div
                aria-hidden="true"
                className="absolute inset-x-4 bottom-4 hidden transition-[opacity,translate] duration-300 motion-reduce:transition-none pointer-fine:block pointer-fine:group-hover:translate-y-2 pointer-fine:group-hover:opacity-0 pointer-fine:group-focus-within:translate-y-2 pointer-fine:group-focus-within:opacity-0"
              >
                <p className="font-display text-2xl font-semibold leading-tight tracking-tight">
                  {t(`common.services.${key}`)}
                </p>
                <p className="mt-1 text-sm text-white/90">{t(`home.services.items.${key}.line`)}</p>
              </div>

              <div className="glass-panel absolute inset-x-2.5 bottom-2.5 rounded-[var(--radius-input)] border p-4 text-ink transition-[translate] duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none pointer-fine:translate-y-[calc(100%+12px)] pointer-fine:group-hover:translate-y-0 pointer-fine:group-focus-within:translate-y-0">
                <h3 className="mb-2 font-display text-xl font-semibold leading-tight tracking-tight">
                  {t(`common.services.${key}`)}
                </h3>
                <ul className="grid gap-1 text-sm text-ink-soft">
                  {(["point1", "point2", "point3"] as const).map((point) => (
                    <li key={point} className="flex gap-2">
                      <span aria-hidden="true" className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {t(`home.services.items.${key}.${point}`)}
                    </li>
                  ))}
                </ul>
                <span aria-hidden="true" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand">
                  {t(`home.services.items.${key}.cta`)}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </span>
              </div>

              <Link
                href={`/browse?service=${key}`}
                className="absolute inset-0 z-10 rounded-[18px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="sr-only">{t(`home.services.items.${key}.cta`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
