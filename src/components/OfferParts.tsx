"use client";
import { useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { OFFER_NOTE_MAX } from "@/lib/pricing";
import { cn, formatCurrency } from "@/lib/utils";

/**
 * The chat's price pieces (spec 2026-09-15-sitter-pricing-and-offers-design.md). Presentational:
 * MessageThread works out who may accept or offer (lib/pricing, mirroring the database) and
 * passes only the actions that will succeed.
 */

const primary =
  "inline-flex items-center justify-center h-9 px-4 rounded-full bg-brand text-white text-xs font-semibold hover:bg-brand-strong transition-colors disabled:opacity-60 disabled:cursor-not-allowed";
const secondary =
  "inline-flex items-center justify-center h-9 px-4 rounded-full border border-black/10 bg-surface/80 text-ink text-xs font-semibold hover:bg-surface transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

/** The price as it stands, under the thread header. */
export function PriceBar({
  line,
  sub,
  acceptLabel,
  onAccept,
  offerLabel,
  onOffer,
  busy = false,
  error,
}: {
  line: string;
  sub?: string | null;
  acceptLabel?: string;
  onAccept?: () => void;
  offerLabel?: string;
  onOffer?: () => void;
  busy?: boolean;
  error: string | null;
}) {
  return (
    <div className="border-t border-black/5">
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink tabular-nums">{line}</p>
          {sub && <p className="text-xs text-ink-soft">{sub}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {onAccept && acceptLabel && (
            <button type="button" onClick={onAccept} disabled={busy} className={primary}>
              {acceptLabel}
            </button>
          )}
          {onOffer && offerLabel && (
            <button type="button" onClick={onOffer} disabled={busy} className={secondary}>
              {offerLabel}
            </button>
          )}
        </div>
        {error && (
          <p role="alert" className="basis-full flex items-center gap-1.5 text-xs text-danger">
            <TriangleAlert className="w-4 h-4 flex-shrink-0" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

/** One offer in the log. Only the newest can be answered; older ones are marked replaced. */
export function OfferCard({
  amount,
  note,
  own,
  time,
  replaced,
  acceptLabel,
  onAccept,
  onCounter,
  busy = false,
}: {
  amount: number;
  note: string | null;
  own: boolean;
  time: string;
  replaced: boolean;
  acceptLabel?: string;
  onAccept?: () => void;
  onCounter?: () => void;
  busy?: boolean;
}) {
  const { t, locale } = useLanguage();
  const actionable = !replaced && !own;

  return (
    <div className={cn("flex", own ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "w-full max-w-[20rem] rounded-2xl border px-4 py-3",
          replaced ? "border-black/5 bg-surface-2/60" : own ? "border-brand/20 bg-brand-soft" : "border-amber/30 bg-amber-soft",
        )}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.06em] text-ink-soft">
            {own ? t("messages.offer.yours") : t("messages.offer.title")}
          </span>
          {replaced && <span className="text-[11px] font-medium text-ink-soft">{t("messages.offer.replaced")}</span>}
        </div>
        <p className={cn("mt-1 font-display text-2xl font-semibold tabular-nums", replaced ? "text-ink-soft line-through" : "text-ink")}>
          {formatCurrency(amount, locale)}
        </p>
        {note && <p className="mt-1 text-sm text-ink whitespace-pre-wrap break-words">{note}</p>}
        <p className="mt-1 text-[11px] text-ink-soft tabular-nums">{time}</p>
        {actionable && (onAccept || onCounter) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onAccept && acceptLabel && (
              <button type="button" onClick={onAccept} disabled={busy} className={primary}>
                {acceptLabel}
              </button>
            )}
            {onCounter && (
              <button type="button" onClick={onCounter} disabled={busy} className={secondary}>
                {t("messages.offer.counter")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** A new offer, above the composer: a bounded whole-euro amount and an optional note. */
export function OfferForm({
  bounds,
  onSubmit,
  onCancel,
  busy,
}: {
  bounds: { min: number; max: number };
  onSubmit: (amount: number, note: string) => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const { t, locale } = useLanguage();
  const amountId = useId();
  const noteId = useId();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const whole = /^\d+$/.test(amount.trim());
  const value = Number(amount);
  const valid = whole && value >= bounds.min && value <= bounds.max;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onSubmit(value, note.trim());
      }}
      className="mb-3 rounded-2xl border border-black/10 bg-surface/80 p-3 grid gap-3 sm:grid-cols-[9rem_1fr_auto] sm:items-end"
    >
      <div>
        <label htmlFor={amountId} className="block text-xs font-medium text-ink-soft mb-1">
          {t("messages.offer.amountLabel")}
        </label>
        <input
          id={amountId}
          type="number"
          inputMode="numeric"
          min={bounds.min}
          max={bounds.max}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={(amount !== "" && !valid) || undefined}
          className="w-full h-10 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="mt-1 text-[11px] text-ink-soft">
          {t("messages.offer.range", { min: formatCurrency(bounds.min, locale), max: formatCurrency(bounds.max, locale) })}
        </p>
      </div>
      <div>
        <label htmlFor={noteId} className="block text-xs font-medium text-ink-soft mb-1">
          {t("messages.offer.noteLabel")}
        </label>
        <input
          id={noteId}
          type="text"
          maxLength={OFFER_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full h-10 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <p className="mt-1 text-[11px] text-transparent select-none" aria-hidden>.</p>
      </div>
      <div className="flex gap-2 sm:pb-5">
        <button type="submit" disabled={!valid || busy} className={primary}>
          {t("messages.offer.submit")}
        </button>
        <button type="button" onClick={onCancel} className={secondary}>
          {t("messages.offer.cancel")}
        </button>
      </div>
    </form>
  );
}
