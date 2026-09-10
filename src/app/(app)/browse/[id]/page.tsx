"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MapPin, Clock, ArrowLeft, Calendar, Check } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { type ServiceType, type Profile, PUBLIC_PROFILE_COLUMNS } from "@/lib/types";
import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import FavoriteButton from "@/components/FavoriteButton";
import RatingSummary from "@/components/RatingSummary";
import ReviewList from "@/components/ReviewList";
import { useSitterRatings } from "@/hooks/useSitterRatings";
import { useLanguage } from "@/context/LanguageContext";

const RECENTLY_VIEWED_KEY = "petbnb-recently-viewed";
const RECENTLY_VIEWED_MAX = 6;

function rememberRecentlyViewed(sitterId: string) {
  try {
    const stored = window.localStorage.getItem(RECENTLY_VIEWED_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    const ids = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    const next = [sitterId, ...ids.filter((existingId) => existingId !== sitterId)].slice(0, RECENTLY_VIEWED_MAX);
    window.localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (e.g. private browsing) — recently viewed just won't persist.
  }
}

export default function SitterProfilePage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const [sitter, setSitter] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", id).single().then(({ data }) => {
      setSitter(data as Profile);
      setLoading(false);
      if (data) rememberRecentlyViewed((data as Profile).id);
    });
  }, [id]);

  // Both of these sit above the early returns below: a hook cannot live behind a
  // branch, and the empty id list means an unloaded sitter issues no query.
  const ratings = useSitterRatings(sitter ? [sitter.id] : []);
  const rating = ratings.get(sitter?.id ?? "") ?? null;

  if (loading) return <div className="flex items-center justify-center py-24"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>;
  if (!sitter) return <div className="max-w-4xl mx-auto px-4 py-16 text-center"><p className="text-ink-soft">{t("appPages.browse.sitterNotFound")}</p><Link href="/browse" className="text-brand hover:underline mt-2 inline-block">{t("appPages.browse.backToBrowse")}</Link></div>;

  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][]).filter(([, v]) => v).map(([k]) => ({ key: k, label: t(`common.services.${k}`) }));
  const firstName = sitter.full_name?.split(" ")[0] ?? t("appPages.browse.fallbackFirstName");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.browse.backToBrowse")}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
            <div className="flex items-start gap-5">
              <Avatar name={sitter.full_name ?? t("appPages.browse.fallbackSitterName")} url={sitter.avatar_url} size="xl" />
              <div className="flex-1 min-w-0">
                <h1 className="font-display text-2xl font-semibold text-ink tracking-tight">{sitter.full_name}</h1>
                <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{sitter.city}</span>
                  {sitter.experience_years != null && (
                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" />{sitter.experience_years !== 1 ? t("appPages.browse.experiencePlural", { years: sitter.experience_years }) : t("appPages.browse.experienceSingular", { years: sitter.experience_years })}</span>
                  )}
                </div>
                <RatingSummary average={rating?.average ?? null} count={rating?.count ?? 0} size="md" emptyState="label" className="mt-2" />
                <div className="flex flex-wrap gap-2 mt-4">{activeServices.map(({ key, label }) => <Badge key={key} variant="brand">{label}</Badge>)}</div>
              </div>
              <FavoriteButton sitterId={sitter.id} />
            </div>
            {sitter.about_me && (
              <div className="mt-6 pt-6 border-t border-black/5">
                <h2 className="font-semibold text-ink mb-2">{t("appPages.browse.aboutHeading", { name: firstName })}</h2>
                <p className="text-ink-soft text-sm leading-relaxed whitespace-pre-line">{sitter.about_me}</p>
              </div>
            )}
          </motion.div>

          {/* Services & rate */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.08 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
            <h2 className="font-semibold text-ink mb-4">{t("appPages.browse.servicesOfferedHeading")}</h2>
            {activeServices.length === 0 ? (
              <p className="text-sm text-ink-soft">{t("appPages.browse.noServicesListed")}</p>
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
          {/* Reviews */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.16 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6">
            <ReviewList sitterId={sitter.id} />
          </motion.div>
        </div>

        {/* Booking sidebar */}
        <div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
            className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5 sticky top-24">
            <div className="text-center pb-4 border-b border-black/5">
              <div className="font-display text-3xl font-semibold text-ink">€{sitter.rate_per_hour ?? "-"}</div>
              <div className="text-sm text-ink-soft mt-0.5">{t("appPages.browse.perHour")}</div>
            </div>
            <div className="pt-4 space-y-3">
              <Link href={`/bookings/new?sitter=${sitter.id}`} className="flex items-center justify-center gap-2 w-full h-11 bg-brand text-white rounded-xl font-medium text-sm hover:bg-brand-strong transition-colors">
                <Calendar className="w-4 h-4" />{t("appPages.browse.bookCta", { name: firstName })}
              </Link>
              <p className="text-xs text-ink-soft/80 text-center">{t("appPages.browse.paymentNote")}</p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
