"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Footprints,
  House,
  MapPin,
  PawPrint,
  Scissors,
  Search,
  StickyNote,
  Sun,
  UserX,
} from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { type ServiceType, type Profile, PUBLIC_PROFILE_COLUMNS } from "@/lib/types";
import { offeredServices, resolveService } from "@/lib/services";
import { bookingRangeProblem, toDateTimeLocalValue } from "@/lib/booking-duration";
import { sitterBlocker } from "@/lib/sitter-blocker";
import Avatar from "@/components/Avatar";
import BookingSummary from "@/components/BookingSummary";
import { useLanguage } from "@/context/LanguageContext";

interface Pet { id: string; name: string; }

/**
 * GLASS, AND WHY IT WORKS HERE.
 *
 * globals.css states the rule: glass only where something varied actually passes
 * behind it, because over flat --canvas there is nothing to refract and it renders
 * grey. Two things supply that here. The root layout paints one ambient field behind
 * every page -- the soft blooms of components/Atmosphere.tsx -- which the old opaque
 * cards simply covered up. And the sitter's own avatar is blown up and blurred behind
 * the WHOLE grid, not just their card, so the form panel and the summary both have
 * colour to sample. These panels are .glass-panel, the heavier tint, so without that
 * second layer they would read as plain white.
 *
 * NO ENTRANCE ANIMATION ON GLASS. Every variant in lib/motion.ts animates opacity,
 * and an ancestor with opacity < 1 becomes a backdrop root -- the blur samples nothing
 * until the animation finishes. A faded-in glass panel is not glass for its first
 * 450ms, so nothing here animates.
 *
 * Inputs stay solid. Text on a translucent panel over moving colour is harder to read,
 * and the 16px iOS floor in globals.css already treats fields as a special case.
 */

const SERVICE_ICONS: Record<ServiceType, React.ComponentType<{ className?: string }>> = {
  walking: Footprints,
  boarding: House,
  daycare: Sun,
  grooming: Scissors,
};

const inputBase =
  "w-full h-11 px-3.5 rounded-[var(--radius-input)] border bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:border-transparent text-sm transition";
// Two complete strings rather than appending a danger colour to the normal one: when
// two utilities set the same property, Tailwind's bundle order decides the winner, not
// the order of the class attribute.
const inputCls = `${inputBase} border-black/10 focus:ring-brand`;
const invalidInputCls = `${inputBase} border-danger/60 focus:ring-danger`;

/** Section heading inside the form panel: an icon, a label, and the optional marker. */
function FieldLabel({
  icon: Icon,
  children,
  optional,
  htmlFor,
  id,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  optional?: string;
  /** The control it names. Without it the label is decoration and the field has no name. */
  htmlFor?: string;
  /** For a group (the service tiles) that points back at the label with aria-labelledby. */
  id?: string;
}) {
  return (
    <label htmlFor={htmlFor} id={id} className="flex items-center gap-2 text-sm font-medium text-ink mb-2">
      <Icon className="w-4 h-4 text-brand" />
      {children}
      {optional && <span className="text-ink-soft/70 font-normal">{optional}</span>}
    </label>
  );
}

function NewBookingForm() {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  // undefined until the fetch answers, null when it finds nobody -- sitterBlocker needs
  // the difference, or every valid link would flash "not found" first.
  const [sitterProfile, setSitterProfile] = useState<Profile | null | undefined>(undefined);
  const [pets, setPets] = useState<Pet[]>([]);
  const [form, setForm] = useState({
    sitter_id: searchParams.get("sitter") ?? "",
    pet_id: "",
    // Empty, never "walking". A default the user did not choose is what let a booking
    // be sent for a service the sitter does not provide.
    service: "" as ServiceType | "",
    start_at: "",
    end_at: "",
    address: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Keyed on the sitter rather than on `user`, so choosing a different sitter actually
  // refetches. The old effect listed only [user], so it fetched whoever was in the URL
  // at mount and never again.
  useEffect(() => {
    if (!form.sitter_id) { setSitterProfile(null); return; }
    supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("id", form.sitter_id)
      // maybeSingle: no such profile is an answer (null), not an error. A malformed id
      // in the URL does error, and is just as much "no such sitter".
      .maybeSingle()
      .then(({ data, error }) => setSitterProfile(error ? null : ((data as Profile | null) ?? null)));
  }, [form.sitter_id]);

  useEffect(() => {
    if (!user) return;
    supabase.from("pets").select("id,name").eq("owner_id", user.id).then(({ data }) => {
      setPets(data ?? []);
      if (data?.[0]) setForm((f) => (f.pet_id ? f : { ...f, pet_id: data[0].id }));
    });
  }, [user]);

  // A profile that cannot be booked is not presented as this booking's sitter anywhere on
  // the page: no header, no services, no rate in the summary, no colour behind the glass.
  const blocker = form.sitter_id ? sitterBlocker(sitterProfile, user?.id) : null;
  const bookableSitter = blocker ? null : (sitterProfile ?? null);

  const offered = offeredServices(bookableSitter?.services);
  const offeredKey = offered.join(",");

  // Keep the held service honest as the sitter loads or changes: preselect their only
  // service, keep a still-valid choice, clear anything they do not offer. Keyed on the
  // joined list because `offered` is a fresh array every render.
  useEffect(() => {
    setForm((f) => {
      const next = resolveService(offeredKey ? (offeredKey.split(",") as ServiceType[]) : [], f.service);
      return next === f.service ? f : { ...f, service: next };
    });
  }, [offeredKey]);

  // Computed on render with a fresh clock. Safe from hydration mismatch because the
  // (app) layout renders a spinner until auth resolves, so this form never renders
  // on the server. handleSubmit asks again, in case the page sat open past the start.
  const now = new Date();
  const rangeProblem = bookingRangeProblem(form.start_at, form.end_at, now);
  const minStart = toDateTimeLocalValue(now);

  const canSubmit =
    Boolean(form.sitter_id && form.pet_id && form.service && form.start_at && form.end_at) &&
    !rangeProblem &&
    !blocker &&
    !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !form.service || blocker) return;
    if (bookingRangeProblem(form.start_at, form.end_at, new Date())) return;
    setError("");
    setLoading(true);
    const { error: err } = await supabase.from("bookings").insert({
      owner_id: user.id,
      sitter_id: form.sitter_id,
      pet_id: form.pet_id,
      service: form.service,
      start_at: new Date(form.start_at).toISOString(),
      end_at: new Date(form.end_at).toISOString(),
      address: form.address || null,
      notes: form.notes || null,
      status: "pending",
    });
    // The raw PostgREST message is English, technical, and sometimes names columns or
    // policies. Log it for whoever is debugging; show the user something they can act on.
    if (err) {
      console.error("booking insert failed", err);
      setError(t("appPages.bookingsNew.submitError"));
      setLoading(false);
      return;
    }
    router.push("/bookings");
  };

  return (
    <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-32">
      {/* The colour the glass panels refract, on top of the site-wide field.
          The first attempt blurred the sitter's avatar inside a box with overflow-hidden,
          and a blur clipped by its own container leaves hard straight edges -- measured at
          1024x512, cutting a visible line across the middle of the form panel. Inside a
          viewport-sized fixed layer the only clip is at the viewport boundary, where it is
          invisible. This layer used to carry three palette blobs as well; the root
          layout's Atmosphere now supplies that field for every page. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {/* The sitter's own colour, which is what actually makes the glass read as
            glass -- palette blobs alone leave the panels on near-flat canvas. A CIRCLE,
            not the earlier rectangle: a blurred circle has no straight edge to give
            away, so its only clip is at the viewport boundary, where clipping is
            invisible. Sized and centred so the blurred falloff lands well inside the
            layer on both sides. */}
        {bookableSitter?.avatar_url && (
          <img
            src={bookableSitter.avatar_url}
            alt=""
            className="absolute -top-24 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full object-cover blur-[90px] opacity-45 saturate-150"
          />
        )}
      </div>

      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> {t("appPages.bookingsNew.backToBookings")}
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">
        {t("appPages.bookingsNew.title")}
      </h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">{t("appPages.bookingsNew.subtitle")}</p>

      {!form.sitter_id && (
        <div className="mb-6 glass-panel border rounded-[var(--radius-card)] p-4 flex items-center gap-3">
          <Search className="w-5 h-5 text-brand flex-shrink-0" />
          <div className="flex-1 text-sm text-ink">
            {t("appPages.bookingsNew.noSitterSelected")}{" "}
            <Link href="/browse" className="text-brand-strong font-medium hover:underline">
              {t("appPages.bookingsNew.findSitterLink")}
            </Link>
          </div>
        </div>
      )}

      {blocker && (
        <div role="alert" className="mb-6 glass-panel border rounded-[var(--radius-card)] p-4 flex items-center gap-3">
          <UserX className="w-5 h-5 text-amber-strong flex-shrink-0" />
          <div className="flex-1 text-sm text-ink">
            {t(`appPages.bookingsNew.${blocker}`)}{" "}
            <Link href="/browse" className="text-brand-strong font-medium hover:underline">
              {t("appPages.bookingsNew.findSitterLink")}
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-[var(--radius-input)] text-sm text-danger">
          {error}
        </div>
      )}

      {/* Two columns from lg up: form left, summary right. Below that the summary
          follows the form rather than preceding it -- on a phone the fields are what
          you came for, and the sticky bar already carries the call to action. */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-6 items-start">
        <form onSubmit={handleSubmit} id="booking-form" className="min-w-0">
          <div className="glass-panel border rounded-[var(--radius-card)] p-6 sm:p-7 space-y-6">
            {bookableSitter && (
              <div className="flex items-center gap-3.5 pb-5 border-b border-black/5 lg:hidden">
                <Avatar
                  name={bookableSitter.full_name ?? t("appShell.sitterFallback")}
                  url={bookableSitter.avatar_url}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-ink truncate">{bookableSitter.full_name}</div>
                  <div className="text-xs text-ink-soft mt-0.5">{bookableSitter.city}</div>
                </div>
                <Link href="/browse" className="text-xs text-brand font-medium hover:underline">
                  {t("appPages.bookingsNew.changeLink")}
                </Link>
              </div>
            )}

            <div>
              <FieldLabel icon={PawPrint} htmlFor="booking-pet">{t("appPages.bookingsNew.petLabel")}</FieldLabel>
              <select
                id="booking-pet"
                value={form.pet_id}
                onChange={(e) => setForm({ ...form, pet_id: e.target.value })}
                required
                className={inputCls}
              >
                <option value="">{t("appPages.bookingsNew.selectPetOption")}</option>
                {pets.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {pets.length === 0 && (
                <p className="text-xs text-ink-soft mt-2">
                  {t("appPages.bookingsNew.noPetsYet")}{" "}
                  <Link href="/pets/new" className="text-brand hover:underline">
                    {t("appPages.bookingsNew.addPetLink")}
                  </Link>
                </p>
              )}
            </div>

            <div>
              <FieldLabel icon={CalendarDays} id="booking-service-label">
                {t("appPages.bookingsNew.serviceLabel")}
              </FieldLabel>

              {/* Three states, because "four options regardless of the sitter" was the bug. */}
              {!form.sitter_id || blocker ? (
                <p className="text-sm text-ink-soft border border-dashed border-black/15 rounded-[var(--radius-input)] px-3.5 py-3">
                  {t("appPages.bookingsNew.pickSitterFirst")}
                </p>
              ) : offered.length === 0 ? (
                <p className="text-sm text-amber-strong bg-amber-soft border border-amber/20 rounded-[var(--radius-input)] px-3.5 py-3">
                  {t("appPages.bookingsNew.noServicesOffered")}
                </p>
              ) : (
                <div
                  role="radiogroup"
                  aria-labelledby="booking-service-label"
                  className={`grid gap-2.5 ${offered.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`}
                >
                  {offered.map((key, i) => {
                    const Icon = SERVICE_ICONS[key];
                    const selected = form.service === key;
                    // Three services left the third tile alone beside an empty cell. Three
                    // columns do not fit: "Šunų vedžiojimas" wraps at a third of the panel.
                    // Never with ONE service: that grid is single-column, and a span of two
                    // would conjure an implicit second track.
                    const spansRow =
                      offered.length > 1 && offered.length % 2 === 1 && i === offered.length - 1;
                    return (
                      <label
                        key={key}
                        className={`relative flex items-center gap-2.5 p-3.5 rounded-[var(--radius-input)] border cursor-pointer text-sm font-medium transition-all ${
                          spansRow ? "sm:col-span-2" : ""
                        } ${
                          selected
                            ? "border-brand bg-brand-soft text-brand-strong shadow-[var(--shadow-sm)]"
                            : "border-black/10 bg-surface/70 text-ink-soft hover:border-black/20 hover:bg-surface"
                        }`}
                      >
                        <input
                          type="radio"
                          name="service"
                          value={key}
                          checked={selected}
                          onChange={() => setForm({ ...form, service: key })}
                          className="sr-only"
                        />
                        <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? "text-brand" : "text-ink-soft/70"}`} />
                        <span className="flex-1">{t(`common.services.${key}`)}</span>
                        {selected && <Check className="w-4 h-4 text-brand flex-shrink-0" />}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* The database refuses a reversed or past range too (20260914193216), but only
                with the generic submit error. `min` narrows the native pickers; the message
                explains a bad range first, in the site's language rather than the browser's. */}
            {/* Each message lives inside its own field, so it stays under the right
                input when the two stack on a phone. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {([
                { key: "start_at", label: "startLabel", min: minStart, problem: "startInPast" },
                { key: "end_at", label: "endLabel", min: form.start_at || minStart, problem: "endBeforeStart" },
              ] as const).map((field) => {
                const invalid = rangeProblem === field.problem;
                return (
                  <div key={field.key}>
                    <FieldLabel icon={Clock} htmlFor={`booking-${field.key}`}>
                      {t(`appPages.bookingsNew.${field.label}`)}
                    </FieldLabel>
                    <input
                      id={`booking-${field.key}`}
                      type="datetime-local"
                      value={form[field.key]}
                      min={field.min}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      required
                      aria-invalid={invalid || undefined}
                      aria-describedby={invalid ? `${field.key}-problem` : undefined}
                      className={invalid ? invalidInputCls : inputCls}
                    />
                    {invalid && (
                      <p id={`${field.key}-problem`} role="alert" className="mt-1.5 text-xs text-danger">
                        {t(`appPages.bookingsNew.${field.problem}`)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div>
              <FieldLabel icon={MapPin} optional={t("appPages.bookingsNew.optionalSuffix")} htmlFor="booking-address">
                {t("appPages.bookingsNew.addressLabel")}
              </FieldLabel>
              <input
                id="booking-address"
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder={t("appPages.bookingsNew.addressPlaceholder")}
                className={inputCls}
              />
            </div>

            <div>
              <FieldLabel icon={StickyNote} optional={t("appPages.bookingsNew.optionalSuffix")} htmlFor="booking-notes">
                {t("appPages.bookingsNew.notesLabel")}
              </FieldLabel>
              <textarea
                id="booking-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("appPages.bookingsNew.notesPlaceholder")}
                rows={3}
                className="w-full px-3.5 py-3 rounded-[var(--radius-input)] border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none"
              />
            </div>
          </div>
        </form>

        {/* Sticky so it stays beside the fields while they scroll. top-8 clears the
            mobile header's height on the breakpoint where stickiness applies. */}
        <div className="lg:sticky lg:top-8">
          <BookingSummary
            sitter={bookableSitter}
            service={form.service}
            startAt={form.start_at}
            endAt={form.end_at}
          />
        </div>
      </div>

      {/* Sticky action bar: .glass's documented role, chrome that content scrolls
          beneath. lg:pl-64 mirrors the sidebar offset in (app)/layout.tsx so the bar
          does not run underneath it. */}
      <div className="fixed bottom-0 inset-x-0 lg:pl-64 z-30">
        <div className="glass border-t px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {/* Full-width on a phone, where thumbs want the whole row; auto-width and
              right-aligned from sm up, because a 900px primary button looks broken. */}
          <div className="max-w-5xl mx-auto flex gap-3 sm:justify-end">
            <Link
              href="/bookings"
              className="flex-1 sm:flex-none sm:px-8 h-11 flex items-center justify-center rounded-[var(--radius-input)] border border-black/10 bg-surface/70 text-ink text-sm font-medium hover:bg-surface transition-colors"
            >
              {t("appPages.bookingsNew.cancelButton")}
            </Link>
            <button
              type="submit"
              form="booking-form"
              disabled={!canSubmit}
              className="flex-1 sm:flex-none sm:px-10 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-[var(--radius-input)] text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><CalendarDays className="w-4 h-4" />{t("appPages.bookingsNew.sendRequestButton")}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewBookingPage() {
  return <Suspense><NewBookingForm /></Suspense>;
}
