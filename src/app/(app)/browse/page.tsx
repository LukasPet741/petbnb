"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Dog, House, Scissors, Search, Sun, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import SitterCard from "@/components/SitterCard";
import SitterMini from "@/components/SitterMini";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { type ServiceType, type Profile, PUBLIC_PROFILE_COLUMNS } from "@/lib/types";
import { stagger, fadeUp } from "@/lib/motion";
import { useSitterRatings } from "@/hooks/useSitterRatings";
import { useLanguage } from "@/context/LanguageContext";
import { pluralForm } from "@/lib/i18n/plural";
import { PRICE_CAPS, SORT_KEYS, countByService, filtersFromSearch, sameCity, sortSitters, type SortKey } from "@/lib/browse-filters";
import { comparablePrice } from "@/lib/pricing";
import { cn, normaliseCity } from "@/lib/utils";
import { rememberCovers, spreadCoverPhotos } from "@/lib/images";

const SERVICES: { key: ServiceType; icon: LucideIcon }[] = [
  { key: "walking", icon: Dog },
  { key: "boarding", icon: House },
  { key: "daycare", icon: Sun },
  { key: "grooming", icon: Scissors },
];
const ALL_CITIES = "All cities";
const RECENTLY_VIEWED_KEY = "petbnb-recently-viewed";

const pillClass = (on: boolean) =>
  cn(
    "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    on ? "border-ink bg-ink text-white" : "border-ink/10 bg-white/75 text-ink hover:bg-white",
  );

/** A native select dressed as a chip: keyboard, screen readers and phone pickers come for free. */
function ChipSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex shrink-0">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-full border border-ink/10 bg-white/80 pl-4 pr-9 text-sm font-medium text-ink hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
    </span>
  );
}

/**
 * The sitter directory, variant A (2026-09-15): one glass filter bar — name search, city,
 * price cap and sort as chips, services as pills that say how many sitters each would show —
 * above a grid of photo-cover cards. Research behind it: keep the few filters people use in a
 * horizontal bar, make the state visible on the controls themselves, lead results with images.
 */
export default function BrowsePage() {
  const { t, locale } = useLanguage();
  const [sitters, setSitters] = useState<Profile[]>([]);
  // One query for the whole page rather than one per card. Keyed on the loaded
  // set, not the filtered one, so changing a filter never re-queries.
  const ratings = useSitterRatings(sitters.map((s) => s.id));
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState(ALL_CITIES);
  const [service, setService] = useState<ServiceType | "">("");
  const [maxRate, setMaxRate] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("experience");
  const [cities, setCities] = useState<string[]>([ALL_CITIES]);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    // The landing page's links arrive here filtered (?service=, ?city=) since the public
    // directory went behind login.
    const fromLink = filtersFromSearch(window.location.search);
    if (fromLink.service) setService(fromLink.service);
    if (fromLink.city) setCity(fromLink.city);

    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("is_sitter", true).then(({ data }) => {
      const rows = (data ?? []) as Profile[];
      setSitters(rows);
      // Display form, so production's "kaunas" and "Kaunas" are one option, not two.
      const names = rows.map((s) => (s.city ? normaliseCity(s.city) : null)).filter((c): c is string => Boolean(c));
      setCities([ALL_CITIES, ...Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, "lt"))]);
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

  // Everything but the service, so each pill can say what pressing it would leave.
  const beforeService = sitters.filter((s) => {
    if (search && !s.full_name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (city !== ALL_CITIES && !sameCity(s.city, city)) return false;
    if (maxRate !== null) {
      const price = comparablePrice(s, service);
      if (price !== null && price > maxRate) return false;
    }
    return true;
  });
  const serviceCounts = countByService(beforeService);
  const filtered = sortSitters(service ? beforeService.filter((s) => s.services?.[service]) : beforeService, sort, service);
  // Photos are picked for the grid as it is laid out, so two neighbouring cards never share one,
  // and remembered so a card's profile opens on the same picture. Keyed on the order, not the array.
  const coverOrder = filtered.map((s) => s.id).join(",");
  const covers = useMemo(() => spreadCoverPhotos(filtered), [coverOrder]);
  useEffect(() => rememberCovers(covers), [covers]);

  const anyFilter = Boolean(search) || city !== ALL_CITIES || Boolean(service) || maxRate !== null;
  const clearAll = () => { setSearch(""); setCity(ALL_CITIES); setService(""); setMaxRate(null); };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader title={t("appPages.browse.title")} subtitle={t("appPages.browse.subtitle")} />

      {recentSitters.length > 0 && (
        <motion.div className="mb-6" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-[0.08em] mb-2.5">{t("appPages.browse.recentlyViewedHeading")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {recentSitters.map((sitter) => (
              <div key={sitter.id} className="w-64 flex-shrink-0">
                <SitterMini sitter={sitter} />
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        className="glass-card rounded-[var(--radius-card)] border p-3 sm:p-4 mb-6 space-y-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <div className="flex flex-wrap gap-2.5">
          <div className="relative basis-full sm:basis-auto sm:min-w-[14rem] sm:flex-1">
            <Search aria-hidden="true" className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft/70" />
            <input
              type="search"
              aria-label={t("appPages.browse.searchPlaceholder")}
              placeholder={t("appPages.browse.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              enterKeyHint="search"
              className="h-11 w-full rounded-full border border-ink/10 bg-white pl-11 pr-4 text-ink placeholder:text-ink-soft/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            />
          </div>
          {/* One sideways-scrolling row on a phone rather than three stacked rows of chips. */}
          <div className="-mx-3 flex gap-2.5 overflow-x-auto px-3 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
          <ChipSelect label={t("appPages.browse.cityLabel")} value={city} onChange={setCity}>
            {cities.map((c) => <option key={c} value={c}>{c === ALL_CITIES ? t("appPages.browse.allCitiesOption") : c}</option>)}
          </ChipSelect>
          <ChipSelect label={t("appPages.browse.priceLabel")} value={maxRate === null ? "" : String(maxRate)} onChange={(v) => setMaxRate(v ? Number(v) : null)}>
            <option value="">{t("appPages.browse.priceAny")}</option>
            {PRICE_CAPS.map((cap) => <option key={cap} value={cap}>{t("appPages.browse.upToRateChip", { rate: cap })}</option>)}
          </ChipSelect>
          <ChipSelect label={t("appPages.browse.sortLabel")} value={sort} onChange={(v) => setSort(v as SortKey)}>
            {SORT_KEYS.map((key) => <option key={key} value={key}>{t(`appPages.browse.sort.${key}`)}</option>)}
          </ChipSelect>
          </div>
        </div>

        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
          <button type="button" aria-pressed={!service} onClick={() => setService("")} className={pillClass(!service)}>
            {t("appPages.browse.allServicesOption")}
          </button>
          {SERVICES.map(({ key, icon: Icon }) => (
            <button key={key} type="button" aria-pressed={service === key} onClick={() => setService(service === key ? "" : key)} className={pillClass(service === key)}>
              <Icon aria-hidden="true" className="h-4 w-4" />
              {t(`common.services.${key}`)}
              <span className={cn("tabular-nums text-xs", service === key ? "text-white/70" : "text-ink-soft")}>{serviceCounts[key]}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft" aria-live="polite">
          {loading ? t("appPages.browse.loadingText") : t(`appPages.browse.resultsCount.${pluralForm(locale, filtered.length)}`, { count: filtered.length })}
        </p>
        {anyFilter && (
          <button type="button" onClick={clearAll} className="min-h-[44px] rounded-lg px-2 text-sm font-medium text-brand hover:text-brand-strong transition-colors focus-visible:outline-2 focus-visible:outline-brand">
            {t("appPages.browse.clearAllButton")}
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-white/50 rounded-2xl border border-white/60 h-80 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card rounded-2xl border p-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-soft flex items-center justify-center mx-auto mb-4"><Search className="w-7 h-7 text-brand" /></div>
          <p className="text-ink font-medium">{t("appPages.browse.emptyTitle")}</p>
          <p className="text-ink-soft text-sm mt-1">{t("appPages.browse.emptyDescription")}</p>
        </motion.div>
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" variants={stagger(0.05)} initial="hidden" animate="show">
          {filtered.map((sitter) => (
            <motion.div key={sitter.id} variants={fadeUp}>
              <SitterCard sitter={sitter} showFavorite rating={ratings.get(sitter.id) ?? null} coverPhotoId={covers.get(sitter.id)} priceService={service} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
