"use client";
import { useLanguage } from "@/context/LanguageContext";
import { dailyRate, priceSummary, visitPrice, type SitterPrices } from "@/lib/pricing";
import { formatCurrency } from "@/lib/utils";
import type { ServiceType } from "@/lib/types";

/**
 * A sitter's price as a card shows it: "nuo 25 € / d." (the cheapest daily rate, or the chosen
 * service's) or "36 € / vizitas" for grooming. Renders nothing when there is no price to show,
 * never a bare "€". The real price of a stay is agreed in the request's chat.
 */
export default function PriceTag({
  sitter,
  service,
  size = "lg",
}: {
  sitter: { services: Partial<Record<string, unknown>> | null | undefined; prices?: SitterPrices | null };
  service?: ServiceType | "";
  size?: "xl" | "lg" | "sm";
}) {
  const { t, locale } = useLanguage();
  const summary = priceSummary(sitter, service);
  if (!summary) return null;

  const price = formatCurrency(summary.amount, locale);
  const suffix = t(summary.kind === "daily" ? "common.pricing.perDay" : "common.pricing.perVisit");

  if (size === "sm") {
    return (
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-semibold text-ink whitespace-nowrap">
          {summary.kind === "daily" && <span className="mr-1 text-[10px] font-normal text-ink-soft">{t("common.pricing.from")}</span>}
          <span>{price}</span>
        </div>
        <div className="text-[10px] text-ink-soft">{suffix}</div>
      </div>
    );
  }

  return (
    <span className="text-right leading-none whitespace-nowrap">
      {summary.kind === "daily" && <span className="mr-1 text-xs text-ink-soft">{t("common.pricing.from")}</span>}
      <span className={`font-display font-semibold text-ink ${size === "xl" ? "text-3xl" : "text-xl"}`}>{price}</span>
      <span className="ml-0.5 text-xs text-ink-soft">{suffix}</span>
    </span>
  );
}

/**
 * One service's price on a sitter's profile, as the sitter set it: "75 € / 3 d." with its daily
 * equivalent beneath, "12 € / d.", "36 € / vizitas", or "Kaina nenurodyta".
 */
export function ServicePrice({ prices, service }: { prices: SitterPrices | null | undefined; service: ServiceType }) {
  const { t, locale } = useLanguage();

  if (service === "grooming") {
    const visit = visitPrice(prices);
    if (visit === null) return <span className="text-sm text-ink-soft/70">{t("common.pricing.noPrice")}</span>;
    return (
      <span className="text-sm text-ink whitespace-nowrap">
        {formatCurrency(visit, locale)} <span className="text-ink-soft">{t("common.pricing.perVisit")}</span>
      </span>
    );
  }

  const price = prices?.[service];
  if (!price) return <span className="text-sm text-ink-soft/70">{t("common.pricing.noPrice")}</span>;

  return (
    <span className="text-right leading-tight">
      <span className="block text-sm text-ink whitespace-nowrap">
        {formatCurrency(price.amount, locale)}{" "}
        <span className="text-ink-soft">
          {price.days === 1 ? t("common.pricing.perDay") : t("common.pricing.perDays", { count: price.days })}
        </span>
      </span>
      {price.days > 1 && (
        <span className="block text-xs text-ink-soft">
          {t("common.pricing.approxPerDay", { price: formatCurrency(Math.round(dailyRate(price)), locale) })}
        </span>
      )}
    </span>
  );
}
