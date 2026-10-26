import { Footprints, GraduationCap, House, Scissors, ShoppingBag, Stethoscope, Sun, type LucideIcon } from "lucide-react";
import type { Partner, PartnerCategory } from "@/lib/partners";
import { isListed } from "@/lib/partners";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<PartnerCategory, LucideIcon> = {
  vet: Stethoscope,
  shop: ShoppingBag,
  grooming: Scissors,
  boarding: House,
  daycare: Sun,
  training: GraduationCap,
  walking: Footprints,
};

/**
 * A place's mark wherever it is listed: its logo on a white tile (logos are drawn for white, in
 * either theme), else for a listed place the icon of what it does, else a partner's monogram.
 * Decorative: the name always sits beside it.
 */
export default function PlaceMark({ place, className, onBand = false }: { place: Partner; className?: string; onBand?: boolean }) {
  if (place.logo) {
    return (
      // The image is sized, not the tile padded: a percentage padding would follow the parent's width.
      <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] bg-white ring-1 ring-ink/8", className)}>
        <img src={place.logo} alt="" loading="lazy" className="h-[78%] w-[78%] object-contain" />
      </span>
    );
  }
  if (isListed(place)) {
    const Icon = CATEGORY_ICON[place.categories[0]] ?? ShoppingBag;
    return (
      <span aria-hidden="true" className={cn("inline-flex shrink-0 items-center justify-center rounded-[22%] bg-brand-soft text-brand-strong", className)}>
        <Icon className="h-1/2 w-1/2" />
      </span>
    );
  }
  // A partner with no logo yet: the name's first letter, so the grid still reads as a wall of brands.
  return (
    <span aria-hidden="true" className={cn(
      "inline-flex shrink-0 items-center justify-center rounded-full font-display font-semibold",
      onBand ? "border border-[var(--chrome-line)] bg-[var(--chrome-active)] text-[var(--hero-accent)]" : "bg-brand-soft text-brand-strong",
      className,
    )}>
      {place.name.charAt(0)}
    </span>
  );
}
