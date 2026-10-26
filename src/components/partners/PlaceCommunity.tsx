"use client";
import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Cat, Dog, Flag, PawPrint } from "lucide-react";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import StarInput from "@/components/StarInput";
import RatingSummary from "@/components/RatingSummary";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { supabase } from "@/lib/supabase";
import {
  REPORT_REASONS, addPost, deletePost, deleteReview, fetchCommunity, fetchMyPetPlaces, fetchMyPets, fetchMyReview,
  reportContent, saveReview, setPetPlace, setPetPublic,
  type CommunityClient, type MyPet, type MyReview, type PlaceCommunity as Community, type ReportReason,
} from "@/lib/placeCommunity";
import { cn } from "@/lib/utils";

/** The community tables are not in database.types.ts until it is regenerated; see CommunityClient. */
const db = supabase as unknown as CommunityClient;

const MAX_POST = 280;
const fieldClass =
  "w-full rounded-[var(--radius-input)] border border-ink/12 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand";
const headingClass = "text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft";

/**
 * A place's community, inside its panel (ecosystem plan, "Social, kept small at first"): reviews
 * from signed-in owners, visits shared at the pin, and the public pets that come here. Everything
 * can be reported. Until the community migration is live the read answers nothing and this whole
 * section stays out of the panel.
 */
export default function PlaceCommunity({ slug }: { slug: string }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null>(null);
  const [mine, setMine] = useState<MyReview | null>(null);
  const [myPets, setMyPets] = useState<MyPet[]>([]);
  const [petsHere, setPetsHere] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const next = await fetchCommunity(db, slug);
    setCommunity(next);
    if (next && user) {
      const [review, pets, here] = await Promise.all([
        fetchMyReview(db, next.placeId, user.id),
        fetchMyPets(db, user.id),
        fetchMyPetPlaces(db, next.placeId),
      ]);
      setMine(review);
      setMyPets(pets);
      setPetsHere(here);
    }
  }, [slug, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!community) return null;

  return (
    <div className="flex flex-col gap-6 border-t border-ink/8 pt-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className={headingClass}>{t("partners.community.heading")}</h3>
          <RatingSummary average={community.average} count={community.count} />
        </div>
        {user ? (
          <MyReviewForm placeId={community.placeId} mine={mine} onSaved={load} />
        ) : (
          <Link href="/login" className="text-sm font-semibold text-brand underline-offset-4 hover:underline">{t("partners.community.signIn")}</Link>
        )}
        {community.reviews.filter((r) => !r.mine).length === 0 && !mine ? (
          <p className="text-sm text-ink-soft">{t("partners.community.noReviews")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink/8">
            {community.reviews.filter((r) => !r.mine).map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-ink">{r.author}</span>
                  <Stars rating={r.rating} />
                </div>
                {r.body && <p className="text-sm leading-relaxed text-ink">{r.body}</p>}
                <Meta date={r.createdAt}>{user && <ReportButton targetType="place_review" targetId={r.id} />}</Meta>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={headingClass}>{t("partners.community.visits")}</h3>
        {user && <VisitForm placeId={community.placeId} pets={myPets} onShared={load} />}
        {community.posts.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("partners.community.noVisits")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-ink/8">
            {community.posts.map((p) => (
              <li key={p.id} className="flex flex-col gap-1 py-3">
                <span className="text-sm text-ink">
                  <span className="font-medium">{p.author}</span>
                  {p.petName && (
                    <>
                      {" "}
                      {p.petId ? (
                        <Link href={`/p/${p.petId}`} className="text-brand underline-offset-4 hover:underline">
                          {t("partners.community.withPet", { pet: p.petName })}
                        </Link>
                      ) : (
                        t("partners.community.withPet", { pet: p.petName })
                      )}
                    </>
                  )}
                </span>
                <p className="text-sm leading-relaxed text-ink">{p.body}</p>
                <Meta date={p.createdAt}>
                  {p.mine ? (
                    <button type="button" onClick={async () => { await deletePost(db, p.id); void load(); }} className="text-xs font-semibold text-danger hover:underline">
                      {t("partners.community.delete")}
                    </button>
                  ) : (
                    user && <ReportButton targetType="place_post" targetId={p.id} />
                  )}
                </Meta>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={headingClass}>{t("partners.community.pets")}</h3>
        {community.pets.length === 0 ? (
          <p className="text-sm text-ink-soft">{t("partners.community.noPets")}</p>
        ) : (
          <ul className="flex flex-wrap gap-3">
            {community.pets.map((pet) => (
              <li key={pet.id}>
                <Link href={`/p/${pet.id}`} className="group flex w-16 flex-col items-center gap-1">
                  <PetAvatar name={pet.name} type={pet.type} photoUrl={pet.photoUrl} />
                  <span className="w-full truncate text-center text-xs font-medium text-ink group-hover:text-brand">{pet.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {user && myPets.length > 0 && (
          <MyPetsHere placeId={community.placeId} pets={myPets} here={petsHere} onChanged={load} />
        )}
      </section>

      <p className="text-xs leading-relaxed text-ink-soft">{t("partners.community.rules")}</p>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span role="img" className="text-sm tracking-tight text-amber-strong" aria-label={`${rating}/5`}>
      {"★".repeat(rating)}
      <span className="text-ink/20">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

function Meta({ date, children }: { date: string; children?: React.ReactNode }) {
  const { locale } = useLanguage();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-soft">
      <time dateTime={date}>{new Date(date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}</time>
      {children}
    </div>
  );
}

function PetAvatar({ name, type, photoUrl, className }: { name: string; type: string; photoUrl: string | null; className?: string }) {
  if (photoUrl) {
    return <img src={photoUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className={cn("h-14 w-14 rounded-full object-cover ring-1 ring-ink/8", className)} />;
  }
  const Icon = type === "cat" ? Cat : type === "dog" ? Dog : PawPrint;
  return (
    <span aria-hidden="true" title={name} className={cn("grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand-strong", className)}>
      <Icon className="h-6 w-6" />
    </span>
  );
}

function MyReviewForm({ placeId, mine, onSaved }: { placeId: string; mine: MyReview | null; onSaved: () => void }) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(!mine);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const bodyId = useId();

  useEffect(() => {
    setEditing(!mine);
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? "");
  }, [mine]);

  if (mine && !editing) {
    return (
      <div className="rounded-[var(--radius-input)] border border-ink/8 bg-surface-2/60 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-ink">{t("partners.community.yourReview")}</span>
          <Stars rating={mine.rating} />
        </div>
        {mine.body && <p className="mt-1 text-sm leading-relaxed text-ink">{mine.body}</p>}
        {mine.hiddenReason && (
          <p className="mt-2 rounded-[var(--radius-input)] bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
            {t("partners.community.hidden", { reason: mine.hiddenReason })}
          </p>
        )}
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-brand hover:underline">{t("partners.community.edit")}</button>
          <button
            type="button"
            onClick={async () => { await deleteReview(db, mine.id); onSaved(); }}
            className="text-xs font-semibold text-danger hover:underline"
          >
            {t("partners.community.delete")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2 rounded-[var(--radius-input)] border border-ink/8 bg-surface-2/60 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (rating === 0) return;
        setBusy(true);
        const err = await saveReview(db, { placeId, rating, body, reviewId: mine?.id });
        setBusy(false);
        setError(Boolean(err));
        if (!err) onSaved();
      }}
    >
      <StarInput value={rating} onChange={setRating} label={t("partners.community.rate")} name={`place-review-${placeId}`} />
      <label htmlFor={bodyId} className="sr-only">{t("partners.community.reviewPlaceholder")}</label>
      <textarea id={bodyId} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={2} placeholder={t("partners.community.reviewPlaceholder")} className={fieldClass} />
      {error && <p className="text-xs text-danger">{t("partners.community.error")}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={busy} disabled={rating === 0}>
          {mine ? t("partners.community.save") : t("partners.community.postReview")}
        </Button>
        {mine && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>{t("partners.community.cancel")}</Button>}
      </div>
    </form>
  );
}

function VisitForm({ placeId, pets, onShared }: { placeId: string; pets: MyPet[]; onShared: () => void }) {
  const { t } = useLanguage();
  const [body, setBody] = useState("");
  const [petId, setPetId] = useState<string>(pets[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const bodyId = useId();
  const petFieldId = useId();

  useEffect(() => {
    if (!petId && pets[0]) setPetId(pets[0].id);
  }, [pets, petId]);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        const err = await addPost(db, { placeId, body, petId: petId || null });
        setBusy(false);
        setError(Boolean(err));
        if (!err) {
          setBody("");
          onShared();
        }
      }}
    >
      <label htmlFor={bodyId} className="sr-only">{t("partners.community.visitPlaceholder")}</label>
      <textarea id={bodyId} value={body} onChange={(e) => setBody(e.target.value)} maxLength={MAX_POST} rows={2} placeholder={t("partners.community.visitPlaceholder")} className={fieldClass} />
      <div className="flex flex-wrap items-center gap-2">
        {pets.length > 0 && (
          <>
            <label htmlFor={petFieldId} className="sr-only">{t("partners.community.pet")}</label>
            <select id={petFieldId} value={petId} onChange={(e) => setPetId(e.target.value)} className={cn(fieldClass, "w-auto py-1.5")}>
              {pets.map((p) => <option key={p.id} value={p.id}>{t("partners.community.withPet", { pet: p.name })}</option>)}
              <option value="">{t("partners.community.noPet")}</option>
            </select>
          </>
        )}
        <span className="ml-auto text-xs text-ink-soft">{body.length}/{MAX_POST}</span>
        <Button type="submit" size="sm" loading={busy} disabled={!body.trim()}>{t("partners.community.share")}</Button>
      </div>
      {error && <p className="text-xs text-danger">{t("partners.community.error")}</p>}
    </form>
  );
}

function MyPetsHere({ placeId, pets, here, onChanged }: { placeId: string; pets: MyPet[]; here: Set<string>; onChanged: () => void }) {
  const { t } = useLanguage();
  const privateHere = pets.filter((p) => here.has(p.id) && !p.isPublic);
  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-input)] border border-ink/8 bg-surface-2/60 p-3">
      <span className="text-xs font-medium text-ink-soft">{t("partners.community.yourPets")}</span>
      <div role="group" aria-label={t("partners.community.yourPets")} className="flex flex-wrap gap-2">
        {pets.map((pet) => (
          <Chip key={pet.id} pressed={here.has(pet.id)} onClick={async () => { await setPetPlace(db, pet.id, placeId, !here.has(pet.id)); onChanged(); }}>
            {pet.name}
          </Chip>
        ))}
      </div>
      {privateHere.map((pet) => (
        <p key={pet.id} className="flex flex-wrap items-center gap-x-2 text-xs text-ink-soft">
          {t("partners.community.privateHint", { name: pet.name })}
          <button type="button" onClick={async () => { await setPetPublic(db, pet.id, true); onChanged(); }} className="font-semibold text-brand hover:underline">
            {t("partners.community.makePublic", { name: pet.name })}
          </button>
        </p>
      ))}
    </div>
  );
}

function ReportButton({ targetType, targetId }: { targetType: "place_review" | "place_post"; targetId: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const [outcome, setOutcome] = useState<"sent" | "already" | "failed" | null>(null);
  const groupId = useId();

  if (outcome === "sent" || outcome === "already") {
    return <span className="text-xs text-ink-soft">{t(`partners.community.${outcome === "sent" ? "reported" : "already"}`)}</span>;
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-danger">
        <Flag className="h-3 w-3" aria-hidden="true" />
        {t("partners.community.report")}
      </button>
    );
  }
  return (
    <form
      className="mt-2 flex w-full basis-full flex-col gap-2 rounded-[var(--radius-input)] border border-ink/12 bg-surface p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setOutcome(await reportContent(db, { targetType, targetId, reason, details }));
      }}
    >
      <fieldset className="flex flex-col gap-1">
        <legend id={groupId} className="mb-1 text-xs font-semibold text-ink">{t("partners.community.reportTitle")}</legend>
        {REPORT_REASONS.map((r) => (
          <label key={r} className="flex items-center gap-2 text-xs text-ink">
            <input type="radio" name={`report-${targetId}`} value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[var(--brand)]" />
            {t(`partners.community.reasons.${r}`)}
          </label>
        ))}
      </fieldset>
      <textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} rows={2} placeholder={t("partners.community.details")} aria-label={t("partners.community.details")} className={fieldClass} />
      {outcome === "failed" && <p className="text-xs text-danger">{t("partners.community.failed")}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="danger-soft">{t("partners.community.send")}</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("partners.community.cancel")}</Button>
      </div>
    </form>
  );
}
