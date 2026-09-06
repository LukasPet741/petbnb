"use client";
import Link from "next/link";
import { useState } from "react";
import { Save } from "lucide-react";
import { PET_TYPE_LABELS, type PetType } from "@/lib/types";
import { petColor, petIcon } from "@/lib/petVisuals";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/LanguageContext";
import ImageUpload from "@/components/ImageUpload";

const PET_TYPE_KEYS = Object.keys(PET_TYPE_LABELS) as PetType[];
const inputCls = "w-full h-11 px-3.5 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition";
const selectCls = "w-full h-11 px-3 rounded-xl border border-black/10 bg-surface text-ink text-sm focus:outline-none focus:ring-2 focus:ring-brand";

export interface PetFormValues {
  name: string;
  type: PetType;
  sex: "male" | "female" | "unknown";
  /** Kept as the raw input string; the caller converts to a number or null. */
  weight_kg: string;
  bio: string;
  photo_url: string | null;
}

export const EMPTY_PET_FORM: PetFormValues = {
  name: "",
  type: "dog",
  sex: "unknown",
  weight_kg: "",
  bio: "",
  photo_url: null,
};

interface PetFormProps {
  userId: string;
  initial?: PetFormValues;
  submitLabel: string;
  cancelHref: string;
  /** Persists the pet. Throwing renders the error above the fields. */
  onSubmit: (values: PetFormValues) => Promise<void>;
}

/**
 * The pet detail fields, shared by /pets/new and /pets/[id]/edit so the two
 * routes cannot drift. Owns its own draft state, submit spinner and error
 * banner; the caller supplies only the persistence step.
 */
export default function PetForm({
  userId,
  initial = EMPTY_PET_FORM,
  submitLabel,
  cancelHref,
  onSubmit,
}: PetFormProps) {
  const { t } = useLanguage();
  const PET_TYPES = PET_TYPE_KEYS.map((k) => [k, t(`common.petTypes.${k}`)] as [PetType, string]);
  const [form, setForm] = useState<PetFormValues>(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const Icon = petIcon(form.type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
    // On success the caller navigates away, so the spinner stays up rather
    // than flashing back to an idle button on a page that is unmounting.
  };

  return (
    <>
      {error && (
        <div role="alert" className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 sm:p-7 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink mb-2">
            {t("appPages.petsNew.photoLabel")}{" "}
            <span className="text-ink-soft/70 font-normal">{t("appPages.petsNew.optionalSuffix")}</span>
          </label>
          <ImageUpload
            userId={userId}
            kind="pet"
            value={form.photo_url}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url }))}
            shape="square"
            className="w-24 h-24"
            fallback={
              <span className={cn("w-full h-full flex items-center justify-center", petColor(form.type))}>
                <Icon className="w-9 h-9" />
              </span>
            }
          />
        </div>

        <div>
          <label htmlFor="pet-name" className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.nameLabel")}</label>
          <input id="pet-name" type="text" value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={t("appPages.petsNew.namePlaceholder")} required className={inputCls} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pet-type" className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.typeLabel")}</label>
            <select id="pet-type" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as PetType })} className={selectCls}>
              {PET_TYPES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pet-sex" className="block text-sm font-medium text-ink mb-1.5">{t("appPages.petsNew.sexLabel")}</label>
            <select id="pet-sex" value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value as PetFormValues["sex"] })} className={selectCls}>
              <option value="unknown">{t("appPages.petsNew.sexUnknown")}</option>
              <option value="male">{t("appPages.petsNew.sexMale")}</option>
              <option value="female">{t("appPages.petsNew.sexFemale")}</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="pet-weight" className="block text-sm font-medium text-ink mb-1.5">
            {t("appPages.petsNew.weightLabel")}{" "}
            <span className="text-ink-soft/70 font-normal">{t("appPages.petsNew.optionalSuffix")}</span>
          </label>
          <input id="pet-weight" type="number" value={form.weight_kg}
            onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
            placeholder={t("appPages.petsNew.weightPlaceholder")} step="0.1" min="0" inputMode="decimal" className={inputCls} />
        </div>

        <div>
          <label htmlFor="pet-bio" className="block text-sm font-medium text-ink mb-1.5">
            {t("appPages.petsNew.bioLabel")}{" "}
            <span className="text-ink-soft/70 font-normal">{t("appPages.petsNew.optionalSuffix")}</span>
          </label>
          <textarea id="pet-bio" value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder={t("appPages.petsNew.bioPlaceholder")} rows={4}
            className="w-full px-3.5 py-3 rounded-xl border border-black/10 bg-surface text-ink placeholder:text-ink-soft/60 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm transition resize-none" />
        </div>

        <div className="flex gap-3 pt-1">
          <Link href={cancelHref} className="flex-1 h-11 flex items-center justify-center rounded-xl border border-black/10 text-ink text-sm font-medium hover:bg-brand-softer transition-colors">
            {t("appPages.petsNew.cancelButton")}
          </Link>
          <button type="submit" disabled={loading}
            className="flex-1 h-11 flex items-center justify-center gap-2 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors disabled:opacity-60">
            {loading
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><Save className="w-4 h-4" />{submitLabel}</>}
          </button>
        </div>
      </form>
    </>
  );
}
