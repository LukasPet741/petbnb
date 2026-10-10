"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { collectMyData, exportFilename } from "@/lib/data-export";
import { downloadFile } from "@/lib/download";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/**
 * "Your data" on /profile (plan §2.4, GDPR): download everything PetBnB holds about you as
 * one JSON file. Kept out of the profile form so none of its buttons can submit it.
 */
export default function AccountData() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <section aria-labelledby="account-data-title" className="glass-card mt-5 rounded-2xl border p-6 sm:p-7">
      <h2 id="account-data-title" className="font-medium text-ink">{t("appPages.profile.data.title")}</h2>
      <p className="mt-0.5 text-sm text-ink-soft">{t("appPages.profile.data.downloadHint")}</p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Button variant="secondary" onClick={download} loading={downloading}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {t("appPages.profile.data.downloadButton")}
        </Button>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
