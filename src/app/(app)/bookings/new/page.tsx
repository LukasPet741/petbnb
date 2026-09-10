"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Search } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_LABELS, type ServiceType, type Profile, PUBLIC_PROFILE_COLUMNS } from "@/lib/types";
import Avatar from "@/components/Avatar";
import { useLanguage } from "@/context/LanguageContext";

interface Pet { id: string; name: string; }
const SERVICE_KEYS = Object.keys(SERVICE_LABELS) as ServiceType[];
const inputCls = "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";

function NewBookingForm() {
  const { t } = useLanguage();
  const SERVICES = SERVICE_KEYS.map((k) => [k, t(`common.services.${k}`)] as [ServiceType, string]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [sitterProfile, setSitterProfile] = useState<Profile | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [form, setForm] = useState({
    sitter_id: searchParams.get("sitter") ?? "",
    pet_id: "",
    service: "walking" as ServiceType,
    start_at: "",
    end_at: "",
    address: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (form.sitter_id) {
      supabase.from("profiles").select(PUBLIC_PROFILE_COLUMNS).eq("id", form.sitter_id).single().then(({ data }) => setSitterProfile(data as Profile));
    }
    if (user) supabase.from("pets").select("id,name").eq("owner_id", user.id).then(({ data }) => {
      setPets(data ?? []);
      if (data?.[0]) setForm((f) => ({ ...f, pet_id: data[0].id }));
    });
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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
    if (err) { setError(err.message); setLoading(false); return; }
    router.push("/bookings");
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/bookings" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.bookingsNew.backToBookings")}
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{t("appPages.bookingsNew.title")}</h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">{t("appPages.bookingsNew.subtitle")}</p>

      {!form.sitter_id && (
        <div className="mb-6 p-4 bg-brand-soft rounded-2xl flex items-center gap-3">
          <Search className="w-5 h-5 text-brand flex-shrink-0" />
          <div className="flex-1 text-sm text-ink">
            {t("appPages.bookingsNew.noSitterSelected")} <Link href="/browse" className="text-brand-strong font-medium hover:underline">{t("appPages.bookingsNew.findSitterLink")}</Link>
          </div>
        </div>
      )}

      {sitterProfile && (
        <div className="mb-6 bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-4 flex items-center gap-3.5">
          <Avatar name={sitterProfile.full_name ?? t("appShell.sitterFallback")} url={sitterProfile.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink">{sitterProfile.full_name}</div>
            <div className="text-xs text-ink-soft mt-0.5">{sitterProfile.city} · €{sitterProfile.rate_per_hour}{t("sitters.profile.ratePerHourShort")}</div>
          </div>
          <Link href="/browse" className="text-xs text-brand font-medium hover:underline">{t("appPages.bookingsNew.changeLink")}</Link>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 sm:p-7 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.bookingsNew.petLabel")}</label>
            <select value={form.pet_id} onChange={(e) => setForm({ ...form, pet_id: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">{t("appPages.bookingsNew.selectPetOption")}</option>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {pets.length === 0 && <p className="text-xs text-ink-soft mt-2">{t("appPages.bookingsNew.noPetsYet")} <Link href="/pets/new" className="text-brand hover:underline">{t("appPages.bookingsNew.addPetLink")}</Link></p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">{t("appPages.bookingsNew.serviceLabel")}</label>
            <div className="grid grid-cols-2 gap-2.5">
              {SERVICES.map(([k, v]) => (
                <label key={k} className={`p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all text-center ${form.service === k ? "border-brand bg-brand-soft text-brand-strong" : "border-black/10 text-ink-soft hover:border-black/20"}`}>
                  <input type="radio" name="service" value={k} checked={form.service === k} onChange={() => setForm({ ...form, service: k })} className="sr-only" />{v}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.bookingsNew.startLabel")}</label>
              <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.bookingsNew.endLabel")}</label>
              <input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.bookingsNew.addressLabel")} <span className="text-ink-soft/70 font-normal">{t("appPages.bookingsNew.optionalSuffix")}</span></label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder={t("appPages.bookingsNew.addressPlaceholder")} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.bookingsNew.notesLabel")} <span className="text-ink-soft/70 font-normal">{t("appPages.bookingsNew.optionalSuffix")}</span></label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t("appPages.bookingsNew.notesPlaceholder")} rows={3} className="w-full px-3.5 py-3 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none" />
          </div>
        </div>

        {sitterProfile && (
          <div className="bg-surface-2 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">{t("appPages.bookingsNew.rateSummaryLabel", { name: sitterProfile.full_name ?? "" })}</span>
              <span className="font-semibold text-ink">€{sitterProfile.rate_per_hour}{t("sitters.profile.ratePerHourShort")}</span>
            </div>
            <p className="text-xs text-ink-soft/70 mt-1.5">{t("appPages.bookingsNew.finalPriceNote")}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/bookings" className="flex-1 h-11 flex items-center justify-center rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-brand-softer transition-colors">{t("appPages.bookingsNew.cancelButton")}</Link>
          <button type="submit" disabled={loading || !form.sitter_id || !form.pet_id} className="flex-1 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CalendarDays className="w-4 h-4" />{t("appPages.bookingsNew.sendRequestButton")}</>}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewBookingPage() {
  return <Suspense><NewBookingForm /></Suspense>;
}
