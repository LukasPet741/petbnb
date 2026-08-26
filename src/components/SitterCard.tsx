import Link from "next/link";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Avatar from "./Avatar";
import Badge from "./Badge";
import FavoriteButton from "./FavoriteButton";
import { type Profile, SERVICE_LABELS, type ServiceType } from "@/lib/types";

export default function SitterCard({ sitter, showFavorite = false }: { sitter: Profile; showFavorite?: boolean }) {
  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => SERVICE_LABELS[k]);

  return (
    <motion.div
      className="group bg-surface rounded-2xl border border-black/5 shadow-sm p-5 flex flex-col gap-4 h-full"
      whileHover={{ y: -4, boxShadow: "0 14px 30px -12px rgba(26,31,29,0.18)" }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <div className="flex items-start gap-4">
        <Avatar name={sitter.full_name ?? "Sitter"} url={sitter.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink text-base leading-tight truncate">{sitter.full_name}</h3>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-soft">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{sitter.city}</span>
            {sitter.experience_years != null && (
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{sitter.experience_years} yr{sitter.experience_years !== 1 ? "s" : ""}</span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {showFavorite && <FavoriteButton sitterId={sitter.id} />}
          <div className="text-right">
            <div className="text-lg font-semibold text-ink">€{sitter.rate_per_hour}</div>
            <div className="text-[11px] text-ink-soft">/ hour</div>
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
        href={`/browse/${sitter.id}`}
        className="mt-auto inline-flex items-center justify-center gap-1.5 h-10 rounded-xl border border-brand/20 text-brand font-medium text-sm hover:bg-brand-soft transition-colors"
      >
        View profile <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}
