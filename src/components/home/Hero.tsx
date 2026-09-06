"use client";
import { MapPin, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { HERO, SECTION } from "@/lib/images";
import { faceWall } from "@/lib/home";
import { type Profile } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { type HomeStatus } from "@/components/home/status";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

/**
 * The pinboard always has five tiles so the grid never leaves a hole. Real
 * sitter photos fill it first; these curated shots top it up when fewer than
 * five sitters have uploaded one. They are the last resort, not the default.
 */
const FILLERS = [HERO.main, HERO.bottomLeft, SECTION.care, HERO.topRight, SECTION.becomeSitter];

/** Grid placement for the five tiles. Three columns, three rows, nine cells,
 *  filled exactly: one 2x2 anchor, one 2x1 base, three singles. */
const TILES = [
  "col-span-2 row-span-2",
  "col-span-1 row-span-1",
  "col-span-1 row-span-1",
  "col-span-1 row-span-1",
  "col-span-2 row-span-1",
];

/** A pinboard reads as pinned, not as a grid. Two tiles sit a degree off. */
const TILTS = ["", "rotate-2", "-rotate-2", "", "-rotate-1"];

export interface HeroProps {
  sitters: Profile[];
  status: HomeStatus;
}

export default function Hero({ sitters, status }: HeroProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [city, setCity] = useState("");

  const faces = faceWall(sitters, 5);
  const tiles = TILES.map((span, i) => {
    const sitter = faces[i];
    return {
      span,
      tilt: TILTS[i],
      src: sitter?.avatar_url ?? FILLERS[i],
      alt: sitter?.full_name ?? t("home.hero.fallbackImageAlt"),
    };
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    router.push(q ? `/sitters?city=${encodeURIComponent(q)}` : "/sitters");
  };

  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center">
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: reduceMotion ? 0 : 0.1 } } }}
        >
          <motion.p
            variants={fadeUp}
            className="inline-flex items-center bg-brand-soft text-brand-strong px-3.5 py-1.5 rounded-full text-sm font-medium mb-6"
          >
            {t("home.hero.eyebrow")}
          </motion.p>
          <motion.h1
            variants={fadeUp}
            className="font-display text-4xl md:text-5xl lg:text-[3.25rem] font-semibold text-ink leading-[1.08] tracking-tight mb-5"
          >
            {t("home.hero.titleLine1")}
            <br />
            {t("home.hero.titleLine2")}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg text-ink-soft leading-relaxed mb-8 max-w-md">
            {t("home.hero.subtitle")}
          </motion.p>

          <motion.form onSubmit={handleSearch} variants={fadeUp} className="flex flex-col sm:flex-row gap-3 max-w-md">
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

        {/* Pinboard. Hidden below lg: at phone widths it would push the search
            form off the first screen, and the hero's job there is the search. */}
        <div className="hidden lg:grid grid-cols-3 grid-rows-3 gap-3 h-[460px]" aria-label={t("home.hero.wallAlt")}>
          {status === "loading"
            ? TILES.map((span, i) => (
                <div key={i} className={`${span} rounded-[var(--radius-card)] bg-surface-2 animate-pulse`} />
              ))
            : tiles.map((tile, i) => (
                <motion.div
                  key={`${tile.src}-${i}`}
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: reduceMotion ? 0 : i * 0.07, ease: [0.22, 1, 0.36, 1] }}
                  className={`${tile.span} ${tile.tilt} relative rounded-[var(--radius-card)] overflow-hidden ring-4 ring-canvas`}
                  style={{ boxShadow: "var(--shadow-md)" }}
                >
                  <img
                    src={tile.src}
                    alt={tile.alt}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover bg-surface-2"
                  />
                </motion.div>
              ))}
        </div>
      </div>
    </section>
  );
}
