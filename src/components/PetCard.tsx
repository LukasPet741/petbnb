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

export default function PetCard({ pet, onEdit, onDelete }: PetCardProps) {
  const { t } = useLanguage();
  const Icon = petIcon(pet.type as PetType);
  const colorClass = petColor(pet.type as PetType);

  return (
    <motion.div
      className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-4 flex gap-4 items-start"
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
      whileTap={{
        y: -1,
        boxShadow: "0 1px 2px rgba(19, 26, 23, 0.06), 0 1px 1px rgba(19, 26, 23, 0.04)",
        transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
      }}
    >
      {pet.photo_url ? (
        <img
          src={pet.photo_url}
          alt={pet.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-16 h-16 rounded-xl object-cover ring-1 ring-black/5 flex-shrink-0 bg-surface-2"
        />
      ) : (
        <motion.div
          className={cn("w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0", colorClass)}
          whileHover={{ scale: 1.06, rotate: 4 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
        >
          <Icon className="w-7 h-7" />
        </motion.div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">{pet.name}</h3>
            <p className="text-sm text-ink-soft">
              {t(`common.petTypes.${pet.type}`)}
              {pet.sex && pet.sex !== "unknown" && ` · ${t(`common.petSex.${pet.sex}`)}`}
              {pet.weight_kg && ` · ${pet.weight_kg}${t("appPages.petCard.weightUnit")}`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && (
              <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onEdit}
                className="w-11 h-11 -my-2 flex items-center justify-center rounded-full hover:bg-stone-100 active:bg-stone-100 text-stone-400 hover:text-ink transition-colors">
                <Edit2 className="w-4 h-4" />
              </motion.button>
            )}
            {onDelete && (
              <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onDelete}
                className="w-11 h-11 -my-2 flex items-center justify-center rounded-full hover:bg-danger-soft active:bg-danger-soft text-danger/70 hover:text-danger transition-colors">
                <Trash2 className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
        {pet.bio && <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">{pet.bio}</p>}
      </div>
    </motion.div>
  );
}
