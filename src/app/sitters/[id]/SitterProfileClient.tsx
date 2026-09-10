"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Clock, ArrowLeft, ArrowRight, Check, AlertCircle, Search } from "lucide-react";
import { motion } from "framer-motion";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { supabase } from "@/lib/supabase";
import { type ServiceType, type Profile } from "@/lib/types";
import RatingSummary from "@/components/RatingSummary";
import ReviewList from "@/components/ReviewList";
import { useSitterRatings } from "@/hooks/useSitterRatings";
import { useLanguage } from "@/context/LanguageContext";

type Status = "loading" | "error" | "not-found" | "ready";

export default function SitterProfileClient() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const [sitter, setSitter] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    setStatus("loading");
    supabase.from("profiles").select("*").eq("id", id).eq("is_sitter", true).single()
      .then(
        ({ data, error }) => {
          if (!error && data) { setSitter(data as Profile); setStatus("ready"); return; }
          // A malformed id (e.g. a bad/guessed URL) fails Postgres's uuid parsing (22P02):
          // that's a not-found, not a transient failure a retry button could fix.
          setStatus(error && error.code !== "22P02" ? "error" : "not-found");
        },
        () => setStatus("error")
      );
  }, [id]);

  return (
    <div className="min-h-[100dvh] bg-canvas flex flex-col">
      <PublicHeader />

      <main className="flex-1 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full">
        <Link href="/sitters" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> {t("sitters.profile.backToSitters")}
        </Link>

        {status === "loading" && (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {status === "error" && (
          <EmptyState icon={AlertCircle} title={t("sitters.profile.errorTitle")} description={t("sitters.profile.errorDescription")}
            action={<button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">{t("sitters.profile.tryAgain")}</button>}
            tone="error" />
        )}

        {status === "not-found" && (
          <EmptyState icon={Search} title={t("sitters.profile.notFoundTitle")} description={t("sitters.profile.notFoundDescription")}
            action={<Link href="/sitters" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">{t("sitters.profile.backToSitters")}</Link>}
            tone="neutral" />
        )}

        {status === "ready" && sitter && (
          <SitterDetail sitter={sitter} />
        )}
      </main>

      <PublicFooter />
    </div>
  );
}

function SitterDetail({ sitter }: { sitter: Profile }) {
  const { t } = useLanguage();
  const rating = useSitterRatings([sitter.id]).get(sitter.id) ?? null;
  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][]).filter(([, v]) => v).map(([k]) => ({ key: k, label: t("common.services." + k) }));
  const firstName = sitter.full_name?.split(" ")[0] ?? t("sitters.profile.fallbackName");
  // freeToJoinNote uses {name} as the grammatical subject, which requires the nominative
  // case fallback (distinct from the accusative fallbackName used in aboutHeading/bookCta).
  const firstNameNominative = sitter.full_name?.split(" ")[0] ?? t("sitters.profile.fallbackNameNominative");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
          <div className="flex items-start gap-5">
            <Avatar name={sitter.full_name ?? t("sitters.profile.fallbackName")} url={sitter.avatar_url} size="xl" />
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">{sitter.full_name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-ink-soft">
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{sitter.city}</span>
                {sitter.experience_years != null && (
                  <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{t(sitter.experience_years !== 1 ? "sitters.profile.experiencePlural" : "sitters.profile.experienceSingular", { years: sitter.experience_years })}</span>
                )}
              </div>
              <RatingSummary average={rating?.average ?? null} count={rating?.count ?? 0} size="md" emptyState="label" className="mt-2" />
              <div className="flex flex-wrap gap-2 mt-4">{activeServices.map(({ key, label }) => <Badge key={key} variant="brand">{label}</Badge>)}</div>
            </div>
          </div>
          {sitter.about_me && (
            <div className="mt-6 pt-6 border-t border-black/5">
              <h2 className="font-semibold text-ink mb-2">{t("sitters.profile.aboutHeading", { name: firstName })}</h2>
              <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{sitter.about_me}</p>
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
          className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
          <h2 className="font-semibold text-ink mb-4">{t("sitters.profile.servicesOfferedHeading")}</h2>
          {activeServices.length === 0 ? (
            <p className="text-sm text-ink-soft">{t("sitters.profile.noServicesListed")}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {activeServices.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3.5 bg-canvas rounded-xl border border-black/5">
                  <span className="flex items-center gap-2.5 text-sm font-medium text-ink">
                    <span className="w-6 h-6 rounded-lg bg-brand-soft flex items-center justify-center"><Check className="w-3.5 h-3.5 text-brand" /></span>
                    {label}
                  </span>
                  {sitter.rate_per_hour != null && <span className="text-sm text-ink-soft">€{sitter.rate_per_hour}{t("sitters.profile.ratePerHourShort")}</span>}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
          className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
          <ReviewList sitterId={sitter.id} />
        </motion.div>
      </div>

      <div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
          className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5 sticky top-24">
          <div className="text-center pb-4 border-b border-black/5">
            <div className="font-display text-3xl font-semibold text-ink">€{sitter.rate_per_hour ?? "-"}</div>
            <div className="text-sm text-ink-soft mt-0.5">{t("sitters.profile.perHour")}</div>
          </div>
          <div className="pt-4 space-y-3">
            <Link href="/signup" className="flex items-center justify-center gap-2 w-full min-h-11 px-4 py-2.5 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors">
              <span className="text-center">{t("sitters.profile.bookCta", { name: firstName })}</span> <ArrowRight className="w-4 h-4 flex-shrink-0" />
            </Link>
            <p className="text-xs text-ink-soft/80 text-center">{t("sitters.profile.freeToJoinNote", { name: firstNameNominative })}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
