"use client";
import { useState, useEffect } from "react";
import { Save, User, Briefcase, Radar, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { SERVICE_LABELS, type ServiceType } from "@/lib/types";
import Avatar from "@/components/Avatar";
import PageHeader from "@/components/PageHeader";
import CollarsPanel from "@/components/CollarsPanel";
import { fadeUp, stagger } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";

const SERVICE_KEYS = Object.keys(SERVICE_LABELS) as ServiceType[];
const inputCls = "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";

export default function ProfilePage() {
  const { t } = useLanguage();
  const SERVICES = SERVICE_KEYS.map((k) => [k, t(`common.services.${k}`)] as [ServiceType, string]);
  const { user } = useAuth();
  const { profile, refresh } = useProfile();
  const router = useRouter();
  const [tab, setTab] = useState<"personal" | "sitter" | "collars">("personal");
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
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        title={t("appPages.profile.title")}
        action={
          <button onClick={handleSignOut} className="flex items-center gap-2 px-3.5 py-2 text-sm text-ink-soft hover:text-ink hover:bg-brand-softer rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />{t("appPages.profile.signOutButton")}
          </button>
        }
      />

      {/* Avatar card */}
      <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 mb-6">
        <div className="flex items-center gap-5">
          <Avatar name={form.full_name || t("appPages.profile.avatarFallbackName")} url={profile?.avatar_url} size="xl" />
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-ink tracking-tight truncate">{form.full_name || t("appPages.profile.completeProfileFallback")}</h2>
            <p className="text-ink-soft text-sm mt-0.5">{form.city || t("appPages.profile.noCitySetFallback")}</p>
            <p className="text-ink-soft/70 text-xs mt-1 truncate">{user?.email}</p>
            <div className="mt-2.5">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isSitter ? "bg-brand-soft text-brand-strong" : "bg-surface-2 text-ink-soft"}`}>
                {isSitter ? t("appPages.profile.sitterAndOwnerBadge") : t("appPages.profile.petOwnerBadge")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {!profile?.full_name && (
        <div className="mb-6 p-4 bg-amber-soft border border-amber/20 rounded-2xl text-sm text-amber-strong">
          {t("appPages.profile.completeProfileBanner")}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2 rounded-xl p-1 mb-6">
        {[{ value: "personal" as const, label: t("appPages.profile.tabPersonalInfo"), icon: User }, { value: "sitter" as const, label: t("appPages.profile.tabSitterSettings"), icon: Briefcase }, { value: "collars" as const, label: t("appPages.profile.tabMyCollars"), icon: Radar }].map(({ value, label, icon: Icon }) => (
          <button key={value} onClick={() => setTab(value)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors relative ${tab === value ? "text-ink" : "text-ink-soft hover:text-ink"}`}>
            {tab === value && (
              <motion.div layoutId="profile-tab-pill" className="absolute inset-0 bg-surface rounded-lg shadow-[var(--shadow-sm)]" style={{ zIndex: -1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">{error}
          </motion.div>
        )}
        {saved && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-brand-soft rounded-xl text-sm text-brand-strong">{t("appPages.profile.profileSavedMessage")}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit}>
        <AnimatePresence mode="wait">
          {tab === "personal" && (
            <motion.div key="personal" variants={stagger(0.07)} initial="hidden" animate="show" exit={{ opacity: 0, y: 8 }}
              className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 sm:p-7 space-y-5">
              {[
                { label: t("appPages.profile.fullNameLabel"), type: "text", key: "full_name", placeholder: t("appPages.profile.fullNamePlaceholder"), req: true },
                { label: t("appPages.profile.cityLabel"), type: "text", key: "city", placeholder: t("appPages.profile.cityPlaceholder"), req: true },
              ].map(({ label, type, key, placeholder, req }) => (
                <motion.div key={key} variants={fadeUp}>
                  <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
                  <input type={type} value={form[key as keyof typeof form] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder} required={req} className={inputCls} />
                </motion.div>
              ))}
              <motion.div variants={fadeUp}>
                <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.profile.phoneLabel")}</label>
                <div className="flex gap-2">
                  <div className="h-11 px-3.5 rounded-xl border border-black/10 bg-surface-2 text-ink-soft text-sm flex items-center flex-shrink-0 select-none">
                    {t("appPages.profile.phoneCountryCode")}
                  </div>
                  <input
                    type="tel"
                    value={form.phone.replace(/^\+370\s*/, "")}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^\d\s\-]/g, "");
                      setForm({ ...form, phone: digits ? `+370 ${digits}` : "" });
                    }}
                    placeholder={t("appPages.profile.phonePlaceholder")}
                    required
                    pattern="[\d\s\-]{8,11}"
                    title={t("appPages.profile.phoneTitle")}
                    className={`flex-1 ${inputCls}`}
                  />
                </div>
              </motion.div>
              <motion.div variants={fadeUp}>
                <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60">
                  {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t("appPages.profile.saveChangesButton")}</>}
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {tab === "sitter" && (
            <motion.div key="sitter" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.25 }} className="space-y-5">
              {/* Toggle */}
              <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-ink">{t("appPages.profile.sitterModeLabel")}</div>
                  <div className="text-sm text-ink-soft mt-0.5">{isSitter ? t("appPages.profile.sitterModeOnDescription") : t("appPages.profile.sitterModeOffDescription")}</div>
                </div>
                <button type="button" onClick={() => setIsSitter(!isSitter)}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${isSitter ? "bg-brand" : "bg-black/15"}`}>
                  <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-[var(--shadow-sm)] ${isSitter ? "left-6" : "left-0.5"}`} />
                </button>
              </div>

              <AnimatePresence>
                {isSitter && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }} className="overflow-hidden">
                    <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 sm:p-7 space-y-5">
                      <div>
                        <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.profile.aboutMeLabel")}</label>
                        <textarea value={form.about_me} onChange={(e) => setForm({ ...form, about_me: e.target.value })}
                          placeholder={t("appPages.profile.aboutMePlaceholder")} rows={4}
                          className="w-full px-3.5 py-3 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.profile.rateLabel")}</label>
                          <input type="number" value={form.rate_per_hour} onChange={(e) => setForm({ ...form, rate_per_hour: e.target.value })}
                            placeholder={t("appPages.profile.ratePlaceholder")} min="1" step="1" className={inputCls} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.profile.experienceLabel")}</label>
                          <input type="number" value={form.experience_years} onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                            placeholder={t("appPages.profile.experiencePlaceholder")} min="0" step="1" className={inputCls} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-ink mb-2">{t("appPages.profile.servicesOfferedLabel")}</label>
                        <div className="grid grid-cols-2 gap-2.5">
                          {SERVICES.map(([k, v]) => (
                            <label key={k}
                              className={`flex items-center gap-2.5 p-3 rounded-xl border cursor-pointer transition-all text-sm ${form.services[k] ? "border-brand bg-brand-soft text-brand-strong" : "border-black/10 text-ink-soft hover:border-black/20"}`}>
                              <input type="checkbox" checked={form.services[k]} onChange={(e) => setForm({ ...form, services: { ...form.services, [k]: e.target.checked } })} className="sr-only" />
                              <span className={`w-4 h-4 rounded flex items-center justify-center border ${form.services[k] ? "bg-brand border-brand" : "border-black/25"}`}>
                                {form.services[k] && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                              </span>
                              {v}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={saving} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                className="w-full h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t("appPages.profile.saveProfileButton")}</>}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </form>

      {tab === "collars" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <CollarsPanel />
        </motion.div>
      )}
    </div>
  );
}
