"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetForm, { type PetFormValues } from "@/components/PetForm";
import { storagePathFromPublicUrl, PHOTO_BUCKET } from "@/lib/upload";
import type { Pet } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";

export default function EditPetPage() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [initial, setInitial] = useState<PetFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    let cancelled = false;

    // owner_id is matched here as well as in RLS: without it a wrong id would
    // return an empty row and render a blank form rather than "not found".
    supabase
      .from("pets")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const pet = data as Pet | null;
        if (!pet) { setNotFound(true); return; }
        setInitial({
          name: pet.name,
          type: pet.type,
          sex: pet.sex ?? "unknown",
          weight_kg: pet.weight_kg?.toString() ?? "",
          bio: pet.bio ?? "",
          photo_url: pet.photo_url,
        });
      });

    return () => { cancelled = true; };
  }, [id, user, authLoading]);

  const handleSubmit = async (form: PetFormValues) => {
    const { error } = await supabase
      .from("pets")
      .update({
        name: form.name,
        type: form.type,
        sex: form.sex,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        bio: form.bio || null,
        photo_url: form.photo_url,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    router.push("/pets");
  };

  const handleDelete = async () => {
    if (!confirm(t("appPages.pets.removeConfirm"))) return;
    setDeleting(true);
    // Delete the photo first: once the row is gone its URL is unrecoverable
    // and the object would sit in the bucket forever.
    const path = storagePathFromPublicUrl(initial?.photo_url ?? null);
    if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    const { error } = await supabase.from("pets").delete().eq("id", id);
    if (error) { setDeleting(false); return; }
    router.push("/pets");
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/pets" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.petsNew.backToMyPets")}
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{t("appPages.petsEdit.title")}</h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">{t("appPages.petsEdit.subtitle")}</p>

      {notFound ? (
        <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 text-sm text-ink-soft">
          {t("appPages.petsEdit.notFound")}
        </div>
      ) : !initial ? (
        <div className="bg-surface rounded-2xl border border-black/5 shadow-[var(--shadow-sm)] p-6 text-sm text-ink-soft">
          {t("appPages.pets.loadingText")}
        </div>
      ) : (
        <>
          <PetForm
            userId={user?.id ?? ""}
            initial={initial}
            submitLabel={t("appPages.petsEdit.saveButton")}
            cancelHref="/pets"
            onSubmit={handleSubmit}
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="mt-5 w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-danger/20 text-danger text-sm font-medium hover:bg-danger-soft transition-colors disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            {t("appPages.petsEdit.deleteButton")}
          </button>
        </>
      )}
    </div>
  );
}
