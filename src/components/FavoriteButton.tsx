"use client";
import { useState } from "react";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useFavorites } from "@/context/FavoritesContext";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { EASE, press } from "@/lib/motion";

// Six sparks thrown out from the heart when a sitter is saved.
const SPARKS = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * 18, y: Math.sin(a) * 18 };
});

export default function FavoriteButton({ sitterId, className }: { sitterId: string; className?: string }) {
  const { t } = useLanguage();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(sitterId);
  // Counts saves, so each one replays the pop; un-saving is quiet (its toast offers Undo).
  const [pops, setPops] = useState(0);

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!active) setPops((n) => n + 1);
        toggle(sitterId);
      }}
      whileTap={press.whileTap}
      aria-label={active ? t("appPages.favoriteButton.removeFromSaved") : t("appPages.favoriteButton.saveSitter")}
      title={active ? t("appPages.favoriteButton.removeFromSaved") : t("appPages.favoriteButton.saveSitter")}
      className={cn(
        // 36px painted circle, but a 44px tap target: the pseudo-element extends the hit
        // area 4px on every side without changing the layout or the visual size.
        "relative w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
        "after:absolute after:-inset-1 after:content-[''] after:rounded-full",
        // Saved is amber, the paw's colour in the mark: warmth, not alarm (brand look A).
        active ? "bg-amber-soft text-amber-strong" : "bg-surface-2 text-ink-soft hover:text-amber-strong",
        className
      )}
    >
      <motion.span
        key={pops}
        className="grid place-items-center"
        initial={false}
        animate={pops && active ? { scale: [1, 1.35, 0.92, 1] } : { scale: 1 }}
        transition={{ duration: 0.42, ease: EASE.calm }}
      >
        <Heart className={cn("w-[18px] h-[18px]", active && "fill-amber")} />
      </motion.span>
      {pops > 0 && active && (
        <span key={`sparks-${pops}`} aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          {SPARKS.map((s, i) => (
            <motion.span
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber"
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{ x: s.x, y: s.y, opacity: 0, scale: 0.4 }}
              transition={{ duration: 0.45, ease: EASE.calm }}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}
