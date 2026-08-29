"use client";
import type { Tip } from "@/lib/tips";
import { useLanguage } from "@/context/LanguageContext";

export default function TipCard({ tip }: { tip: Tip }) {
  const { t } = useLanguage();

  return (
    <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] overflow-hidden h-full flex flex-col">
      <img src={tip.image} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-28 object-cover bg-surface-2 flex-shrink-0" />
      <div className="p-4 flex-1">
        <span className="inline-block text-[11px] font-medium text-brand-strong bg-brand-soft px-2 py-0.5 rounded-full mb-2">{t(`tips.${tip.id}.tag`)}</span>
        <h4 className="text-sm font-semibold text-ink leading-snug">{t(`tips.${tip.id}.title`)}</h4>
        <p className="text-xs text-ink-soft mt-1 leading-relaxed">{t(`tips.${tip.id}.body`)}</p>
      </div>
    </div>
  );
}
