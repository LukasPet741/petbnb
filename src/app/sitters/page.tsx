"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { MapPin, Search, AlertCircle, X } from "lucide-react";
import { motion } from "framer-motion";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import SitterCard from "@/components/SitterCard";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import { type Profile, type ServiceType } from "@/lib/types";
import { stagger, fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";

type Status = "loading" | "error" | "ready";

/** Only these four reach the filter. Anything else in the URL is ignored rather
 *  than silently returning nothing, since ?service=<junk> would otherwise look
 *  like "no sitters offer this" instead of "that is not a service". */
const SERVICE_KEYS: ServiceType[] = ["walking", "boarding", "daycare", "grooming"];

function SittersList() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cityParam = searchParams.get("city") ?? "";
  const rawService = searchParams.get("service") ?? "";
  const serviceParam = SERVICE_KEYS.includes(rawService as ServiceType)
    ? (rawService as ServiceType)
    : "";

  /** A filter chip clears only itself, so removing the city keeps the service. */
  const urlWithout = (drop: "city" | "service") => {
    const next = new URLSearchParams();
    if (drop !== "city" && cityParam) next.set("city", cityParam);
    if (drop !== "service" && serviceParam) next.set("service", serviceParam);
    const qs = next.toString();
    return qs ? `/sitters?${qs}` : "/sitters";
  };

  const [city, setCity] = useState(cityParam);
  const [sitters, setSitters] = useState<Profile[]>([]);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    setStatus("loading");
    supabase.from("profiles").select("*").eq("is_sitter", true).order("experience_years", { ascending: false })
      .then(
        ({ data, error }) => {
          if (error) { setStatus("error"); return; }
          setSitters((data as Profile[]) ?? []);
          setStatus("ready");
        },
        () => setStatus("error")
      );
  }, []);

  useEffect(() => setCity(cityParam), [cityParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = city.trim();
    const next = new URLSearchParams();
    if (q) next.set("city", q);
    // Searching a city narrows the current view rather than replacing it, so a
    // service arrived at from the landing page rail survives the search.
    if (serviceParam) next.set("service", serviceParam);
    const qs = next.toString();
    router.push(qs ? `/sitters?${qs}` : "/sitters");
  };

  const filtered = sitters.filter((s) => {
    const cityOk = !cityParam || (s.city ?? "").toLowerCase().includes(cityParam.toLowerCase());
    const serviceOk = !serviceParam || s.services?.[serviceParam] === true;
    return cityOk && serviceOk;
  });

  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        <div className="mb-8">
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink tracking-tight">{t("sitters.browse.title")}</h1>
          <p className="text-ink-soft mt-2 text-sm sm:text-base">{t("sitters.browse.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-3 mb-8 max-w-md">
          <div className="flex-1 min-w-0 relative">
            <MapPin className="w-4 h-4 text-ink-soft/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder={t("sitters.browse.searchPlaceholder")}
              aria-label={t("sitters.browse.searchAriaLabel")}
              autoComplete="address-level2"
              enterKeyHint="search"
              className="w-full h-12 pl-10 pr-4 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand text-sm shadow-[var(--shadow-sm)]"
            />
          </div>
          <button type="submit" className="h-12 px-6 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors flex items-center gap-2 justify-center shadow-[var(--shadow-sm)] whitespace-nowrap">
            <Search className="w-4 h-4" />{t("sitters.browse.searchButton")}
          </button>
        </form>

        {(cityParam || serviceParam) && (
          <div className="flex flex-wrap items-center gap-2 mb-6 -mt-4">
            {cityParam && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-soft text-brand-strong rounded-full text-xs font-medium">
                {cityParam}
                <Link href={urlWithout("city")} aria-label={t("sitters.browse.clearCityAriaLabel")} className="hover:text-brand"><X className="w-3 h-3" /></Link>
              </span>
            )}
            {serviceParam && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-soft text-brand-strong rounded-full text-xs font-medium">
                {t(`common.services.${serviceParam}`)}
                <Link href={urlWithout("service")} aria-label={t("sitters.browse.clearServiceAriaLabel")} className="hover:text-brand"><X className="w-3 h-3" /></Link>
              </span>
            )}
          </div>
        )}

        {status === "loading" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-surface rounded-2xl border border-black/5 h-56 animate-pulse" />)}
          </div>
        ) : status === "error" ? (
          <EmptyState
            icon={AlertCircle}
            title={t("sitters.browse.errorTitle")}
            description={t("sitters.browse.errorDescription")}
            action={<button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">{t("sitters.browse.tryAgain")}</button>}
            tone="error"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title={cityParam ? t("sitters.browse.emptyTitleWithCity", { city: cityParam }) : t("sitters.browse.emptyTitle")}
            description={cityParam ? t("sitters.browse.emptyDescriptionWithCity") : t("sitters.browse.emptyDescription")}
            action={cityParam ? <Link href="/sitters" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">{t("sitters.browse.seeAllSitters")}</Link> : undefined}
            tone="neutral"
          />
        ) : (
          <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" variants={stagger(0.06)} initial="hidden" animate="show">
            {filtered.map((sitter) => (
              <motion.div key={sitter.id} variants={fadeUp}>
                <SitterCard sitter={sitter} basePath="/sitters" />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

export default function SittersPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-canvas" />}>
      <SittersList />
    </Suspense>
  );
}
