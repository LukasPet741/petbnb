"use client";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SitterCard from "@/components/SitterCard";
import SitterMini from "@/components/SitterMini";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { SERVICE_LABELS, type ServiceType, type Profile } from "@/lib/types";
import { stagger, fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";

const SERVICE_KEYS = Object.keys(SERVICE_LABELS) as ServiceType[];
const RECENTLY_VIEWED_KEY = "petbnb-recently-viewed";

export default function BrowsePage() {
  const { t } = useLanguage();
  const SERVICES = SERVICE_KEYS.map((k) => [k, t(`common.services.${k}`)] as [ServiceType, string]);
  const [sitters, setSitters] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("All cities");
  const [service, setService] = useState<ServiceType | "">("");
  const [maxRate, setMaxRate] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [cities, setCities] = useState<string[]>(["All cities"]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    supabase.from("profiles").select("*").eq("is_sitter", true).then(({ data }) => {
      const rows = (data ?? []) as Profile[];
      setSitters(rows);
      const unique = ["All cities", ...Array.from(new Set(rows.map((s) => s.city).filter(Boolean)))];
      setCities(unique as string[]);
      setLoading(false);
    });
    try {
      const stored = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      setRecentIds(Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []);
    } catch {
      // localStorage unavailable (e.g. private browsing) — recently viewed just won't show.
    }
  }, []);

  const recentSitters = recentIds
    .map((rid) => sitters.find((s) => s.id === rid))
    .filter((s): s is Profile => Boolean(s));

  const filtered = sitters.filter((s) => {
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (city !== "All cities" && s.city !== city) return false;
    if (service && !s.services?.[service]) return false;
    if (s.rate_per_hour && s.rate_per_hour > maxRate) return false;
    return true;
  });

  const activeFilters = [
    city !== "All cities" && city,
    service && t(`common.services.${service}`),
    maxRate < 50 && t("appPages.browse.upToRateChip", { rate: maxRate }),
  ].filter(Boolean) as string[];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader title={t("appPages.browse.title")} subtitle={t("appPages.browse.subtitle")} />

      {recentSitters.length > 0 && (
        <motion.div className="mb-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h2 className="text-xs font-medium text-ink-soft uppercase tracking-wide mb-2.5">{t("appPages.browse.recentlyViewedHeading")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {recentSitters.map((sitter) => (
              <div key={sitter.id} className="w-64 flex-shrink-0">
                <SitterMini sitter={sitter} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div className="flex gap-3 mb-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-ink-soft/60 absolute left-4 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder={t("appPages.browse.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} inputMode="search" enterKeyHint="search"
            className="w-full h-12 pl-11 pr-4 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm shadow-[var(--shadow-sm)]" />
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => setShowFilters(!showFilters)}
          className={`h-12 px-5 rounded-xl border text-sm font-medium flex items-center gap-2 transition-colors ${showFilters || activeFilters.length > 0 ? "bg-brand text-white border-brand" : "bg-surface text-ink border-black/10 hover:bg-brand-softer"}`}>
          <SlidersHorizontal className="w-4 h-4" />{t("appPages.browse.filtersButton")}
          {activeFilters.length > 0 && <span className="w-5 h-5 bg-white/20 rounded-full text-xs flex items-center justify-center">{activeFilters.length}</span>}
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden mb-4">
            <div className="bg-surface rounded-2xl border border-black/5 p-5 sm:p-6 shadow-[var(--shadow-sm)]">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div>
                  <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">{t("appPages.browse.cityLabel")}</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    {cities.map((c) => <option key={c} value={c}>{c === "All cities" ? t("appPages.browse.allCitiesOption") : c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">{t("appPages.browse.serviceLabel")}</label>
                  <select value={service} onChange={(e) => setService(e.target.value as ServiceType | "")} className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                    <option value="">{t("appPages.browse.allServicesOption")}</option>
                    {SERVICES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-soft uppercase tracking-wide mb-2">{t("appPages.browse.maxRateLabel", { rate: maxRate })}</label>
                  <input type="range" min={10} max={50} value={maxRate} onChange={(e) => setMaxRate(Number(e.target.value))} className="w-full accent-brand mt-3.5" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeFilters.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="flex flex-wrap gap-2 mb-5">
            {activeFilters.map((f) => (
              <motion.span key={f} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-soft text-brand-strong rounded-full text-xs font-medium">
                {f}
                <button onClick={() => { if (f === city) setCity("All cities"); if (service && f === t(`common.services.${service}`)) setService(""); if (f === t("appPages.browse.upToRateChip", { rate: maxRate })) setMaxRate(50); }} className="hover:text-brand">
                  <X className="w-3 h-3" />
                </button>
              </motion.span>
            ))}
            <button onClick={() => { setCity("All cities"); setService(""); setMaxRate(50); }} className="text-xs text-ink-soft hover:text-ink px-2 self-center">{t("appPages.browse.clearAllButton")}</button>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-sm text-ink-soft mb-6">{loading ? t("appPages.browse.loadingText") : filtered.length === 1 ? t("appPages.browse.resultsCountSingular", { count: filtered.length }) : t("appPages.browse.resultsCountPlural", { count: filtered.length })}</p>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-black/5 h-56 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-surface rounded-2xl border border-black/5 p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-4"><Search className="w-7 h-7 text-brand" /></div>
          <p className="text-ink font-medium">{t("appPages.browse.emptyTitle")}</p>
          <p className="text-ink-soft text-sm mt-1">{t("appPages.browse.emptyDescription")}</p>
        </motion.div>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" variants={stagger(0.07)} initial="hidden" animate="show">
          {filtered.map((sitter) => (
            <motion.div key={sitter.id} variants={fadeUp}>
              <SitterCard sitter={sitter} showFavorite />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
