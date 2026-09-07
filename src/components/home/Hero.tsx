"use client";
import { MapPin, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HERO } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * One photograph, one card.
 *
 * This replaced a five-tile pinboard that read `sitter?.avatar_url ?? FILLERS[i]`.
 * Every seeded sitter has an avatar, so the curated photographs were unreachable and
 * the fold rendered five 128px randomuser.me thumbnails stretched across 460px. The
 * hero takes no sitter data at all now, which is why it cannot degrade again.
 *
 * The photograph is also the reason the search card can be glass: it is the one
 * surface on this page with something varied enough behind it to actually refract.
 */
export default function Hero() {
  const { t } = useLanguage();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [city, setCity] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    router.push(q ? `/sitters?city=${encodeURIComponent(q)}` : "/sitters");
  };

  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <img
          src={HERO.wide}
          alt={t("home.hero.photoAlt")}
          className="h-full w-full object-cover bg-surface-2"
        />
        {/* A light wash only. Anything heavier and the card would be refracting
            flat canvas instead of the photograph, which renders grey. */}
        <div aria-hidden className="absolute inset-0 bg-canvas/25" />
      </div>

      <div className="max-w-6xl mx-auto px-4 py-12 lg:py-20 min-h-[440px] lg:min-h-[560px] flex items-center">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } } }}
          className="glass-panel w-full max-w-xl rounded-[var(--radius-card)] border p-6 sm:p-9"
        >
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center bg-brand-soft text-brand-strong px-3.5 py-1.5 rounded-full text-sm font-medium mb-5"
          >
            {t("home.hero.eyebrow")}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display text-4xl md:text-5xl font-semibold text-ink leading-[1.08] tracking-tight mb-4"
          >
            {t("home.hero.titleLine1")}
            <br />
            {t("home.hero.titleLine2")}
          </motion.h1>
          {/* text-ink, not text-ink-soft: this sits on a translucent panel over an
              uncontrolled photograph, where the softer ink is only marginally above
              the 4.5:1 floor. */}
          <motion.p variants={fadeUp} className="text-lg text-ink leading-relaxed mb-7">
            {t("home.hero.subtitle")}
          </motion.p>

          <motion.form onSubmit={handleSearch} variants={fadeUp} className="flex flex-col sm:flex-row gap-3">
            {/* min-w-0 is load-bearing: an input's min-content width comes from its
                default size attribute (~180px), so flex-1 alone cannot shrink it
                beside a nowrap button with a Lithuanian label at 360px. */}
            <div className="flex-1 min-w-0 relative">
              <MapPin className="w-4 h-4 text-ink-soft/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder={t("home.hero.cityPlaceholder")}
                aria-label={t("home.hero.cityPlaceholder")}
                autoComplete="address-level2"
                inputMode="search"
                enterKeyHint="search"
                className="w-full h-12 pl-10 pr-4 rounded-[var(--radius-input)] border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand text-sm shadow-[var(--shadow-sm)]"
              />
            </div>
            <button
              type="submit"
              className="h-12 px-6 bg-brand text-white rounded-full font-medium text-sm hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] transition-all flex items-center gap-2 justify-center whitespace-nowrap"
            >
              {t("home.hero.searchButton")} <ArrowRight className="w-4 h-4" />
            </button>
          </motion.form>
        </motion.div>
      </div>
    </section>
  );
}
