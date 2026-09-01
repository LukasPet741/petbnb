"use client";
import Link from "next/link";
import { Search, ArrowRight, Check, MapPin, ChevronDown, Dog, Home, Sun, Scissors, CalendarCheck, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { SECTION } from "@/lib/images";
import { type Profile } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import EmptyState from "@/components/EmptyState";
import SitterCard from "@/components/SitterCard";
import FeaturedSitterHero from "@/components/FeaturedSitterHero";

const SERVICES = [
  { key: "walking", icon: Dog },
  { key: "boarding", icon: Home },
  { key: "daycare", icon: Sun },
  { key: "grooming", icon: Scissors },
];

const HOW = [
  { step: "01", key: "find" },
  { step: "02", key: "request" },
  { step: "03", key: "confirm" },
];

const CITIES = ["Vilnius", "Kaunas", "Klaipėda", "Šiauliai", "Panevėžys"];

const TRUST_POINTS = [
  { key: "confirm" },
  { key: "bios" },
  { key: "fees" },
];

const BECOME_SITTER_PERKS = ["ownRate", "chooseServices", "ownHours", "free"] as const;

const FAQS = [
  { key: "howItWorks" },
  { key: "cost" },
  { key: "areas" },
  { key: "becomeSitter" },
  { key: "realCompany" },
];

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};

type SittersStatus = "loading" | "error" | "ready";

export default function LandingPage() {
  const { t } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [sitters, setSitters] = useState<Profile[]>([]);
  const [sittersStatus, setSittersStatus] = useState<SittersStatus>("loading");

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_sitter", true)
      .order("experience_years", { ascending: false }).limit(12)
      .then(
        ({ data, error }) => {
          if (error) { setSittersStatus("error"); return; }
          const pool = (data as Profile[]) ?? [];
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          setSitters(shuffled.slice(0, 6));
          setSittersStatus("ready");
        },
        () => setSittersStatus("error")
      );
  }, []);

  return (
    <div className="min-h-[100dvh] bg-canvas">
      <PublicHeader />

      <FeaturedSitterHero />

      {/* ── Cities strip ── */}
      <section className="border-y border-black/5 bg-surface">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <span className="text-sm text-ink-soft">{t("home.cities.availableIn")}</span>
          {CITIES.map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-sm font-medium text-ink"><MapPin className="w-3.5 h-3.5 text-brand" />{c}</span>
          ))}
        </div>
      </section>

      {/* ── Services ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="max-w-xl mb-12">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">{t("home.services.title")}</h2>
            <p className="text-ink-soft">{t("home.services.subtitle")}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map(({ icon: Icon, key }, i) => (
              <motion.div key={key} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.08 }}
                whileHover={{ y: -6 }} className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
                <div className="w-12 h-12 rounded-2xl bg-brand-soft flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-brand" />
                </div>
                <h3 className="font-semibold text-ink mb-1.5">{t(`home.services.items.${key}.title`)}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{t(`home.services.items.${key}.desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Meet sitters (real data) ── */}
      <section className="py-20 bg-surface border-y border-black/5">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="flex items-end justify-between mb-10 gap-4">
            <div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">{t("home.meetSitters.title")}</h2>
              <p className="text-ink-soft max-w-md">{t("home.meetSitters.subtitle")}</p>
            </div>
            <Link href="/sitters" className="hidden sm:flex items-center gap-1.5 text-sm font-medium text-brand hover:gap-2.5 transition-all whitespace-nowrap">
              {t("home.meetSitters.seeAll")} <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
          {sittersStatus === "loading" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-canvas rounded-2xl border border-black/5 p-5 h-[148px] animate-pulse" />
              ))}
            </div>
          ) : sittersStatus === "error" ? (
            <EmptyState icon={AlertCircle} title={t("home.meetSitters.errorTitle")} description={t("home.meetSitters.errorDesc")} tone="error" />
          ) : sitters.length === 0 ? (
            <EmptyState icon={Search} title={t("home.meetSitters.emptyTitle")} description={t("home.meetSitters.emptyDesc")} tone="encouraging" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {sitters.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.45, delay: (i % 3) * 0.08 }}>
                  <SitterCard sitter={s} basePath="/sitters" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">{t("home.how.title")}</h2>
            <p className="text-ink-soft">{t("home.how.subtitle")}</p>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW.map(({ step, key }, i) => (
              <motion.div key={step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: i * 0.12 }}
                className="text-center flex flex-col items-center">
                <div className="w-14 h-14 bg-brand-soft text-brand-strong rounded-2xl flex items-center justify-center font-display font-semibold text-lg mb-5">{step}</div>
                <h3 className="font-semibold text-ink text-lg mb-2">{t(`home.how.steps.${key}.title`)}</h3>
                <p className="text-ink-soft text-sm leading-relaxed max-w-xs">{t(`home.how.steps.${key}.desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust: no badges, just mechanics ── */}
      <section className="py-20 bg-surface border-y border-black/5">
        <div className="max-w-6xl mx-auto px-4">
          <div className="max-w-xl mb-10">
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">{t("home.trust.title")}</h2>
            <p className="text-ink-soft">{t("home.trust.subtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            {TRUST_POINTS.map(({ key }) => (
              <div key={key} className="flex flex-col gap-3">
                <span className="w-8 h-8 rounded-full bg-brand/15 flex items-center justify-center flex-shrink-0">
                  <Check className="w-4 h-4 text-brand" />
                </span>
                <h3 className="font-semibold text-ink">{t(`home.trust.points.${key}.title`)}</h3>
                <p className="text-sm text-ink-soft leading-relaxed">{t(`home.trust.points.${key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Become a sitter ── */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-ink rounded-2xl overflow-hidden grid lg:grid-cols-2">
            <div className="p-10 lg:p-14 flex flex-col justify-center">
              <h2 className="font-display text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">{t("home.becomeSitter.titleLine1")}<br />{t("home.becomeSitter.titleLine2")}</h2>
              <p className="text-white/60 mb-8 leading-relaxed">{t("home.becomeSitter.subtitle")}</p>
              <ul className="grid grid-cols-2 gap-3 mb-9">
                {BECOME_SITTER_PERKS.map((key) => (
                  <li key={key} className="flex items-center gap-2 text-white/80 text-sm">
                    <span className="w-5 h-5 rounded-full bg-brand/30 flex items-center justify-center flex-shrink-0"><Check className="w-3 h-3 text-white" /></span>{t(`home.becomeSitter.perks.${key}`)}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="inline-flex items-center gap-2 px-6 py-3 bg-brand text-white rounded-full font-medium hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] transition-all w-fit">
                {t("home.becomeSitter.cta")} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div className="relative min-h-[280px] lg:min-h-0">
              <img src={SECTION.becomeSitter} alt={t("home.becomeSitter.imageAlt")} className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20 bg-surface border-t border-black/5">
        <div className="max-w-2xl mx-auto px-4">
          <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-10 text-center tracking-tight">{t("home.faq.title")}</h2>
          <div className="space-y-3">
            {FAQS.map(({ key }, i) => (
              <div key={key} className="border border-black/5 rounded-xl overflow-hidden bg-canvas">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-brand-softer transition-colors">
                  <span className="font-medium text-ink text-sm pr-4">{t(`home.faq.items.${key}.q`)}</span>
                  <motion.div animate={{ rotate: openFaq === i ? 180 : 0 }} transition={{ duration: 0.25 }}>
                    <ChevronDown className="w-4 h-4 text-ink-soft flex-shrink-0" />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {openFaq === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeInOut" }} className="overflow-hidden">
                      <div className="px-5 pb-4 text-sm text-ink-soft leading-relaxed">{t(`home.faq.items.${key}.a`)}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-5">
              <CalendarCheck className="w-7 h-7 text-brand" />
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold text-ink mb-3 tracking-tight">{t("home.finalCta.title")}</h2>
            <p className="text-ink-soft mb-8">{t("home.finalCta.subtitle")}</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/signup" className="px-8 py-3 bg-brand text-white rounded-full font-medium hover:bg-brand-strong hover:shadow-[var(--shadow-sm)] transition-all flex items-center justify-center gap-2">
                {t("home.finalCta.createAccount")} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/login" className="px-8 py-3 bg-surface border-[1.5px] border-slate text-ink rounded-full font-medium hover:bg-slate-soft transition-colors">
                {t("common.signIn")}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
