import { useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PHOTO_BUCKET, storagePathFromPublicUrl } from "@/lib/upload";
import { useLanguage } from "@/context/LanguageContext";
import { useConfirm } from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";

export type PetRemoval = "removed" | "kept" | "has-bookings" | "failed";

/**
 * Removing a pet, the one way both /pets and the edit page do it (plan §2.4).
 *
 * The database CASCADES a pet's deletion into every booking it was on
 * (bookings_pet_id_fkey ON DELETE CASCADE, read from prod on 2026-10-10), and each booking
 * takes its messages, notifications and reviews along — the sitter's history as much as
 * the owner's. Until pets can be archived (a migration waiting for Lukas's yes), a pet
 * with any booking is kept, without asking. Any other pet goes after a Confirm, the row
 * first and the photo second, so a refused delete never costs the photo.
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
      if ((count ?? 0) > 0) return "has-bookings";

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
