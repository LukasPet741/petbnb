"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { collectMyData, exportFilename } from "@/lib/data-export";
import { downloadFile } from "@/lib/download";
import { eraseMyAccount, type EraseOutcome } from "@/lib/erase-account";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import Field, { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

const ERASE_ERROR: Record<Exclude<EraseOutcome, "erased">, string> = {
  "open-bookings": "appPages.profile.data.deleteOpenBookings",
  "name-mismatch": "appPages.profile.data.deleteNameMismatch",
  failed: "appPages.profile.data.deleteFailed",
};

const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();

/**
 * "Your data" on /profile (plan §2.4, GDPR): download everything PetBnB holds about you as
 * one JSON file, or delete the account. Deleting is a Confirm with the name typed out, since
 * it cannot come back; the database checks the name again and refuses while a booking is open.
 * Kept out of the profile form so none of its buttons can submit it.
 */
export default function AccountData() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { profile } = useProfile();
  const router = useRouter();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [erasing, setErasing] = useState(false);
  const [eraseError, setEraseError] = useState("");

  // The name to type, or a plain word when the profile has none.
  const expected = profile?.full_name?.trim() || t("appPages.profile.data.deleteWord");
  const matches = sameText(typed, expected);

  const download = async () => {
    if (!user) return;
    setDownloading(true);
    setError("");
    try {
      const data = await collectMyData(user);
      downloadFile(exportFilename(), JSON.stringify(data, null, 2), "application/json;charset=utf-8");
      toast({ message: t("appPages.profile.data.downloaded") });
    } catch {
      setError(t("appPages.profile.data.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  };

  const closeDelete = () => {
    if (erasing) return;
    setDeleteOpen(false);
    setTyped("");
    setEraseError("");
  };

  const erase = async () => {
    if (!user || !matches) return;
    setErasing(true);
    setEraseError("");
    const outcome = await eraseMyAccount(user.id, typed.trim());
    setErasing(false);
    if (outcome === "erased") {
      toast({ message: t("appPages.profile.data.deleted") });
      router.push("/");
      return;
    }
    setEraseError(t(ERASE_ERROR[outcome]));
  };

  return (
    <section aria-labelledby="account-data-title" className="glass-card mt-5 rounded-2xl border p-6 sm:p-7">
      <h2 id="account-data-title" className="font-medium text-ink">{t("appPages.profile.data.title")}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">{t("appPages.profile.data.downloadHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="secondary" onClick={download} loading={downloading}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("appPages.profile.data.downloadButton")}
        </Button>
        <Button variant="danger-soft" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t("appPages.profile.data.deleteButton")}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      <Dialog
        open={deleteOpen}
        onClose={closeDelete}
        title={t("appPages.profile.data.deleteTitle")}
        description={t("appPages.profile.data.deleteBody")}
        footer={
          <div className="flex flex-wrap justify-end gap-2.5">
            <Button variant="secondary" onClick={closeDelete} disabled={erasing}>{t("common.ui.keep")}</Button>
            <Button variant="danger" onClick={erase} disabled={!matches} loading={erasing}>
              {t("appPages.profile.data.deleteConfirmButton")}
            </Button>
          </div>
        }
      >
        <Field label={t("appPages.profile.data.deleteTypeName", { name: expected })} error={eraseError || undefined}>
          {(p) => <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />}
        </Field>
      </Dialog>
    </section>
  );
}
