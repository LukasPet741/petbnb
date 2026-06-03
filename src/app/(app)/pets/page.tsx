"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Plus, PawPrint } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import PetCard from "@/components/PetCard";
import type { Pet } from "@/lib/mock-data";
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <motion.div className="flex items-center justify-between mb-6" initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">My pets</h1>
          <p className="text-stone-500 text-sm mt-0.5">{loading ? "Loading…" : `${pets.length} pet${pets.length !== 1 ? "s" : ""} registered`}</p>
        </div>
        <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
          <Link href="/pets/new" className="flex items-center gap-2 px-4 py-2.5 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors">
            <Plus className="w-4 h-4" />Add pet
          </Link>
        </motion.div>
      </motion.div>

      {!loading && pets.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
          className="bg-white rounded-xl border border-stone-100 p-12 text-center">
          <motion.div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mx-auto mb-4"
            animate={{ rotate: [0, -8, 8, -8, 0] }} transition={{ delay: 0.5, duration: 0.6 }}>
            <PawPrint className="w-8 h-8 text-[#D95F3B]" />
          </motion.div>
          <h2 className="font-semibold text-stone-900 mb-1">No pets yet</h2>
          <p className="text-stone-500 text-sm mb-4">Add your first pet to start booking sitters.</p>
          <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} className="inline-block">
            <Link href="/pets/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#D95F3B] text-white rounded-xl text-sm font-medium hover:bg-[#c4482a] transition-colors">
              <Plus className="w-4 h-4" />Add your first pet
            </Link>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div className="space-y-3" variants={stagger(0.08)} initial="hidden" animate="show">
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
  );
}
