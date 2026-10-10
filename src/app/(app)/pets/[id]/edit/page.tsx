"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetForm, { type PetFormValues } from "@/components/PetForm";
import type { Pet } from "@/lib/types";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePetRemoval } from "@/hooks/usePetRemoval";
import Button from "@/components/ui/Button";

export default function EditPetPage() {
  const { t } = useLanguage();
  usePageTitle(t("appPages.petsEdit.title"));
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [initial, setInitial] = useState<PetFormValues | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const removePet = usePetRemoval();

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

  // The same removal as /pets (usePetRemoval): a pet with bookings is archived, any other
  // pet deleted, each after a Confirm.
  const handleDelete = async () => {
    if (!initial) return;
    setDeleting(true);
    setDeleteError("");
    const result = await removePet({ id, name: initial.name, photo_url: initial.photo_url });
    if (result === "removed" || result === "archived") { router.push("/pets"); return; }
    setDeleting(false);
    if (result === "has-bookings") setDeleteError(t("appPages.pets.removeHasBookings"));
    else if (result === "failed") setDeleteError(t("appPages.pets.removeFailed"));
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link href="/pets" className="inline-flex items-center gap-2 text-sm text-ink-soft hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" /> {t("appPages.petsNew.backToMyPets")}
      </Link>
      <h1 className="font-display text-3xl font-semibold text-ink tracking-tight">{t("appPages.petsEdit.title")}</h1>
      <p className="text-ink-soft text-sm mt-2 mb-8">{t("appPages.petsEdit.subtitle")}</p>

      {notFound ? (
        <div className="glass-card rounded-2xl border p-6 text-sm text-ink-soft">
          {t("appPages.petsEdit.notFound")}
        </div>
      ) : !initial ? (
        <div className="glass-card rounded-2xl border p-6 text-sm text-ink-soft">
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
          <Button variant="danger-soft" block loading={deleting} onClick={() => void handleDelete()} className="mt-5">
            {!deleting && <Trash2 className="w-4 h-4" aria-hidden="true" />}
            {t("appPages.petsEdit.deleteButton")}
          </Button>
          {deleteError && (
            <p role="alert" className="mt-3 p-3 bg-danger-soft border border-danger/20 rounded-[var(--radius-control)] text-sm text-danger">
              {deleteError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
