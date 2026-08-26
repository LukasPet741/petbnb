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

export default function PetsPage() {
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
    if (!confirm("Remove this pet?")) return;
    await supabase.from("pets").delete().eq("id", id);
    setPets((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader
        title="My pets"
        subtitle={loading ? "Loading…" : `${pets.length} pet${pets.length !== 1 ? "s" : ""} registered`}
        action={!loading && pets.length > 0 ? (
          <Link href="/pets/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
            <Plus className="w-4 h-4" />Add pet
          </Link>
        ) : undefined}
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_19rem] gap-8 lg:gap-10">
        <div className="min-w-0">
          {!loading && pets.length === 0 ? (
            <EmptyState
              icon={PawPrint}
              title="No pets yet"
              description="Add your first pet to start booking sitters and keep their details in one place."
              action={
                <Link href="/pets/new" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
                  <Plus className="w-4 h-4" />Add your first pet
                </Link>
              }
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
