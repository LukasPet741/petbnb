"use client";
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";

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

  const toggle = useCallback(async (id: string) => {
    if (!user) return;
    const has = favorites.has(id);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (has) next.delete(id); else next.add(id);
      return next;
    });
    if (has) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("sitter_id", id);
    } else {
      await supabase.from("favorites").insert({ sitter_id: id });
    }
  }, [user, favorites]);

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
