import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PHOTO_BUCKET, storagePathFromPublicUrl } from "@/lib/upload";
import { useLanguage } from "@/context/LanguageContext";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";

export type PetRemoval = "removed" | "archived" | "kept" | "has-bookings" | "failed";

/**
 * Removing a pet, the one way both /pets and the edit page do it (plan §2.4).
 *
 * A pet on a booking is part of the sitter's history too (the booking, its messages, its
 * reviews), so it is ARCHIVED after a Confirm: `archived_at` takes it off the owner's lists
 * and the request form, and the bookings keep its name and photo. The database refuses to
 * delete it anyway (bookings_pet_id_fkey ON DELETE NO ACTION, 20261010124551). Any other
 * pet is deleted after a Confirm, the row first and the photo second, so a refused delete
 * never costs the photo; a booking made in between comes back as "has-bookings".
 */
export function usePetRemoval() {
  const { t } = useLanguage();
  const confirm = useConfirm();
  const toast = useToast();

  return useCallback(
    async (pet: { id: string; name: string; photo_url: string | null }): Promise<PetRemoval> => {
      const { count, error: countError } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("pet_id", pet.id);
      if (countError) return "failed";
      if ((count ?? 0) > 0) {
        const archive = await confirm({
          title: t("appPages.pets.archiveConfirm", { name: pet.name }),
          body: t("appPages.pets.archiveConfirmBody", { name: pet.name }),
          confirmLabel: t("appPages.pets.archiveButton"),
        });
        if (!archive) return "kept";
        const { error } = await supabase.from("pets").update({ archived_at: new Date().toISOString() }).eq("id", pet.id);
        if (error) return "failed";
        toast({ message: t("appPages.pets.archived") });
        return "archived";
      }

      const ok = await confirm({
        title: t("appPages.pets.removeConfirm"),
        body: t("appPages.pets.removeConfirmBody", { name: pet.name }),
        confirmLabel: t("appPages.pets.removeButton"),
      });
      if (!ok) return "kept";

      const { error } = await supabase.from("pets").delete().eq("id", pet.id);
      if (error) return error.code === "23503" ? "has-bookings" : "failed";
      const path = storagePathFromPublicUrl(pet.photo_url);
      if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      toast({ message: t("appPages.pets.removed") });
      return "removed";
    },
    [t, confirm, toast],
  );
}
