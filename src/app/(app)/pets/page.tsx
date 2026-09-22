"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PawPrint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetCard from "@/components/PetCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RightRail from "@/components/RightRail";
import type { Pet } from "@/lib/types";
import { PHOTO_BUCKET, storagePathFromPublicUrl } from "@/lib/upload";
import { stagger, fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import { pluralForm } from "@/lib/i18n/plural";

export default function PetsPage() {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at");
    setPets((data ?? []) as Pet[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (pet: Pet) => {
    if (!confirm(t("appPages.pets.removeConfirm"))) return;
    setError("");
    // The row goes first, and only a confirmed delete takes the photo and the card
    // with it. The other order loses the photo whenever the delete is refused — and
    // it can be: a pet on a booking is kept, because deleting it would take the
    // booking, its messages and its reviews with it (foreign key 23503).
    const { error: err } = await supabase.from("pets").delete().eq("id", pet.id);
    if (err) {
      setError(t(err.code === "23503" ? "appPages.pets.removeHasBookings" : "appPages.pets.removeFailed"));
      return;
    }
    // Afterwards the photo's URL is unrecoverable, so the object would linger in the
    // bucket with nothing pointing at it.
    const path = storagePathFromPublicUrl(pet.photo_url);
    if (path) await supabase.storage.from(PHOTO_BUCKET).remove([path]);
    setPets((prev) => prev.filter((p) => p.id !== pet.id));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        title={t("appPages.pets.title")}
        subtitle={loading ? t("appPages.pets.loadingText") : t(`appPages.pets.count.${pluralForm(locale, pets.length)}`, { count: pets.length })}
        action={!loading && pets.length > 0 ? (
          <Link href="/pets/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
            <Plus className="w-4 h-4" />{t("appPages.pets.addPetButton")}
          </Link>
        ) : undefined}
      />

      <AnimatePresence>
        {error && (
          <motion.div role="alert" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-xl text-sm text-danger">{error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-8 lg:gap-10">
        <div className="min-w-0">
          {!loading && pets.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title={t("appPages.pets.emptyTitle")}
              description={t("appPages.pets.emptyDescription")}
              action={
                <Link href="/pets/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
                  <Plus className="w-4 h-4" />{t("appPages.pets.addFirstPetButton")}
                </Link>
              }
              tone="encouraging"
            />
          ) : (
            <motion.div className="space-y-4" variants={stagger(0.08)} initial="hidden" animate="show">
              <AnimatePresence>
                {pets.map((pet) => (
                  <motion.div key={pet.id} variants={fadeUp}>
                    <PetCard pet={pet} onEdit={() => router.push(`/pets/${pet.id}/edit`)} onDelete={() => handleDelete(pet)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <RightRail />
      </div>
    </div>
  );
}
