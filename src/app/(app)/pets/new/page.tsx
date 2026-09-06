"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetForm, { type PetFormValues } from "@/components/PetForm";
import { useLanguage } from "@/context/LanguageContext";

export default function NewPetPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { user } = useAuth();

  const handleSubmit = async (form: PetFormValues) => {
    if (!user) return;
    const { error } = await supabase.from("pets").insert({
      owner_id: user.id,
      name: form.name,
      type: form.type,
      sex: form.sex,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      bio: form.bio || null,
      photo_url: form.photo_url,
    });
    if (error) throw new Error(error.message);
    router.push("/pets");
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/pets" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.petsNew.backToMyPets")}
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{t("appPages.petsNew.title")}</h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">{t("appPages.petsNew.subtitle")}</p>

      <PetForm
        userId={user?.id ?? ""}
        submitLabel={t("appPages.petsNew.savePetButton")}
        cancelHref="/pets"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
