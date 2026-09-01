"use client";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useFavorites } from "@/context/FavoritesContext";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";

export default function FavoriteButton({ sitterId, className }: { sitterId: string; className?: string }) {
  const { t } = useLanguage();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(sitterId);

  return (
    <motion.button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(sitterId); }}
      whileTap={{ scale: 0.85 }}
      aria-label={active ? t("appPages.favoriteButton.removeFromSaved") : t("appPages.favoriteButton.saveSitter")}
      title={active ? t("appPages.favoriteButton.removeFromSaved") : t("appPages.favoriteButton.saveSitter")}
      className={cn(
        // 36px painted circle, but a 44px tap target: the pseudo-element extends the hit
        // area 4px on every side without changing the layout or the visual size.
        "relative w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
        "after:absolute after:-inset-1 after:content-[''] after:rounded-full",
        active ? "bg-rose-50 text-rose-500" : "bg-surface-2 text-ink-soft hover:text-rose-500",
        className
      )}
    >
      <Heart className={cn("w-[18px] h-[18px]", active && "fill-rose-500")} />
    </motion.button>
  );
}
