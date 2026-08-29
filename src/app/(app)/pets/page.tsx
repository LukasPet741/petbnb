"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, PawPrint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetCard from "@/components/PetCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import RightRail from "@/components/RightRail";
import type { Pet } from "@/lib/types";
import { stagger, fadeUp } from "@/lib/motion";
import { useLanguage } from "@/context/LanguageContext";

export default function PetsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("pets").select("*").eq("owner_id", user.id).order("created_at");
    setPets((data ?? []) as Pet[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("appPages.pets.removeConfirm"))) return;
    await supabase.from("pets").delete().eq("id", id);
    setPets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        title={t("appPages.pets.title")}
        subtitle={loading ? t("appPages.pets.loadingText") : pets.length !== 1 ? t("appPages.pets.countPlural", { count: pets.length }) : t("appPages.pets.countSingular", { count: pets.length })}
        action={!loading && pets.length > 0 ? (
          <Link href="/pets/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
            <Plus className="w-4 h-4" />{t("appPages.pets.addPetButton")}
          </Link>
        ) : undefined}
      />

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
                    <PetCard pet={pet} onDelete={() => handleDelete(pet.id)} />
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
