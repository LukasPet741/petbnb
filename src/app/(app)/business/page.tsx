"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { OwnedPlaceCard, RequestsCard, cardClass, headingClass } from "@/components/business/BusinessCards";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { PRIVACY_FLOOR } from "@/lib/areaCounts";
import type { CommunityClient } from "@/lib/placeCommunity";
import { fetchMyClaims, fetchOwnedPlaces, fetchOwnerCounts, fetchOwnerRequests, type BookingRequest, type MyClaim, type OwnedPlace } from "@/lib/placeBusiness";
import { cn } from "@/lib/utils";

/** The business tables are not in database.types.ts until it is regenerated; see CommunityClient. */
const db = supabase as unknown as CommunityClient;


/**
 * My business (ecosystem plan, "How businesses fit"): the claims a user filed and what PetBnB
 * decided, the places they own with their words and services to edit, booking requests to answer,
 * and how many pet owners are on PetBnB per city. Until the business tables are live the page
 * says so; nothing here sends email.
 */
export default function BusinessPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [claims, setClaims] = useState<MyClaim[] | null | undefined>(undefined);
  const [places, setPlaces] = useState<OwnedPlace[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [owners, setOwners] = useState<{ city: string; count: number }[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const myClaims = await fetchMyClaims(db);
    setClaims(myClaims);
    if (myClaims === null) return;
    const [owned, reqs, counts] = await Promise.all([fetchOwnedPlaces(db, user.id), fetchOwnerRequests(db), fetchOwnerCounts(db)]);
    setPlaces(owned);
    setRequests(reqs ?? []);
    setOwners(counts);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-10">
      <PageHeader icon={Building2} title={t("partners.forBusiness.page.title")} subtitle={t("partners.forBusiness.page.subtitle")} />

      {claims === undefined ? (
        <div className="mt-6 h-40 animate-pulse rounded-[var(--radius-card)] bg-ink/5" />
      ) : claims === null ? (
        <div className="mt-6">
          <EmptyState icon={Building2} title={t("partners.forBusiness.page.soonTitle")} description={t("partners.forBusiness.page.soon")} />
        </div>
      ) : claims.length === 0 && places.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Building2}
            tone="encouraging"
            title={t("partners.forBusiness.page.emptyTitle")}
            description={t("partners.forBusiness.page.empty")}
            action={<Link href="/partners" className="text-sm font-semibold text-brand hover:underline">{t("partners.forBusiness.page.findYours")}</Link>}
          />
        </div>
      ) : (
        <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-5">
            {places.map((place) => <OwnedPlaceCard key={place.id} place={place} onSaved={load} />)}
            {places.length > 0 && <RequestsCard requests={requests} onAnswered={load} />}
          </div>
          <aside className="min-w-0 space-y-5">
            {claims.length > 0 && (
              <section className={cardClass}>
                <h2 className={headingClass}>{t("partners.forBusiness.page.claims")}</h2>
                <ul className="mt-3 flex flex-col divide-y divide-ink/8">
                  {claims.map((c) => (
                    <li key={c.id} className="flex flex-col gap-1 py-2.5">
                      <span className="flex items-center justify-between gap-2">
                        <Link href={`/partners?p=${c.placeSlug}`} className="font-medium text-ink hover:text-brand">{c.placeName}</Link>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium",
                          c.status === "approved" ? "bg-brand-soft text-brand-strong" : c.status === "rejected" ? "bg-danger-soft text-danger" : "bg-ink/6 text-ink-soft")}>
                          {t(`partners.forBusiness.claim.statuses.${c.status}`)}
                        </span>
                      </span>
                      <span className="text-xs text-ink-soft">{t(`partners.forBusiness.claim.roles.${c.role}`)}</span>
                      {c.decidedReason && <span className="text-xs text-danger">{c.decidedReason}</span>}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{t("partners.forBusiness.page.claimsHint")}</p>
              </section>
            )}
            {places.length > 0 && (
              <section className={cardClass}>
                <h2 className={cn(headingClass, "flex items-center gap-1.5")}>
                  <Users className="h-4 w-4 text-amber-strong" aria-hidden="true" />
                  {t("partners.forBusiness.page.owners")}
                </h2>
                {owners.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-soft">{t("partners.forBusiness.page.ownersNone", { floor: PRIVACY_FLOOR })}</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {owners.map((o) => (
                      <li key={o.city} className="flex items-center justify-between text-sm">
                        <span className="text-ink">{o.city}</span>
                        <span className="font-semibold text-ink">{o.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs leading-relaxed text-ink-soft">{t("partners.forBusiness.page.ownersHint", { floor: PRIVACY_FLOOR })}</p>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
