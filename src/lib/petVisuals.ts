import { Dog, Cat, Bird, Fish, Squirrel, HelpCircle } from "lucide-react";
import type { PetType } from "@/lib/types";

/**
 * Glyph and tint for each species, used by the pet card and the pet form's
 * photo placeholder. Shared so the two surfaces cannot drift apart.
 *
 * Known gap, pinned by PetCard.test.tsx: reptile and small_mammal both map to
 * Squirrel, so a snake shows as a squirrel and only the tint tells them apart.
 * Kept as-is here — moving the maps is not the place to change behaviour.
 */
export const PET_ICONS: Record<PetType, React.ElementType> = {
  dog: Dog,
  cat: Cat,
  bird: Bird,
  fish: Fish,
  reptile: Squirrel,
  small_mammal: Squirrel,
  other: HelpCircle,
};

export const PET_COLORS: Record<PetType, string> = {
  dog: "bg-amber-50 text-amber-600",
  cat: "bg-violet-50 text-violet-600",
  bird: "bg-sky-50 text-sky-600",
  fish: "bg-blue-50 text-blue-600",
  reptile: "bg-green-50 text-green-600",
  small_mammal: "bg-orange-50 text-orange-600",
  other: "bg-stone-100 text-stone-500",
};

/** Falls back to the neutral "other" treatment for an unrecognised species. */
export const petIcon = (type: PetType): React.ElementType => PET_ICONS[type] ?? HelpCircle;
export const petColor = (type: PetType): string => PET_COLORS[type] ?? PET_COLORS.other;
