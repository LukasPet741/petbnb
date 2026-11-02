"use client";
import Link from "next/link";
import { Megaphone, ArrowUpRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { cardClass, headingClass } from "@/components/business/BusinessCards";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import type { OwnedPlace } from "@/lib/placeBusiness";
import { formatPromotePrice, promoteCheckoutBase, promoteCheckoutUrl, promotePortalBase, promotePortalUrl } from "@/lib/promote";
import { cn } from "@/lib/utils";

/**
 * My business: put one owned place first on the map and the list, as a labelled ad.
 * Promotion is a flag on top of the tier, so a Bookable place keeps its booking requests.
 * Shows nothing while promotion is not on sale (see lib/promote).
 */
export default function PromoteCard({
  place, paid = false, checkoutBase = promoteCheckoutBase(), portalBase = promotePortalBase(),
}: { place: OwnedPlace; paid?: boolean; checkoutBase?: string; portalBase?: string }) {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  if (place.status !== "published") return null;
  const portal = promotePortalUrl(portalBase, user?.email);

  if (place.promoted) {
    return (
      <section className={cardClass}>
        <h2 className={cn(headingClass, "flex items-center gap-1.5")}>
          <Megaphone className="h-4 w-4 text-amber-strong" aria-hidden="true" />
          {t("partners.forBusiness.promote.activeTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("partners.forBusiness.promote.activeText")}</p>
        {portal && (
          <a href={portal} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            {t("partners.forBusiness.promote.manage")}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </section>
    );
  }

  const href = promoteCheckoutUrl(checkoutBase, place.id, user?.email);
  if (!href) return null;

  // Back from Stripe and not switched on yet: no second checkout.
  if (paid) {
    return (
      <section className={cardClass}>
        <h2 className={cn(headingClass, "flex items-center gap-1.5")}>
          <Megaphone className="h-4 w-4 text-amber-strong" aria-hidden="true" />
          {t("partners.forBusiness.promote.paidTitle")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t("partners.forBusiness.promote.paidText")}</p>
      </section>
    );
  }
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
      <p className="mt-2 text-xs leading-relaxed text-ink-soft">
        {t("partners.forBusiness.promote.note")}{" "}
        <Link href="/legal/advertising" className="font-medium text-brand hover:underline">{t("partners.forBusiness.promote.terms")}</Link>
      </p>
    </section>
  );
}
