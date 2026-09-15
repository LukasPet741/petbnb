"use client";
import Link from "next/link";
import { MapPin, Clock } from "lucide-react";
import { motion } from "framer-motion";
import Avatar from "./Avatar";
import Badge from "./Badge";
import FavoriteButton from "./FavoriteButton";
import RatingSummary from "./RatingSummary";
import PriceTag from "./PriceTag";
import VerifiedSeal from "./VerifiedSeal";
import { type Profile, type ServiceType, type SitterRating } from "@/lib/types";
import { coverFocus, coverService, sitterCoverPhoto } from "@/lib/images";
import { useLanguage } from "@/context/LanguageContext";

/** Buckets a sitter's last_active_at into a coarse, non-exact trust signal.
 *  Returns null for anything older than a week so long-dormant sitters show nothing. */
type ActivityBucket = "now" | "today" | "week";
const ACTIVITY_DOT_CLASS: Record<ActivityBucket, string> = {
  now: "bg-brand",
  today: "bg-brand/60",
  week: "bg-ink-soft/40",
};
export function getActivityBucket(lastActiveAt: string | null | undefined): ActivityBucket | null {
  if (!lastActiveAt) return null;
  const lastActiveMs = new Date(lastActiveAt).getTime();
  if (Number.isNaN(lastActiveMs)) return null;
  const minutesAgo = (Date.now() - lastActiveMs) / 60000;
  if (minutesAgo <= 15) return "now";
  if (minutesAgo <= 60 * 24) return "today";
  if (minutesAgo <= 60 * 24 * 7) return "week";
  return null;
}

/**
 * A sitter in the /browse and /saved grids (browse variant A, 2026-09-15): a cover photo, the
 * avatar overlapping it, then name, place, a line in their own words, services, rating, price.
 *
 * The cover illustrates the first service the sitter offers, from a small pool per service so a
 * grid of walkers is not seventeen copies of one photo. The grid passes its pick in so neighbours
 * differ, and the profile cover reuses that pick when opened from the grid.
 * Sitters upload an avatar, never a cover.
 * The whole card is one link, stretched under the favourite button so that stays its own target.
 */
export default function SitterCard({
  sitter,
  showFavorite = false,
  rating,
  coverPhotoId,
  priceService,
}: {
  sitter: Profile;
  showFavorite?: boolean;
  rating?: SitterRating | null;
  /** The grid's pick (spreadCoverPhotos), so neighbouring cards never share a photo. */
  coverPhotoId?: string;
  /** The service /browse is filtered to, so the price shown is that service's. */
  priceService?: ServiceType | "";
}) {
  const { t } = useLanguage();
  const name = sitter.full_name ?? t("appShell.sitterFallback");
  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => t("common.services." + k));
  const activityBucket = getActivityBucket(sitter.last_active_at);
  const cover = coverService(sitter.services);
  const coverSrc = cover ? sitterCoverPhoto(sitter.id, cover, 640, coverPhotoId) : null;

  return (
    <motion.div
      className="group relative glass-card rounded-2xl border overflow-hidden flex flex-col h-full"
      whileHover={{ y: -3, boxShadow: "0 10px 24px rgba(19, 26, 23, 0.12), 0 2px 6px rgba(19, 26, 23, 0.06)" }}
      whileTap={{ y: -1, boxShadow: "0 1px 2px rgba(19, 26, 23, 0.06), 0 1px 1px rgba(19, 26, 23, 0.04)" }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-brand-soft via-surface-2 to-amber-soft">
        {cover && coverSrc && (
          <img
            src={coverSrc}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            style={{ objectPosition: coverFocus(coverSrc, cover) }}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          />
        )}
        {activityBucket && (
          <span className="glass-panel absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium text-ink">
            <span className={`w-1.5 h-1.5 rounded-full ${ACTIVITY_DOT_CLASS[activityBucket]}`} />
            {t(`sitters.activity.${activityBucket}`)}
          </span>
        )}
        {showFavorite && <FavoriteButton sitterId={sitter.id} className="absolute right-3 top-3 z-20 shadow-[var(--shadow-sm)]" />}
      </div>

      <div className="flex flex-1 min-w-0 flex-col gap-3 px-5 pb-5">
        <Avatar name={name} url={sitter.avatar_url} size="lg" className="relative -mt-8 ring-4 ring-white shadow-[var(--shadow-sm)]" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-display text-lg font-semibold text-ink leading-tight tracking-tight truncate">{name}</h3>
            <VerifiedSeal method={sitter.verification_method} size="md" />
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-ink-soft">
            <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{sitter.city}</span></span>
            {sitter.experience_years != null && (
              <span className="flex items-center gap-1 flex-shrink-0"><Clock className="w-3.5 h-3.5" />{t(sitter.experience_years !== 1 ? "sitters.card.experiencePlural" : "sitters.card.experienceSingular", { years: sitter.experience_years })}</span>
            )}
          </div>
        </div>

        {sitter.about_me && (
          <p className="text-sm text-ink-soft leading-relaxed line-clamp-2">{sitter.about_me}</p>
        )}

        {activeServices.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {activeServices.map((s) => <Badge key={s} variant="brand">{s}</Badge>)}
          </div>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pt-1">
          {rating ? <RatingSummary average={rating.average} count={rating.count} /> : <span />}
          <PriceTag sitter={sitter} service={priceService} />
        </div>
      </div>

      <Link
        href={`/browse/${sitter.id}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="sr-only">{t("sitters.card.viewProfile")}</span>
      </Link>
    </motion.div>
  );
}
