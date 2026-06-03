import { Dog, Cat, Bird, Fish, Squirrel, HelpCircle, Edit2, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { type Pet, PET_TYPE_LABELS, type PetType } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const PET_ICONS: Record<PetType, React.ElementType> = {
  dog: Dog, cat: Cat, bird: Bird, fish: Fish,
  reptile: Squirrel, small_mammal: Squirrel, other: HelpCircle,
};

const PET_COLORS: Record<PetType, string> = {
  dog: "bg-amber-50 text-amber-600",
  cat: "bg-purple-50 text-purple-600",
  bird: "bg-sky-50 text-sky-600",
  fish: "bg-blue-50 text-blue-600",
  reptile: "bg-green-50 text-green-600",
  small_mammal: "bg-orange-50 text-orange-600",
  other: "bg-stone-100 text-stone-500",
};

interface PetCardProps {
  pet: Pet;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function PetCard({ pet, onEdit, onDelete }: PetCardProps) {
  const Icon = PET_ICONS[pet.type as PetType] ?? HelpCircle;
  const colorClass = PET_COLORS[pet.type as PetType] ?? "bg-stone-100 text-stone-500";

  return (
    <motion.div
      className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 flex gap-4 items-start"
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      whileHover={{ y: -2, boxShadow: "0 6px 20px rgba(0,0,0,0.07)" }}
    >
      <motion.div
        className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", colorClass)}
        whileHover={{ scale: 1.1, rotate: 5 }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
      >
        <Icon className="w-6 h-6" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-stone-900">{pet.name}</h3>
            <p className="text-sm text-stone-500">
              {PET_TYPE_LABELS[pet.type as PetType]}
              {pet.sex && pet.sex !== "unknown" && ` · ${pet.sex}`}
              {pet.weight_kg && ` · ${pet.weight_kg}kg`}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onEdit && (
              <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onEdit}
                className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
                <Edit2 className="w-4 h-4" />
              </motion.button>
            )}
            {onDelete && (
              <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onDelete}
                className="p-1.5 rounded-lg hover:bg-red-50 text-stone-400 hover:text-red-500 transition-colors">
                <Trash2 className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
        {pet.bio && <p className="text-sm text-stone-500 mt-1.5 leading-relaxed">{pet.bio}</p>}
      </div>
    </motion.div>
  );
}
