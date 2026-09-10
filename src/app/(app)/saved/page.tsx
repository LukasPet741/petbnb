"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Search, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useFavorites } from "@/context/FavoritesContext";
import SitterCard from "@/components/SitterCard";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import { type Profile, PUBLIC_PROFILE_COLUMNS } from "@/lib/types";
import { stagger, fadeUp } from "@/lib/motion";
import { useSitterRatings } from "@/hooks/useSitterRatings";
import { useLanguage } from "@/context/LanguageContext";

export default function SavedPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const [sitters, setSitters] = useState<Profile[]>([]);
  // One query for the whole page rather than one per card. Keyed on the loaded
  // set, not the filtered one, so changing a filter never re-queries.
  const ratings = useSitterRatings(sitters.map((s) => s.id));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("favorites").select(`sitter:profiles!favorites_sitter_id_fkey(${PUBLIC_PROFILE_COLUMNS})`).eq("user_id", user.id)
      .then(({ data }) => {
        const rows = (data ?? []).map((r) => (r as unknown as { sitter: Profile }).sitter).filter(Boolean);
        setSitters(rows);
        setLoading(false);
      });
  }, [user]);

  // Reflect optimistic un-saving immediately.
  const visible = sitters.filter((s) => favorites.has(s.id));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <PageHeader title={t("appPages.saved.title")} subtitle={loading ? t("appPages.saved.loadingText") : t("appPages.saved.savedCountLabel", { count: visible.length })} />

      {!loading && visible.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title={t("appPages.saved.emptyTitle")}
          description={t("appPages.saved.emptyDescription")}
          action={<Link href="/browse" className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors"><Search className="w-4 h-4" />{t("appPages.saved.findSitterButton")}</Link>}
          tone="encouraging"
        />
      ) : (
        <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6" variants={stagger(0.07)} initial="hidden" animate="show">
          {visible.map((s) => (
            <motion.div key={s.id} variants={fadeUp} layout>
              <SitterCard sitter={s} showFavorite rating={ratings.get(s.id) ?? null} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}
