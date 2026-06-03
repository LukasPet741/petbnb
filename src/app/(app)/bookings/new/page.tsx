"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { SERVICE_LABELS, type ServiceType, type Profile } from "@/lib/mock-data";
import Avatar from "@/components/Avatar";

interface Pet { id: string; name: string; }
const SERVICES = Object.entries(SERVICE_LABELS) as [ServiceType, string][];

function NewBookingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [sitters, setSitters] = useState<Profile[]>([]);
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
    supabase.from("profiles").select("*").eq("is_sitter", true).then(({ data }) => setSitters((data ?? []) as Profile[]));
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

  const selectedSitter = sitters.find((s) => s.id === form.sitter_id);

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <Link href="/bookings" className="inline-flex items-center gap-2 text-sm text-stone-500 hover:text-stone-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to bookings
      </Link>
      <h1 className="text-2xl font-bold text-stone-900 mb-2">Create a booking</h1>
      <p className="text-stone-500 text-sm mb-6">Choose a sitter, your pet, and the service you need.</p>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-stone-900">Select a sitter</h2>
          {sitters.length === 0 ? <p className="text-sm text-stone-400">No sitters available yet.</p> : sitters.map((s) => (
            <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${form.sitter_id === s.id ? "border-[#D95F3B] bg-orange-50" : "border-stone-100 hover:border-stone-200 bg-white"}`}>
              <input type="radio" name="sitter" value={s.id} checked={form.sitter_id === s.id} onChange={() => setForm({ ...form, sitter_id: s.id })} className="sr-only" />
              <Avatar name={s.full_name ?? "Sitter"} url={s.avatar_url} size="md" />
              <div className="flex-1">
                <div className="text-sm font-medium text-stone-900">{s.full_name}</div>
                <div className="text-xs text-stone-500">{s.city} · £{s.rate_per_hour}/hr</div>
              </div>
              {form.sitter_id === s.id && <div className="w-5 h-5 bg-[#D95F3B] rounded-full flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full" /></div>}
            </label>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-stone-900">Booking details</h2>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Pet *</label>
            <select value={form.pet_id} onChange={(e) => setForm({ ...form, pet_id: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D95F3B]">
              <option value="">Select a pet…</option>
              {pets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {pets.length === 0 && <p className="text-xs text-stone-400 mt-1.5">No pets yet. <Link href="/pets/new" className="text-[#D95F3B] hover:underline">Add one first →</Link></p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Service *</label>
            <div className="grid grid-cols-2 gap-2">
              {SERVICES.map(([k, v]) => (
                <label key={k} className={`p-3 rounded-xl border cursor-pointer text-sm font-medium transition-all text-center ${form.service === k ? "border-[#D95F3B] bg-orange-50 text-[#D95F3B]" : "border-stone-100 text-stone-600 hover:border-stone-200"}`}>
                  <input type="radio" name="service" value={k} checked={form.service === k} onChange={() => setForm({ ...form, service: k })} className="sr-only" />{v}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Start *</label>
              <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D95F3B]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">End *</label>
              <input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} required className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#D95F3B]" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Address <span className="text-stone-400 font-normal">optional</span></label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="e.g. Hyde Park, London" className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Notes <span className="text-stone-400 font-normal">optional</span></label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any special instructions for the sitter..." rows={3} className="w-full px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition resize-none" />
          </div>
        </div>

        {selectedSitter && (
          <div className="bg-stone-50 rounded-xl border border-stone-100 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-stone-600">Rate · {selectedSitter.full_name}</span>
              <span className="font-semibold text-stone-900">£{selectedSitter.rate_per_hour}/hr</span>
            </div>
            <p className="text-xs text-stone-400 mt-1.5">Final price depends on booking duration.</p>
          </div>
        )}

        <div className="flex gap-3">
          <Link href="/bookings" className="flex-1 h-11 flex items-center justify-center rounded-xl border border-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-50 transition-colors">Cancel</Link>
          <button type="submit" disabled={loading || !form.sitter_id || !form.pet_id} className="flex-1 h-11 flex items-center justify-center gap-2 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
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
