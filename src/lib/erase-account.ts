import { supabase } from "@/lib/supabase";
import { PHOTO_BUCKET } from "@/lib/upload";

export type EraseOutcome = "erased" | "open-bookings" | "name-mismatch" | "failed";

/**
 * "Delete my account" (plan §2.4, GDPR art. 17). The database empties the account in one
 * transaction (erase_my_account, 20261010124623): it refuses while a booking is open and
 * keeps the other party's bookings, messages and reviews under an empty profile. Then the
 * person's photos go (Storage refuses deletes made in SQL) and this device forgets the
 * session; the server's sessions are already gone, so only the local sign-out can succeed.
 */
export async function eraseMyAccount(userId: string, confirmName: string): Promise<EraseOutcome> {
  const { error } = await supabase.rpc("erase_my_account", { p_confirm_name: confirmName });
  if (error) {
    if (error.message.includes("open_bookings")) return "open-bookings";
    if (error.message.includes("name_mismatch")) return "name-mismatch";
    return "failed";
  }

  const photos = supabase.storage.from(PHOTO_BUCKET);
  const { data: files } = await photos.list(userId, { limit: 1000 });
  if (files?.length) await photos.remove(files.map((f) => `${userId}/${f.name}`));

  await supabase.auth.signOut({ scope: "local" });
  return "erased";
}
