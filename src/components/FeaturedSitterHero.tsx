"use client";
import { MapPin, ArrowRight, Quote } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, type Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { HERO } from "@/lib/images";
import { type Profile } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import Avatar from "@/components/Avatar";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

type FeaturedStatus = "loading" | "error" | "ready";

const MAX_QUOTE_LENGTH = 220;

function excerpt(text: string, max = MAX_QUOTE_LENGTH) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

export default function FeaturedSitterHero() {
  const { t } = useLanguage();
  const router = useRouter();
  const [status, setStatus] = useState<FeaturedStatus>("loading");
  const [sitter, setSitter] = useState<Profile | null>(null);
  const [heroCity, setHeroCity] = useState("");

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_sitter", true)
      .order("experience_years", { ascending: false }).limit(12)
      .then(
        ({ data, error }) => {
          if (error) { setStatus("error"); return; }
          const eligible = ((data as Profile[]) ?? []).filter((p) => (p.about_me ?? "").trim().length > 0);
          const withPhoto = eligible.find((p) => p.avatar_url);
          setSitter(withPhoto ?? eligible[0] ?? null);
          setStatus("ready");
        },
        () => setStatus("error")
      );
  }, []);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = heroCity.trim();
    router.push(q ? `/sitters?city=${encodeURIComponent(q)}` : "/sitters");
  };

  const searchForm = (
    <motion.form onSubmit={handleHeroSearch} variants={fadeUp} className="flex flex-col sm:flex-row gap-3 max-w-md">
      <div className="flex-1 relative">
        <MapPin className="w-4 h-4 text-ink-soft/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={heroCity}
          onChange={(e) => setHeroCity(e.target.value)}
          placeholder={t("home.hero.cityPlaceholder")}
          aria-label={t("home.hero.cityPlaceholder")}
          className="w-full h-12 pl-10 pr-4 rounded-[var(--radius-input)] border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand text-sm shadow-[var(--shadow-sm)]"
        />
      </div>
      <button type="submit" className="h-12 px-6 bg-brand text-white rounded-full font-medium text-sm hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] transition-all flex items-center gap-2 justify-center whitespace-nowrap">
        {t("home.hero.searchButton")} <ArrowRight className="w-4 h-4" />
      </button>
    </motion.form>
  );

  // Loading skeleton
  if (status === "loading") {
    return (
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 lg:pt-24 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-pulse">
            <div className="h-7 w-48 bg-surface-2 rounded-full mb-6" />
            <div className="h-14 w-full bg-surface-2 rounded-2xl mb-3" />
            <div className="h-14 w-4/5 bg-surface-2 rounded-2xl mb-8" />
            <div className="h-5 w-40 bg-surface-2 rounded-full mb-8" />
            <div className="h-12 w-full max-w-md bg-surface-2 rounded-[var(--radius-input)]" />
          </div>
          <div className="hidden lg:block h-[480px] bg-surface-2 rounded-[var(--radius-card)]" />
        </div>
      </section>
    );
  }

  // Real sitter spotlight
  if (status === "ready" && sitter) {
    const years = sitter.experience_years;
    return (
      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 lg:pt-24 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-brand-soft text-brand-strong px-3.5 py-1.5 rounded-full text-sm font-medium mb-6">
              <span className="w-2 h-2 bg-brand rounded-full" />
              {t("home.hero.readyEyebrow")}
            </motion.div>
            <motion.h1 variants={fadeUp} className="relative font-display text-3xl md:text-[2.75rem] font-semibold text-ink leading-[1.15] tracking-tight mb-6">
              <Quote className="w-8 h-8 text-brand/25 absolute -left-1 -top-4 -z-10" aria-hidden="true" />
              “{excerpt(sitter.about_me as string)}”
            </motion.h1>
            <motion.div variants={fadeUp} className="flex items-center gap-3 mb-8">
              <Avatar name={sitter.full_name} url={sitter.avatar_url} size="lg" className="lg:hidden" />
              <cite className="not-italic">
                <div className="font-[family-name:var(--font-script)] text-2xl text-brand-strong leading-none">{sitter.full_name}</div>
                <div className="flex items-center gap-1.5 text-sm text-ink-soft mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {sitter.city} {t("common.sitterWord")}
                  {years != null ? ` · ${t(years === 1 ? "common.experienceSuffix" : "common.experienceSuffixPlural", { years })}` : ""}
                </div>
              </cite>
            </motion.div>
            {searchForm}
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }}
            className="relative hidden lg:block h-[480px]">
            {sitter.avatar_url ? (
              <div className="absolute inset-0 rounded-[var(--radius-card)] overflow-hidden" style={{ boxShadow: "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)" }}>
                <img src={sitter.avatar_url} alt={sitter.full_name} className="w-full h-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent h-32" />
              </div>
            ) : (
              <div className="absolute inset-0 rounded-[var(--radius-card)] bg-brand-softer flex items-center justify-center" style={{ boxShadow: "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)" }}>
                <Avatar name={sitter.full_name} url={null} size="xl" className="w-40 h-40 text-5xl" />
              </div>
            )}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-8 -bottom-8 w-40 h-40 rounded-[var(--radius-card)] overflow-hidden ring-4 ring-canvas"
              style={{ boxShadow: "var(--shadow-lg)" }}
            >
              <img src={HERO.bottomLeft} alt={t("home.hero.walkImageAlt")} className="w-full h-full object-cover" />
            </motion.div>
          </motion.div>
        </div>
      </section>
    );
  }

  // Honest fallback: no eligible sitter to spotlight yet, or the query failed
  return (
    <section className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-20 lg:pt-24 grid lg:grid-cols-2 gap-12 items-center">
        <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.12 } } }}>
          <motion.div variants={fadeUp} className="inline-flex items-center gap-2 bg-brand-soft text-brand-strong px-3.5 py-1.5 rounded-full text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-brand rounded-full" />
            {t("home.hero.fallbackEyebrow")}
          </motion.div>
          <motion.h1 variants={fadeUp} className="font-display text-5xl md:text-6xl font-semibold text-ink leading-[1.05] tracking-tight mb-6">
            {t("home.hero.fallbackTitleLine1")}<br />{t("home.hero.fallbackTitleLine2")}
          </motion.h1>
          <motion.p variants={fadeUp} className="text-lg text-ink-soft leading-relaxed mb-8 max-w-md">
            {t("home.hero.fallbackSubtitle")}
          </motion.p>
          {searchForm}
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, ease: "easeOut" }}
          className="relative hidden lg:block h-[480px]">
          <div className="absolute inset-0 rounded-[var(--radius-card)] overflow-hidden" style={{ boxShadow: "var(--shadow-lg), inset 0 1px 0 rgb(255 255 255 / 0.5), inset 0 0 0 1px rgb(31 92 71 / 0.08)" }}>
            <img src={HERO.main} alt={t("home.hero.fallbackImageAlt")} className="w-full h-full object-cover" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
