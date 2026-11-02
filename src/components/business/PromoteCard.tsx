"use client";
import { Megaphone, ArrowUpRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { cardClass, headingClass } from "@/components/business/BusinessCards";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { OwnedPlace } from "@/lib/placeBusiness";
import { formatPromotePrice, promoteCheckoutBase, promoteCheckoutUrl } from "@/lib/promote";
import { cn } from "@/lib/utils";

/**
 * My business: put one owned place first on the map and the list, as a labelled ad.
 * Promoted is a tier of its own, so a Bookable place is not offered it (promoting it would end
 * its booking requests). Shows nothing while promotion is not on sale (see lib/promote).
 */
export default function PromoteCard({ place, checkoutBase = promoteCheckoutBase() }: { place: OwnedPlace; checkoutBase?: string }) {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  if (place.status !== "published") return null;

  if (place.tier === "promoted") {
    return (
      <section className={cardClass}>
        <h2 className={cn(headingClass, "flex items-center gap-1.5")}>
          <Megaphone className="h-4 w-4 text-amber-strong" aria-hidden="true" />
          {t("partners.forBusiness.promote.activeTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("partners.forBusiness.promote.activeText")}</p>
      </section>
    );
  }

  if (place.tier !== "partner" && place.tier !== "listed") return null;
  const href = promoteCheckoutUrl(checkoutBase, place.id, user?.email);
  if (!href) return null;
  const price = formatPromotePrice(locale);

  return (
    <section className={cardClass}>
      <h2 className={cn(headingClass, "flex items-center gap-1.5")}>
        <Megaphone className="h-4 w-4 text-amber-strong" aria-hidden="true" />
        {t("partners.forBusiness.promote.title")}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("partners.forBusiness.promote.text", { price })}</p>
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(buttonClasses({ variant: "primary", size: "sm" }), "mt-3")}>
        {t("partners.forBusiness.promote.button", { price })}
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">{t("partners.forBusiness.promote.note")}</p>
    </section>
  );
}
