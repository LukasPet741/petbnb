"use client";
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
import { ButtonLink } from "@/components/ui/Button";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { Pet } from "@/lib/types";
import { arrive, reveal } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";
import { usePageTitle } from "@/hooks/usePageTitle";
import { usePetRemoval } from "@/hooks/usePetRemoval";
import { pluralForm } from "@/lib/i18n/plural";

export default function PetsPage() {
  const { t, locale } = useLanguage();
  usePageTitle(t("appPages.pets.title"));
  const { user } = useAuth();
  const router = useRouter();
  const removePet = usePetRemoval();
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
    setError("");
    const result = await removePet(pet);
    if (result === "removed") setPets((prev) => prev.filter((p) => p.id !== pet.id));
    else if (result === "has-bookings") setError(t("appPages.pets.removeHasBookings"));
    else if (result === "failed") setError(t("appPages.pets.removeFailed"));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        title={t("appPages.pets.title")}
        subtitle={loading ? t("appPages.pets.loadingText") : t(`appPages.pets.count.${pluralForm(locale, pets.length)}`, { count: pets.length })}
        action={!loading && pets.length > 0 ? (
          <ButtonLink href="/pets/new"><Plus className="w-4 h-4" aria-hidden="true" />{t("appPages.pets.addPetButton")}</ButtonLink>
        ) : undefined}
      />

      <AnimatePresence>
        {error && (
          <motion.div role="alert" variants={arrive} initial="hidden" animate="show" exit="exit"
            className="mb-4 p-3 bg-danger-soft border border-danger/20 rounded-[var(--radius-control)] text-sm text-danger">{error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-8 lg:gap-10">
        <div className="min-w-0">
          {loading ? (
            <div className="space-y-4" aria-busy="true">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : pets.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title={t("appPages.pets.emptyTitle")}
              description={t("appPages.pets.emptyDescription")}
              action={<ButtonLink href="/pets/new"><Plus className="w-4 h-4" aria-hidden="true" />{t("appPages.pets.addFirstPetButton")}</ButtonLink>}
              tone="encouraging"
            />
          ) : (
            <motion.div className="space-y-4" variants={reveal()} initial="hidden" animate="show">
              {/* A removed pet departs (fade, scale 0.98) and the list closes the gap. */}
              <AnimatePresence mode="popLayout">
                {pets.map((pet) => (
                  <motion.div key={pet.id} layout variants={arrive} exit="exit">
                    <PetCard pet={pet} onEdit={() => router.push(`/pets/${pet.id}/edit`)} onDelete={() => void handleDelete(pet)} />
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
