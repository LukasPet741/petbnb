"use client";
import Link from "next/link";
import { ArrowRight, MapPin, Search, AlertCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { revealOnScroll } from "@/lib/motion";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import { excerpt, pickVoices } from "@/lib/home";
import { type Profile } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { type HomeStatus } from "@/components/home/status";

const MAX_VOICES = 6;

/** A masonry column flow rather than a card grid: the bios are different
 *  lengths, and forcing them into equal cells is what made the old section
 *  read as a directory listing instead of as people talking. */
export default function SitterVoices({ sitters, status }: { sitters: Profile[]; status: HomeStatus }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const voices = pickVoices(sitters, MAX_VOICES);

  return (
    <section className="py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div className="max-w-lg">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">
              {t("home.voices.title")}
            </h2>
            <p className="text-ink-soft">{t("home.voices.subtitle")}</p>
          </div>
          <Link
            href="/browse"
            className="min-h-[44px] inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:gap-2.5 transition-all whitespace-nowrap"
          >
            {t("home.voices.seeAll")} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {status === "loading" ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-5">
            {Array.from({ length: MAX_VOICES }).map((_, i) => (
              <div
                key={i}
                className="mb-5 break-inside-avoid h-40 rounded-[var(--radius-card)] bg-surface/50 animate-pulse"
              />
            ))}
          </div>
        ) : status === "error" ? (
          <EmptyState
            icon={AlertCircle}
            title={t("home.voices.errorTitle")}
            description={t("home.voices.errorDesc")}
            tone="error"
          />
        ) : voices.length === 0 ? (
          <EmptyState
            icon={Search}
            title={t("home.voices.emptyTitle")}
            description={t("home.voices.emptyDesc")}
            tone="encouraging"
          />
        ) : (
          // A swipeable row on a phone (six stacked quotes were ~1,000px of scroll); the masonry from md up.
          <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:block md:columns-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:columns-3">
            {voices.map((sitter, i) => {
              const name = sitter.full_name ?? t("appShell.sitterFallback");
              // The first voice carries more weight typographically. That is the
              // whole point of a masonry here: one loud quote, the rest quieter.
              const loud = i === 0;

              return (
                <motion.figure
                  key={sitter.id}
                  {...revealOnScroll(i % 3, reduceMotion, 0.07)}
                  className="w-[85%] flex-shrink-0 snap-start break-inside-avoid md:mb-5 md:w-auto"
                >
                  <Link
                    href={`/browse/${sitter.id}`}
                    aria-label={t("home.voices.openProfile", { name })}
                    className="group block h-full rounded-[var(--radius-card)] glass-card border p-6 transition-shadow hover:shadow-[var(--shadow-md)]"
                  >
                    <blockquote
                      className={`text-ink line-clamp-3 ${
                        loud
                          ? "font-display text-xl md:text-2xl leading-snug tracking-tight"
                          : "text-[15px] leading-relaxed"
                      }`}
                    >
                      {`“${excerpt(sitter.about_me ?? "", 200)}”`}
                    </blockquote>
                    <figcaption className="mt-5 flex items-center gap-3">
                      <Avatar name={name} url={sitter.avatar_url} size="md" />
                      <div className="min-w-0">
                        <div className="font-[family-name:var(--font-script)] text-xl leading-tight text-brand-strong truncate pr-1.5">
                          {name}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-soft">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{sitter.city}</span>
                        </div>
                      </div>
                    </figcaption>
                  </Link>
                </motion.figure>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
