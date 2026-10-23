"use client";
import { MapPin, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HERO } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";
import { buttonClasses } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * The deep-green band (Spruce & Moss, look Layered, 2026-10-24): the headline set straight
 * on the band, three hills of greens at its foot, the front one the page colour so the band
 * melts into the page, and the search card riding over that edge. The photograph stays on
 * wide screens, framed beside the text; a phone gets the band alone.
 *
 * The hero takes no sitter data, so it cannot degrade when the profiles query fails.
 */
export default function Hero() {
  const { t } = useLanguage();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [city, setCity] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    router.push(q ? `/browse?city=${encodeURIComponent(q)}` : "/browse");
  };

  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,var(--hero-from),var(--hero-to))] text-chrome-ink">
      <div aria-hidden className="pb-grain absolute inset-0 -z-10" />
      {/* Hills, back to front. Wide ellipses so their crowns read as a horizon, not as blobs. */}
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 sm:h-48">
        <div className="absolute -right-[20%] bottom-6 h-36 w-[80%] rounded-[50%] bg-[var(--hill-back)]" />
        <div className="absolute -left-[15%] bottom-0 h-32 w-[75%] rounded-[50%] bg-[var(--hill-mid)]" />
        <div className="absolute -left-[10%] -bottom-16 h-32 w-[120%] rounded-[50%] bg-canvas/95" />
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-12 pb-28 sm:pb-32 lg:pt-20 lg:pb-40 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-10 items-center">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } } }}
          className="w-full max-w-xl"
        >
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center bg-[var(--chrome-active)] text-chrome-ink px-3.5 py-1.5 rounded-full text-sm font-medium mb-5"
          >
            {t("home.hero.eyebrow")}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display text-4xl md:text-5xl font-semibold text-chrome-ink leading-[1.08] tracking-tight mb-4 text-balance"
          >
            {t("home.hero.titleLine1")}
            <br />
            {t("home.hero.titleLine2")}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg text-chrome-ink-soft leading-relaxed mb-8 max-w-lg">
            {t("home.hero.subtitle")}
          </motion.p>

          {/* The search card: the one light surface on the band, so the eye lands on it. */}
          <motion.form
            onSubmit={handleSearch}
            variants={fadeUp}
            className="flex flex-col sm:flex-row gap-3 bg-surface text-ink rounded-[var(--radius-card)] p-3 shadow-[var(--shadow-lg)]"
          >
            {/* min-w-0 is load-bearing: an input's min-content width comes from its
                default size attribute (~180px), so flex-1 alone cannot shrink it
                beside a nowrap button with a Lithuanian label at 360px. */}
            <div className="flex-1 min-w-0 relative">
              <MapPin className="w-4 h-4 text-ink-soft absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("home.hero.cityPlaceholder")}
                aria-label={t("home.hero.cityPlaceholder")}
                autoComplete="address-level2"
                inputMode="search"
                enterKeyHint="search"
                className="w-full h-12 pl-10 pr-4 rounded-[var(--radius-input)] border border-ink/10 bg-surface text-ink placeholder:text-ink-soft focus:outline-none focus:ring-2 focus:ring-brand text-sm"
              />
            </div>
            <button type="submit" className={cn(buttonClasses({ size: "lg" }), "h-12")}>
              {t("home.hero.searchButton")} <ArrowRight className="w-4 h-4" />
            </button>
          </motion.form>
        </motion.div>

        <div className="hidden lg:block relative">
          <img
            src={HERO.main}
            alt={t("home.hero.photoAlt")}
            className="aspect-[4/5] w-full max-w-md ml-auto object-cover rounded-[var(--radius-hero)] shadow-[var(--shadow-lg)] ring-1 ring-[var(--chrome-line)] bg-[var(--hill-mid)]"
          />
        </div>
      </div>
    </section>
  );
}
