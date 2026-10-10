"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/components/ui/Toast";

interface FavoritesValue {
  favorites: Set<string>;
  isFavorite: (id: string) => boolean;
  toggle: (id: string) => void;
  count: number;
  loading: boolean;
}

const FavoritesContext = createContext<FavoritesValue>({
  favorites: new Set(),
  isFavorite: () => false,
  toggle: () => {},
  count: 0,
  loading: true,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setFavorites(new Set()); setLoading(false); return; }
    let active = true;
    supabase.from("favorites").select("sitter_id").eq("user_id", user.id).then(({ data }) => {
      if (!active) return;
      setFavorites(new Set((data ?? []).map((r) => (r as { sitter_id: string }).sitter_id)));
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const save = useCallback(async (id: string) => {
    setFavorites((prev) => new Set(prev).add(id));
    await supabase.from("favorites").insert({ sitter_id: id });
  }, []);

  const toggle = useCallback(async (id: string) => {
    if (!user) return;
    const has = favorites.has(id);
    if (!has) return save(id);
    setFavorites((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await supabase.from("favorites").delete().eq("user_id", user.id).eq("sitter_id", id);
    // Erasing with Undo (plan §2.4): only you lose it, and it can come back.
    toast({ message: t("appPages.favoriteButton.removed"), action: { label: t("common.ui.undo"), onAction: () => void save(id) } });
  }, [user, favorites, save, toast, t]);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggle, count: favorites.size, loading }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
