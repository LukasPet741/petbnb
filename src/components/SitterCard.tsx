"use client";
import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Avatar from "./Avatar";
import Badge from "./Badge";
import FavoriteButton from "./FavoriteButton";
import { type Profile, type ServiceType } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

export default function SitterCard({ sitter, showFavorite = false, basePath = "/browse" }: { sitter: Profile; showFavorite?: boolean; basePath?: string }) {
  const { t } = useLanguage();
  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => t("common.services." + k));

  return (
    <motion.div
      className="group bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5 flex flex-col gap-4 h-full"
      whileHover={{ y: -2, boxShadow: "0 6px 16px rgba(19, 26, 23, 0.10), 0 2px 6px rgba(19, 26, 23, 0.06)" }}
      whileTap={{ y: -1, boxShadow: "0 1px 2px rgba(19, 26, 23, 0.06), 0 1px 1px rgba(19, 26, 23, 0.04)" }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-start gap-4">
        <Avatar name={sitter.full_name ?? t("appShell.sitterFallback")} url={sitter.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink text-base leading-tight truncate">{sitter.full_name}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-soft">
            <span className="flex items-center gap-1 min-w-0"><MapPin className="w-3.5 h-3.5 flex-shrink-0" /><span className="truncate">{sitter.city}</span></span>
            {sitter.experience_years != null && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{t(sitter.experience_years !== 1 ? "sitters.card.experiencePlural" : "sitters.card.experienceSingular", { years: sitter.experience_years })}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {showFavorite && <FavoriteButton sitterId={sitter.id} />}
          <div className="text-right">
            <div className="text-lg font-semibold text-ink">€{sitter.rate_per_hour}</div>
            <div className="text-[11px] text-ink-soft">{t("sitters.card.rateSuffix")}</div>
          </div>
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

      <Link
        href={`${basePath}/${sitter.id}`}
        className="mt-auto inline-flex items-center justify-center gap-1.5 h-10 rounded-full border border-brand/20 text-brand font-medium text-sm hover:bg-brand-soft transition-colors"
      >
        {t("sitters.card.viewProfile")} <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}
