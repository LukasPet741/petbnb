"use client";
import { useState, useEffect } from "react";
import { Camera, Save, User, Briefcase, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { SERVICE_LABELS, type ServiceType } from "@/lib/mock-data";
import Avatar from "@/components/Avatar";
import { fadeUp, stagger } from "@/lib/motion";

const SERVICES = Object.entries(SERVICE_LABELS) as [ServiceType, string][];

export default function ProfilePage() {
  const { user } = useAuth();
  const { profile, refresh } = useProfile();
  const router = useRouter();
  const [tab, setTab] = useState<"personal" | "sitter">("personal");
  const [isSitter, setIsSitter] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", city: "", about_me: "", rate_per_hour: "", experience_years: "", services: { walking: false, boarding: false, daycare: false, grooming: false } as Record<ServiceType, boolean> });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    setIsSitter(profile.is_sitter ?? false);
    setForm({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      city: profile.city ?? "",
      about_me: profile.about_me ?? "",
      rate_per_hour: profile.rate_per_hour?.toString() ?? "",
      experience_years: profile.experience_years?.toString() ?? "",
      services: Object.assign({ walking: false, boarding: false, daycare: false, grooming: false } as Record<ServiceType, boolean>, (profile.services as Record<ServiceType, boolean> ?? {})),
    });
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true); setError("");
    const { error: err } = await supabase.from("profiles").upsert({
      id: user.id, full_name: form.full_name, phone: form.phone, city: form.city,
      about_me: form.about_me || null, is_sitter: isSitter,
      rate_per_hour: form.rate_per_hour ? Number(form.rate_per_hour) : null,
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      services: form.services, last_active_at: new Date().toISOString(),
    });
    if (err) { setError(err.message); setSaving(false); return; }
    await refresh();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    setSaving(false);
  };

  const handleSignOut = async () => { await signOut(); router.push("/login"); };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <motion.div className="flex items-center justify-between mb-6" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <h1 className="text-2xl font-bold text-stone-900">My profile</h1>
        <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors">
          <LogOut className="w-4 h-4" />Sign out
        </motion.button>
      </motion.div>

      {/* Avatar card */}
      <motion.div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 mb-6"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
        <div className="flex items-center gap-5">
          <div className="relative">
            <motion.div whileHover={{ scale: 1.05 }} transition={{ type: "spring", stiffness: 300 }}>
              <Avatar name={form.full_name || "You"} url={profile?.avatar_url} size="xl" />
            </motion.div>
            <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#D95F3B] rounded-full flex items-center justify-center shadow-sm hover:bg-[#c4482a] transition-colors">
              <Camera className="w-4 h-4 text-white" />
            </motion.button>
          </div>
          <div>
            <h2 className="font-semibold text-stone-900 text-lg">{form.full_name || "Complete your profile"}</h2>
            <p className="text-stone-500 text-sm">{form.city || "No city set"}</p>
            <p className="text-stone-400 text-xs mt-1">{user?.email}</p>
            <div className="mt-2">
              <motion.span layout className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isSitter ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-600"}`}>
                {isSitter ? "Sitter & Owner" : "Pet Owner"}
              </motion.span>
            </div>
          </div>
        </div>
      </motion.div>

      {!profile?.full_name && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="mb-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
          Complete your profile to access all features.
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div className="flex gap-1 bg-stone-100 rounded-xl p-1 mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        {[{ value: "personal" as const, label: "Personal info", icon: User }, { value: "sitter" as const, label: "Sitter settings", icon: Briefcase }].map(({ value, label, icon: Icon }) => (
          <button key={value} onClick={() => setTab(value)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors relative ${tab === value ? "text-stone-900" : "text-stone-500 hover:text-stone-700"}`}>
            {tab === value && (
              <motion.div layoutId="profile-tab-pill" className="absolute inset-0 bg-white rounded-lg shadow-sm" style={{ zIndex: -1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}
          </motion.div>
        )}
        {saved && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">Profile saved!
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {tab === "personal" && (
            <motion.div key="personal" variants={stagger(0.07)} initial="hidden" animate="show" exit={{ opacity: 0, y: 8 }}
              className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 space-y-5">
              {[
                { label: "Full name *", type: "text", key: "full_name", placeholder: "Jane Smith", req: true },
                { label: "Phone *", type: "tel", key: "phone", placeholder: "+44 7911 123456", req: true },
                { label: "City *", type: "text", key: "city", placeholder: "e.g. London", req: true },
              ].map(({ label, type, key, placeholder, req }) => (
                <motion.div key={key} variants={fadeUp}>
                  <label className="block text-sm font-medium text-stone-700 mb-1.5">{label}</label>
                  <input type={type} value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} required={req}
                    className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition" />
                </motion.div>
              ))}
              <motion.div variants={fadeUp}>
                <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors disabled:opacity-60">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />Save changes</>}
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {tab === "sitter" && (
            <motion.div key="sitter" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }} className="space-y-5">
              {/* Toggle */}
              <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-5 flex items-center justify-between">
                <div>
                  <div className="font-medium text-stone-900">Sitter mode</div>
                  <div className="text-sm text-stone-500 mt-0.5">{isSitter ? "You appear in browse results" : "Enable to start accepting bookings"}</div>
                </div>
                <motion.button type="button" onClick={() => setIsSitter(!isSitter)} whileTap={{ scale: 0.95 }}
                  className={`relative w-12 h-6 rounded-full transition-colors ${isSitter ? "bg-[#D95F3B]" : "bg-stone-200"}`}>
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm ${isSitter ? "left-6" : "left-0.5"}`} />
                </motion.button>
              </div>

              <AnimatePresence>
                {isSitter && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }} className="overflow-hidden">
                    <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-6 space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1.5">About me</label>
                        <textarea value={form.about_me} onChange={(e) => setForm({ ...form, about_me: e.target.value })}
                          placeholder="Tell pet owners about your experience..." rows={4}
                          className="w-full px-3.5 py-3 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition resize-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1.5">Rate (£/hr)</label>
                          <input type="number" value={form.rate_per_hour} onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })}
                            placeholder="e.g. 18" min="1" step="1"
                            className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1.5">Years experience</label>
                          <input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                            placeholder="e.g. 3" min="0" step="1"
                            className="w-full h-11 px-3.5 rounded-xl border border-stone-200 bg-white text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#D95F3B] focus:border-transparent text-sm transition" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-700 mb-2">Services offered</label>
                        <div className="grid grid-cols-2 gap-2">
                          {SERVICES.map(([k, v]) => (
                            <motion.label key={k} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                              className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-sm ${form.services[k] ? "border-[#D95F3B] bg-orange-50 text-[#D95F3B]" : "border-stone-100 text-stone-600 hover:border-stone-200"}`}>
                              <input type="checkbox" checked={form.services[k]} onChange={(e) => setForm({ ...form, services: { ...form.services, [k]: e.target.checked } })} className="sr-only" />
                              <motion.div layout className={`w-4 h-4 rounded flex items-center justify-center border ${form.services[k] ? "bg-[#D95F3B] border-[#D95F3B]" : "border-stone-300"}`}>
                                {form.services[k] && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </motion.div>
                              {v}
                            </motion.label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full h-11 flex items-center justify-center gap-2 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors disabled:opacity-60">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />Save profile</>}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
