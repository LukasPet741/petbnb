"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, PawPrint } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetForm, { type PetFormValues } from "@/components/PetForm";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function NewPetPage() {
  const { t } = useLanguage();
  usePageTitle(t("appPages.petsNew.title"));
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-10">
      <Link href="/pets" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-4 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.petsNew.backToMyPets")}
      </Link>
      <PageHeader icon={PawPrint} title={t("appPages.petsNew.title")} subtitle={t("appPages.petsNew.subtitle")} />

      <PetForm
        userId={user?.id ?? ""}
        submitLabel={t("appPages.petsNew.savePetButton")}
        cancelHref="/pets"
        onSubmit={handleSubmit}
      />
    </div>
  );
}
