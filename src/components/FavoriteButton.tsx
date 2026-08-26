"use client";
import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { useFavorites } from "@/context/FavoritesContext";
import { cn } from "@/lib/utils";

export default function FavoriteButton({ sitterId, className }: { sitterId: string; className?: string }) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(sitterId);

  return (
    <motion.button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(sitterId); }}
      whileTap={{ scale: 0.85 }}
      aria-label={active ? "Remove from saved" : "Save sitter"}
      title={active ? "Remove from saved" : "Save sitter"}
      className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
        active ? "bg-rose-50 text-rose-500" : "bg-surface-2 text-ink-soft hover:text-rose-500",
        className
      )}
    >
      <Heart className={cn("w-[18px] h-[18px]", active && "fill-rose-500")} />
    </motion.button>
  );
}
