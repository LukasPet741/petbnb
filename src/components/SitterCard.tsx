import Link from "next/link";
import { MapPin, Clock, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import Avatar from "./Avatar";
import StarRating from "./StarRating";
import Badge from "./Badge";
import { type Profile, SERVICE_LABELS, type ServiceType } from "@/lib/mock-data";

export default function SitterCard({ sitter }: { sitter: Profile }) {
  const activeServices = (Object.entries(sitter.services ?? {}) as [ServiceType, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => SERVICE_LABELS[k]);

  const lastActiveHours = Math.floor(
    (Date.now() - new Date(sitter.last_active_at).getTime()) / 3600000
  );
  const activeLabel =
    lastActiveHours < 1 ? "Active now" : lastActiveHours < 24 ? `${lastActiveHours}h ago` : "Recently active";

  return (
    <motion.div
      className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      whileHover={{ y: -4, boxShadow: "0 12px 28px rgba(0,0,0,0.09)" }}
    >
      <div className="flex items-start gap-3">
        <Avatar name={sitter.full_name ?? "Sitter"} url={sitter.avatar_url} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-semibold text-stone-900 text-base">{sitter.full_name}</h3>
            <CheckCircle className="w-4 h-4 text-[#D95F3B] flex-shrink-0" />
          </div>
          {sitter.rating !== undefined && (
            <StarRating rating={sitter.rating} count={sitter.review_count} />
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-stone-400">
            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{sitter.city}</span>
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{activeLabel}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xl font-bold text-stone-900">£{sitter.rate_per_hour}</div>
          <div className="text-xs text-stone-400">per hour</div>
        </div>
      </div>

      {sitter.about_me && (
        <p className="text-sm text-stone-600 leading-relaxed line-clamp-2">{sitter.about_me}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {activeServices.map((s) => <Badge key={s} variant="coral">{s}</Badge>)}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-stone-50">
        <span className="text-xs text-stone-400">
          {sitter.experience_years} yr{sitter.experience_years !== 1 ? "s" : ""} experience
        </span>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link
            href={`/browse/${sitter.id}`}
            className="px-4 py-2 bg-[#D95F3B] text-white rounded-lg text-sm font-medium hover:bg-[#c4482a] transition-colors"
          >
            View profile
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}
