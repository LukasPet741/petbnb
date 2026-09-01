"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { PET_TYPE_LABELS, type PetType } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

const PET_TYPE_KEYS = Object.keys(PET_TYPE_LABELS) as PetType[];
const inputCls = "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";
const selectCls = "w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand";

export default function NewPetPage() {
  const { t } = useLanguage();
  const PET_TYPES = PET_TYPE_KEYS.map((k) => [k, t(`common.petTypes.${k}`)] as [PetType, string]);
  const router = useRouter();
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", type: "dog" as PetType, sex: "unknown" as "male" | "female" | "unknown", weight_kg: "", bio: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError("");
    const { error: err } = await supabase.from("pets").insert({
      owner_id: user.id,
      name: form.name,
      type: form.type,
      sex: form.sex,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      bio: form.bio || null,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push("/pets");
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/pets" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.petsNew.backToMyPets")}
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{t("appPages.petsNew.title")}</h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">{t("appPages.petsNew.subtitle")}</p>

      {error && <div className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">{error}</div>}

      <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 sm:p-7 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.nameLabel")}</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("appPages.petsNew.namePlaceholder")} required className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.typeLabel")}</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PetType })} className={selectCls}>
              {PET_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.sexLabel")}</label>
            <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value as "male" | "female" | "unknown" })} className={selectCls}>
              <option value="unknown">{t("appPages.petsNew.sexUnknown")}</option>
              <option value="male">{t("appPages.petsNew.sexMale")}</option>
              <option value="female">{t("appPages.petsNew.sexFemale")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.weightLabel")} <span className="text-ink-soft/70 font-normal">{t("appPages.petsNew.optionalSuffix")}</span></label>
          <input type="number" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} placeholder={t("appPages.petsNew.weightPlaceholder")} step="0.1" min="0" inputMode="decimal" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.bioLabel")} <span className="text-ink-soft/70 font-normal">{t("appPages.petsNew.optionalSuffix")}</span></label>
          <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t("appPages.petsNew.bioPlaceholder")} rows={4} className="w-full px-3.5 py-3 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none" />
        </div>
        <div className="flex gap-3 pt-1">
          <Link href="/pets" className="flex-1 h-11 flex items-center justify-center rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-brand-softer transition-colors">{t("appPages.petsNew.cancelButton")}</Link>
          <button type="submit" disabled={loading} className="flex-1 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Save className="w-4 h-4" />{t("appPages.petsNew.savePetButton")}</>}
          </button>
        </div>
      </form>
    </div>
  );
}
