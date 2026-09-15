"use client";
import { useId } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { OFFER_NOTE_MAX } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import type { ServiceType } from "@/lib/types";

/** What the owner sends with a request: the asking price, or their own opening offer. */
export interface PriceChoice {
  mode: "asking" | "offer";
  /** As typed. */
  amount: string;
  note: string;
}

/**
 * The amounts an owner's first offer may take: at least half the asking price, below the asking
 * price. The same bounds enforce_offer_rules applies; null when no whole euro fits.
 */
export function firstOfferBounds(asking: number): { min: number; max: number } | null {
  const min = Math.ceil(asking / 2);
  const max = asking - 1;
  return min <= max ? { min, max } : null;
}

/** Whether the request can be sent with this choice. */
export function requestPriceValid(choice: PriceChoice, asking: number | null, service: ServiceType | ""): boolean {
  if (asking === null) return false;
  if (choice.mode === "asking") return true;
  if (service === "grooming" || !/^\d+$/.test(choice.amount.trim())) return false;
  const bounds = firstOfferBounds(asking);
  const amount = Number(choice.amount);
  return bounds !== null && amount >= bounds.min && amount <= bounds.max;
}

const inputCls =
  "w-full h-11 px-3.5 rounded-[var(--radius-input)] border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";

/**
 * The request form's price section. Presentational: the page owns the choice and computes the
 * asking price. Grooming and an unpriced service get a sentence instead of a choice.
 */
export default function RequestPrice({
  asking,
  service,
  choice,
  onChange,
}: {
  asking: number | null;
  service: ServiceType | "";
  choice: PriceChoice;
  onChange: (choice: PriceChoice) => void;
}) {
  const { t, locale } = useLanguage();
  const amountId = useId();
  const noteId = useId();
  const problemId = useId();

  if (!service) return null;

  if (asking === null) {
    return (
      <p className="text-sm text-amber-strong bg-amber-soft border border-amber/20 rounded-[var(--radius-input)] px-3.5 py-3">
        {t("appPages.bookingsNew.unpricedService")}
      </p>
    );
  }

  const price = formatCurrency(asking, locale);

  if (service === "grooming") {
    return (
      <p className="text-sm text-ink-soft border border-dashed border-black/15 rounded-[var(--radius-input)] px-3.5 py-3">
        <span className="font-semibold text-ink">{price}</span> · <span>{t("appPages.bookingsNew.groomingFixedPrice")}</span>
      </p>
    );
  }

  const bounds = firstOfferBounds(asking);
  const typed = choice.amount.trim();
  const outOfRange = choice.mode === "offer" && typed !== "" && !requestPriceValid(choice, asking, service);

  const option = (mode: PriceChoice["mode"], label: string, disabled = false) => (
    <label
      className={`flex items-center gap-2.5 p-3.5 rounded-[var(--radius-input)] border text-sm font-medium transition-all ${
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
      } ${
        choice.mode === mode
          ? "border-brand bg-brand-soft text-brand-strong shadow-[var(--shadow-sm)]"
          : "border-black/10 bg-surface/70 text-ink-soft hover:border-black/20 hover:bg-surface"
      }`}
    >
      <input
        type="radio"
        name="request-price"
        checked={choice.mode === mode}
        disabled={disabled}
        onChange={() => onChange({ ...choice, mode })}
        className="accent-[var(--color-brand)]"
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-2.5">
      <div role="radiogroup" className="grid gap-2.5 sm:grid-cols-2">
        {option("asking", t("appPages.bookingsNew.sendAtAsking", { price }))}
        {option("offer", t("appPages.bookingsNew.makeOffer"), bounds === null)}
      </div>

      {choice.mode === "offer" && bounds && (
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <div>
            <label htmlFor={amountId} className="block text-xs font-medium text-ink-soft mb-1.5">
              {t("appPages.bookingsNew.offerAmountLabel")}
            </label>
            <input
              id={amountId}
              type="number"
              inputMode="numeric"
              min={bounds.min}
              max={bounds.max}
              step={1}
              value={choice.amount}
              onChange={(e) => onChange({ ...choice, amount: e.target.value })}
              aria-invalid={outOfRange || undefined}
              aria-describedby={problemId}
              className={inputCls}
            />
            <p id={problemId} className="mt-1.5 text-xs text-ink-soft" role={outOfRange ? "alert" : undefined}>
              {outOfRange ? (
                <span className="text-danger">
                  {t("appPages.bookingsNew.offerOutOfRange", {
                    min: formatCurrency(bounds.min, locale),
                    max: formatCurrency(bounds.max, locale),
                  })}
                </span>
              ) : (
                t("appPages.bookingsNew.offerRange", {
                  min: formatCurrency(bounds.min, locale),
                  max: formatCurrency(bounds.max, locale),
                })
              )}
            </p>
          </div>
          <div>
            <label htmlFor={noteId} className="block text-xs font-medium text-ink-soft mb-1.5">
              {t("appPages.bookingsNew.offerNoteLabel")}
            </label>
            <textarea
              id={noteId}
              rows={2}
              maxLength={OFFER_NOTE_MAX}
              value={choice.note}
              onChange={(e) => onChange({ ...choice, note: e.target.value })}
              placeholder={t("appPages.bookingsNew.offerNotePlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-[var(--radius-input)] border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
