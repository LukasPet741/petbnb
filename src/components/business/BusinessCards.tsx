"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { StatusBadge } from "@/components/partners/PlaceBusinessActions";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import type { CommunityClient } from "@/lib/placeCommunity";
import { addService, deleteService, respondToRequest, updateOwnedPlace, type BookingRequest, type OwnedPlace } from "@/lib/placeBusiness";
import { cn } from "@/lib/utils";

/** The business tables are not in database.types.ts until it is regenerated; see CommunityClient. */
const db = supabase as unknown as CommunityClient;

const SPECIES = ["dog", "cat", "small_mammal", "bird", "reptile"] as const;
const fieldClass =
  "w-full rounded-[var(--radius-input)] border border-ink/12 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";
export const cardClass = "glass-card rounded-[var(--radius-card)] border p-5";
export const headingClass = "font-display text-base font-semibold tracking-tight text-ink";

/** My business: one owned place to edit (its words, accepted pets, services). */
export function OwnedPlaceCard({ place, onSaved }: { place: OwnedPlace; onSaved: () => void }) {
  const { t, locale } = useLanguage();
  const [form, setForm] = useState({
    descriptionLt: place.descriptionLt, descriptionEn: place.descriptionEn, hoursLt: place.hoursLt, hoursEn: place.hoursEn,
    website: place.website, accepts: place.accepts,
  });
  const [state, setState] = useState<"idle" | "busy" | "saved" | "error" | "website">("idle");
  const [service, setService] = useState({ name: "", price: "" });
  const id = useId();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={headingClass}>{place.name}</h2>
        <Link href={`/partners?p=${place.slug}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
          {t("partners.forBusiness.page.seePage")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setState("busy");
          const err = await updateOwnedPlace(db, place.id, form);
          setState(err ? (err.code === "website" ? "website" : "error") : "saved");
          if (!err) onSaved();
        }}
      >
        {(["descriptionLt", "descriptionEn"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-medium text-ink-soft sm:col-span-1">
            {t(`partners.forBusiness.page.fields.${k}`)}
            <textarea value={form[k]} onChange={set(k)} rows={4} maxLength={1500} className={fieldClass} />
          </label>
        ))}
        {(["hoursLt", "hoursEn"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-medium text-ink-soft">
            {t(`partners.forBusiness.page.fields.${k}`)}
            <input value={form[k]} onChange={set(k)} maxLength={120} className={fieldClass} />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-soft sm:col-span-2">
          {t("partners.forBusiness.page.fields.website")}
          <input type="url" value={form.website} onChange={set("website")} placeholder="https://" className={fieldClass} />
        </label>
        <div role="group" aria-labelledby={`${id}-accepts`} className="flex flex-col gap-1.5 sm:col-span-2">
          <span id={`${id}-accepts`} className="text-xs font-medium text-ink-soft">{t("partners.forBusiness.page.fields.accepts")}</span>
          <div className="flex flex-wrap gap-2">
            {SPECIES.map((s) => (
              <Chip key={s} pressed={form.accepts.includes(s)} onClick={() => setForm({
                ...form, accepts: form.accepts.includes(s) ? form.accepts.filter((x) => x !== s) : [...form.accepts, s],
              })}>
                {t(`partners.filter.${s}`)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" size="sm" loading={state === "busy"}>{t("partners.community.save")}</Button>
          {state === "saved" && <span className="text-xs text-brand-strong">{t("partners.forBusiness.page.saved")}</span>}
          {state === "website" && <span className="text-xs text-danger">{t("partners.forBusiness.page.httpsOnly")}</span>}
          {state === "error" && <span className="text-xs text-danger">{t("partners.community.error")}</span>}
        </div>
      </form>

      <div className="mt-5 border-t border-ink/8 pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("partners.services")}</h3>
        <ul className="mt-2 flex flex-col divide-y divide-ink/8">
          {place.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="text-ink">{locale === "lt" ? s.nameLt : s.nameEn}{s.priceFrom != null && <span className="text-ink-soft"> · €{s.priceFrom}</span>}</span>
              <button type="button" aria-label={t("partners.community.delete")} onClick={async () => { await deleteService(db, s.id); onSaved(); }} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex flex-wrap gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!service.name.trim()) return;
            const price = service.price.trim() === "" ? null : Number(service.price);
            await addService(db, place.id, { name: service.name, priceFrom: Number.isFinite(price) ? price : null, sortOrder: place.services.length + 1 });
            setService({ name: "", price: "" });
            onSaved();
          }}
        >
          <input value={service.name} onChange={(e) => setService({ ...service, name: e.target.value })} placeholder={t("partners.forBusiness.page.serviceName")} aria-label={t("partners.forBusiness.page.serviceName")} className={cn(fieldClass, "min-w-0 flex-1")} />
          <input value={service.price} onChange={(e) => setService({ ...service, price: e.target.value })} inputMode="decimal" placeholder={t("partners.forBusiness.page.priceFrom")} aria-label={t("partners.forBusiness.page.priceFrom")} className={cn(fieldClass, "w-28")} />
          <Button type="submit" size="sm" variant="secondary" disabled={!service.name.trim()}>{t("partners.forBusiness.page.addService")}</Button>
        </form>
      </div>
    </section>
  );
}

/** My business: booking requests for the owner's places, to accept or decline with a note. */
export function RequestsCard({ requests, onAnswered }: { requests: BookingRequest[]; onAnswered: () => void }) {
  const { t, locale } = useLanguage();
  const [notes, setNotes] = useState<Record<string, string>>({});
  return (
    <section className={cardClass}>
      <h2 className={headingClass}>{t("partners.forBusiness.page.requests")}</h2>
      {requests.length === 0 ? (
        <p className="mt-2 text-sm text-ink-soft">{t("partners.forBusiness.page.noRequests")}</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-ink/8">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">
                  {new Date(r.preferredDate).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })} · {t(`partners.forBusiness.book.times.${r.preferredTime}`)}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <span className="text-sm text-ink">
                {r.serviceName} · {r.requester}
                {r.petName && ` · ${r.petName}${r.petWeightKg ? `, ${r.petWeightKg} kg` : ""}`}
              </span>
              {r.note && <p className="text-sm text-ink-soft">“{r.note}”</p>}
              {r.status === "requested" && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={notes[r.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                    maxLength={500}
                    placeholder={t("partners.forBusiness.page.replyNote")}
                    aria-label={t("partners.forBusiness.page.replyNote")}
                    className={cn(fieldClass, "min-w-0 flex-1")}
                  />
                  <Button size="sm" onClick={async () => { await respondToRequest(db, r.id, true, notes[r.id] ?? ""); onAnswered(); }}>{t("partners.forBusiness.page.accept")}</Button>
                  <Button size="sm" variant="danger-soft" onClick={async () => { await respondToRequest(db, r.id, false, notes[r.id] ?? ""); onAnswered(); }}>{t("partners.forBusiness.page.decline")}</Button>
                </div>
              )}
              {r.responseNote && <p className="text-xs text-ink-soft">{t("partners.forBusiness.page.yourReply")}: “{r.responseNote}”</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
