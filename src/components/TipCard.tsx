"use client";
import type { Tip } from "@/lib/tips";
import { useLanguage } from "@/context/LanguageContext";

/**
 * Photo-backed: the photograph fills the card and the copy sits on a glass plate over its
 * lower part, instead of a thumbnail strip above a white box.
 *
 * .glass-panel rather than a lighter tint on purpose. TipWidget crossfades cards with
 * opacity, and an ancestor animating opacity switches backdrop-filter off for the length
 * of the fade. At 88% white the plate looks almost the same blurred or not, so the blur
 * returning at the end of each fade does not read as a flicker.
 *
 * The plate is anchored to the bottom and grows upward, so longer Lithuanian copy covers
 * more of the photo rather than being cut off.
 */
export default function TipCard({ tip }: { tip: Tip }) {
  const { t } = useLanguage();

  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-surface-2 shadow-[var(--shadow-sm)]">
      <img src={tip.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />
      <div className="glass-panel absolute inset-x-2 bottom-2 rounded-xl border p-3.5">
        <span className="inline-block text-[11px] font-medium text-brand-strong bg-brand-soft px-2 py-0.5 rounded-full mb-1.5">{t(`tips.${tip.id}.tag`)}</span>
        <h4 className="text-sm font-semibold text-ink leading-snug">{t(`tips.${tip.id}.title`)}</h4>
        <p className="text-xs text-ink-soft mt-1 leading-relaxed">{t(`tips.${tip.id}.body`)}</p>
      </div>
    </div>
  );
}
