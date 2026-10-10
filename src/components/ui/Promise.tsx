"use client";
import { MapPin, ShieldCheck, Tag, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { Signature } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** One icon and one tone per promise, everywhere it appears (brand look A, plan §2.3). */
export const PROMISE_ICONS: Record<Signature, LucideIcon> = {
  smartId: ShieldCheck,
  live: MapPin,
  agreed: Tag,
};

const TONE: Record<Signature, string> = {
  smartId: "bg-brand-soft text-brand-strong",
  live: "bg-slate-soft text-slate",
  agreed: "bg-amber-soft text-amber-strong",
};

/** A promise badge: Smart-ID verified, live location, agreed price — always the /brand names. */
export default function Promise({ kind, size = "md", className }: { kind: Signature; size?: "sm" | "md"; className?: string }) {
  const { t } = useLanguage();
  const Icon = PROMISE_ICONS[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
        TONE[kind],
        className,
      )}
    >
      <Icon className={size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"} aria-hidden="true" />
      {t(`brand.signatures.${kind}.name`)}
    </span>
  );
}
