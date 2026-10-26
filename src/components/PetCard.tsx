"use client";
import { Edit2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { type Pet, type PetType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import { petColor, petIcon } from "@/lib/petVisuals";

interface PetCardProps {
  pet: Pet;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * One pet as a portrait card (2026-10-26): the photo, or the species tile, across the top, then
 * name, details and a clamped bio, so a household reads as a grid of faces rather than rows.
 */
export default function PetCard({ pet, onEdit, onDelete }: PetCardProps) {
  const { t } = useLanguage();
  const Icon = petIcon(pet.type as PetType);
  const colorClass = petColor(pet.type as PetType);

  return (
    <motion.article
      className="glass-card group flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      whileHover={{
        y: -2,
        boxShadow: "0 6px 16px rgba(19, 26, 23, 0.10), 0 2px 6px rgba(19, 26, 23, 0.06)",
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      <div data-slot="photo" className={cn("relative aspect-[16/10] w-full overflow-hidden", !pet.photo_url && colorClass)}>
        {pet.photo_url ? (
          <img
            src={pet.photo_url}
            alt={pet.name}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover bg-surface-2 transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Icon className="w-12 h-12 opacity-80 transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold tracking-tight text-ink break-words">{pet.name}</h3>
            <p className="text-sm text-ink-soft">
              {t(`common.petTypes.${pet.type}`)}
              {pet.sex && pet.sex !== "unknown" && ` · ${t(`common.petSex.${pet.sex}`)}`}
              {pet.weight_kg && ` · ${pet.weight_kg}${t("appPages.petCard.weightUnit")}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 -mr-2 -mt-1.5">
            {onEdit && (
              <button type="button" onClick={onEdit}
                aria-label={t("appPages.petCard.editLabel")}
                className="pb-press w-11 h-11 flex items-center justify-center rounded-full text-ink-soft hover:bg-brand-softer hover:text-brand transition-colors">
                <Edit2 className="w-4 h-4" aria-hidden />
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete}
                aria-label={t("appPages.petCard.removeLabel")}
                className="pb-press w-11 h-11 flex items-center justify-center rounded-full text-danger/70 hover:bg-danger-soft hover:text-danger transition-colors">
                <Trash2 className="w-4 h-4" aria-hidden />
              </button>
            )}
          </div>
        </div>
        {pet.bio && <p className="text-sm text-ink-soft mt-2 leading-relaxed line-clamp-3">{pet.bio}</p>}
      </div>
    </motion.article>
  );
}
