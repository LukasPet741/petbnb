"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-[var(--shadow-lg)]">
        <h2 id={titleId} className="font-display text-lg font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function RenameDialog({ initial, onSave, onClose }: { initial: string; onSave: (label: string) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState(initial);
  const inputId = useId();
  return (
    <Dialog title={t("appPages.collar.renameTitle")} onClose={onClose}>
      <label htmlFor={inputId} className="mt-4 block text-sm font-medium text-ink">{t("appPages.collar.nameLabel")}</label>
      <input id={inputId} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40}
        className="mt-1.5 h-11 w-full rounded-xl border border-ink/10 bg-surface px-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" />
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl bg-surface-2 text-sm font-medium text-ink">{t("appPages.collar.cancel")}</button>
        <button type="button" disabled={!label.trim()} onClick={() => onSave(label.trim())} className="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50">
          {t("appPages.collar.save")}
        </button>
      </div>
    </Dialog>
  );
}

export function RemoveDialog({ name, onRemove, onClose }: { name: string; onRemove: () => void; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <Dialog title={t("appPages.collar.removeTitle", { name })} onClose={onClose}>
      <p className="mt-2 text-sm text-ink-soft">{t("appPages.collar.removeText")}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl bg-surface-2 text-sm font-medium text-ink">{t("appPages.collar.cancel")}</button>
        <button type="button" onClick={onRemove} className="h-11 flex-1 rounded-xl bg-danger text-sm font-semibold text-white">{t("appPages.collar.remove")}</button>
      </div>
    </Dialog>
  );
}
