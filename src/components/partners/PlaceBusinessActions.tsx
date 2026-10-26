"use client";
import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Building2, CalendarClock } from "lucide-react";
import Button from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import { withNext } from "@/lib/next-path";
import { isBookable, type Partner } from "@/lib/partners";
import { fetchMyPets, type CommunityClient, type MyPet } from "@/lib/placeCommunity";
import {
  CLAIM_ROLES, TIMES_OF_DAY, cancelRequest, claimPlace, earliestRequestDate, fetchMyRequestsAt, requestBooking,
  type BookingRequest, type ClaimRole, type TimeOfDay,
} from "@/lib/placeBusiness";
import { cn } from "@/lib/utils";

/** The business tables are not in database.types.ts until it is regenerated; see CommunityClient. */
const db = supabase as unknown as CommunityClient;

const fieldClass =
  "w-full rounded-[var(--radius-input)] border border-ink/12 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";
const headingClass = "text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft";

/**
 * What a place's panel offers beyond facts: a booking request where the place is Bookable, and
 * "Is this your business?" for its owner to claim the page. Both need the places table (a place
 * read from it carries its id); on the built-in list they stay out of the panel.
 */
export default function PlaceBusinessActions({ place }: { place: Partner }) {
  if (!place.id) return null;
  return (
    <div className="flex flex-col gap-4">
      {isBookable(place) && <BookingRequests place={place} placeId={place.id} />}
      <ClaimPlace place={place} placeId={place.id} />
    </div>
  );
}

function SignInLink({ slug, label }: { slug: string; label: string }) {
  return (
    <Link href={withNext("/login", `/partners?p=${slug}`)} className="text-sm font-semibold text-brand underline-offset-4 hover:underline">
      {label}
    </Link>
  );
}

function BookingRequests({ place, placeId }: { place: Partner; placeId: string }) {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const [mine, setMine] = useState<BookingRequest[]>([]);
  const [pets, setPets] = useState<MyPet[]>([]);
  const services = place.services.map((s) => s.name[locale]);
  const [service, setService] = useState(services[0] ?? "");
  const [date, setDate] = useState(earliestRequestDate());
  const [time, setTime] = useState<TimeOfDay>("morning");
  const [petId, setPetId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const ids = { service: useId(), date: useId(), time: useId(), pet: useId(), note: useId() };

  const load = useCallback(async () => {
    if (!user) return;
    const [requests, myPets] = await Promise.all([fetchMyRequestsAt(db, placeId), fetchMyPets(db, user.id)]);
    setMine(requests);
    setPets(myPets);
    setPetId((current) => current || myPets[0]?.id || "");
  }, [user, placeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-brand/20 bg-brand-softer/60 p-4">
      <h3 className={cn(headingClass, "flex items-center gap-1.5 text-brand-strong")}>
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        {t("partners.forBusiness.book.heading")}
      </h3>
      {!user ? (
        <SignInLink slug={place.slug} label={t("partners.forBusiness.book.signIn")} />
      ) : (
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!service) return;
            setBusy(true);
            const err = await requestBooking(db, { placeId, petId: petId || null, serviceName: service, date, time, note });
            setBusy(false);
            setError(Boolean(err));
            if (!err) {
              setNote("");
              void load();
            }
          }}
        >
          <label htmlFor={ids.service} className="sr-only">{t("partners.forBusiness.book.service")}</label>
          <select id={ids.service} value={service} onChange={(e) => setService(e.target.value)} className={cn(fieldClass, "sm:col-span-2")}>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label htmlFor={ids.date} className="sr-only">{t("partners.forBusiness.book.date")}</label>
          <input id={ids.date} type="date" value={date} min={earliestRequestDate()} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
          <label htmlFor={ids.time} className="sr-only">{t("partners.forBusiness.book.time")}</label>
          <select id={ids.time} value={time} onChange={(e) => setTime(e.target.value as TimeOfDay)} className={fieldClass}>
            {TIMES_OF_DAY.map((tod) => <option key={tod} value={tod}>{t(`partners.forBusiness.book.times.${tod}`)}</option>)}
          </select>
          {pets.length > 0 && (
            <>
              <label htmlFor={ids.pet} className="sr-only">{t("partners.community.pet")}</label>
              <select id={ids.pet} value={petId} onChange={(e) => setPetId(e.target.value)} className={cn(fieldClass, "sm:col-span-2")}>
                {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                <option value="">{t("partners.community.noPet")}</option>
              </select>
            </>
          )}
          <label htmlFor={ids.note} className="sr-only">{t("partners.forBusiness.book.note")}</label>
          <textarea id={ids.note} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2} placeholder={t("partners.forBusiness.book.note")} className={cn(fieldClass, "sm:col-span-2")} />
          {error && <p className="text-xs text-danger sm:col-span-2">{t("partners.community.error")}</p>}
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <Button type="submit" size="sm" loading={busy} disabled={!service}>{t("partners.forBusiness.book.send")}</Button>
            <span className="text-xs text-ink-soft">{t("partners.forBusiness.book.hint")}</span>
          </div>
        </form>
      )}
      {mine.length > 0 && (
        <ul className="flex flex-col divide-y divide-ink/8 border-t border-ink/8">
          {mine.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="text-ink">
                {r.serviceName} · {new Date(r.preferredDate).toLocaleDateString(locale, { day: "numeric", month: "short" })} · {t(`partners.forBusiness.book.times.${r.preferredTime}`)}
              </span>
              <span className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {(r.status === "requested" || r.status === "accepted") && (
                  <button type="button" onClick={async () => { await cancelRequest(db, r.id); void load(); }} className="text-xs font-semibold text-danger hover:underline">
                    {t("partners.forBusiness.book.cancel")}
                  </button>
                )}
              </span>
              {r.responseNote && <p className="w-full text-xs text-ink-soft">“{r.responseNote}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function StatusBadge({ status }: { status: BookingRequest["status"] }) {
  const { t } = useLanguage();
  const tone = status === "accepted" ? "bg-brand-soft text-brand-strong" : status === "declined" ? "bg-danger-soft text-danger" : "bg-ink/6 text-ink-soft";
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", tone)}>{t(`partners.forBusiness.status.${status}`)}</span>;
}

function ClaimPlace({ place, placeId }: { place: Partner; placeId: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<ClaimRole>("owner");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<"sent" | "already" | "owned" | "failed" | null>(null);
  const groupId = useId();

  if (outcome && outcome !== "failed") {
    return (
      <p className="text-sm text-ink-soft">
        {t(`partners.forBusiness.claim.${outcome}`)}{" "}
        <Link href="/business" className="font-semibold text-brand hover:underline">{t("partners.forBusiness.claim.open")}</Link>
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-ink-soft hover:text-brand">
        <Building2 className="h-4 w-4" aria-hidden="true" />
        {t("partners.forBusiness.claim.link")}
      </button>
    );
  }
  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-ink/8 bg-surface-2/60 p-4">
      <h3 className={headingClass}>{t("partners.forBusiness.claim.heading", { name: place.name })}</h3>
      <p className="text-sm leading-relaxed text-ink-soft">{t("partners.forBusiness.claim.intro")}</p>
      {!user ? (
        <SignInLink slug={place.slug} label={t("partners.forBusiness.claim.signIn")} />
      ) : (
        <form
          className="flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setOutcome(await claimPlace(db, { placeId, role, message }));
          }}
        >
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
            <legend id={groupId} className="mb-1 w-full text-xs font-semibold text-ink">{t("partners.forBusiness.claim.role")}</legend>
            {CLAIM_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-1.5 text-sm text-ink">
                <input type="radio" name={`claim-${placeId}`} value={r} checked={role === r} onChange={() => setRole(r)} className="accent-[var(--brand)]" />
                {t(`partners.forBusiness.claim.roles.${r}`)}
              </label>
            ))}
          </fieldset>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={1000} rows={3} placeholder={t("partners.forBusiness.claim.message")} aria-label={t("partners.forBusiness.claim.message")} className={fieldClass} />
          {outcome === "failed" && <p className="text-xs text-danger">{t("partners.community.failed")}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm">{t("partners.forBusiness.claim.send")}</Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("partners.community.cancel")}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
