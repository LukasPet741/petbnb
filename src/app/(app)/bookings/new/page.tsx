"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays, Search } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_LABELS, type ServiceType, type Profile } from "@/lib/types";
import Avatar from "@/components/Avatar";

interface Pet { id: string; name: string; }
const SERVICES = Object.entries(SERVICE_LABELS) as [ServiceType, string][];
const inputCls = "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";

function NewBookingForm() {
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
      supabase.from("profiles").select("*").eq("id", form.sitter_id).single().then(({ data }) => setSitterProfile(data as Profile));
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
        <ArrowLeft className="w-4 h-4" /> Back to bookings
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">Request a booking</h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">Choose your pet and the service you need — the sitter confirms next.</p>

      {!form.sitter_id && (
        <div className="mb-6 p-4 bg-brand-soft rounded-2xl flex items-center gap-3">
          <Search className="w-5 h-5 text-brand flex-shrink-0" />
          <div className="flex-1 text-sm text-ink">
            No sitter selected yet. <Link href="/browse" className="text-brand-strong font-medium hover:underline">Find a sitter →</Link>
          </div>
        </div>
      )}

      {sitterProfile && (
        <div className="mb-6 bg-surface rounded-2xl border border-black/5 shadow-sm p-4 flex items-center gap-3.5">
          <Avatar name={sitterProfile.full_name ?? "Sitter"} url={sitterProfile.avatar_url} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-ink">{sitterProfile.full_name}</div>
            <div className="text-xs text-ink-soft mt-0.5">{sitterProfile.city} · €{sitterProfile.rate_per_hour}/hr</div>
          </div>
          <Link href="/browse" className="text-xs text-brand font-medium hover:underline">Change</Link>
        </div>
      )}

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-surface rounded-2xl border border-black/5 shadow-sm p-6 sm:p-7 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Pet</label>
            <select value={form.pet_id} onChange={(e) => setForm({ ...form, pet_id: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand">
              <option value="">Select a pet…</option>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {pets.length === 0 && <p className="text-xs text-ink-soft mt-2">No pets yet. <Link href="/pets/new" className="text-brand hover:underline">Add one first →</Link></p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-2">Service</label>
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
              <label className="block text-sm font-medium text-ink mb-1.5">Start</label>
              <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">End</label>
              <input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Address <span className="text-ink-soft/70 font-normal">· optional</span></label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Vingio parkas, Vilnius" className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Notes <span className="text-ink-soft/70 font-normal">· optional</span></label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special instructions for the sitter…" rows={3} className="w-full px-3.5 py-3 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none" />
          </div>
        </div>

        {sitterProfile && (
          <div className="bg-surface-2 rounded-2xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-soft">Rate · {sitterProfile.full_name}</span>
              <span className="font-semibold text-ink">€{sitterProfile.rate_per_hour}/hr</span>
            </div>
            <p className="text-xs text-ink-soft/70 mt-1.5">Final price depends on the booking duration.</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/bookings" className="flex-1 h-11 flex items-center justify-center rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-brand-softer transition-colors">Cancel</Link>
          <button type="submit" disabled={loading || !form.sitter_id || !form.pet_id} className="flex-1 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><CalendarDays className="w-4 h-4" />Send request</>}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NewBookingPage() {
  return <Suspense><NewBookingForm /></Suspense>;
}
