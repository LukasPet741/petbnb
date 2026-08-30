"use client";
import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "petbnb-locale";

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function lookup(dict: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dict);
}

function interpolate(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  // LanguageProvider wraps AuthProvider (see src/app/layout.tsx), so useAuth() would only
  // ever read the default empty context here. We subscribe to Supabase auth directly
  // rather than reordering the providers.
  const userIdRef = useRef<string | null>(null);
  const localeRef = useRef<Locale>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "lt") setLocaleState(stored);
    } catch {
      // localStorage unavailable (e.g. private browsing) — fall back to default locale.
    }
  }, []);

  useEffect(() => {
    localeRef.current = locale;
    document.documentElement.lang = locale;
  }, [locale]);

  // localStorage stays the source of truth for the UI; the profile row is a mirror so the
  // notification Edge Function — which cannot read the browser — mails in the right language.
  const persistLocale = useCallback(async (next: Locale) => {
    const userId = userIdRef.current;
    if (!userId) return;
    try {
      await supabase.from("profiles").update({ locale: next }).eq("id", userId);
    } catch {
      // Offline, or the session went away mid-write. The UI locale is already applied,
      // so a failed mirror must never surface — email just falls back to the stored value.
    }
  }, []);

  useEffect(() => {
    let active = true;

    const track = (userId: string | null) => {
      if (!active) return;
      const previous = userIdRef.current;
      userIdRef.current = userId;
      // On sign-in, push what this browser already prefers: a profile created elsewhere
      // (or before the user ever touched the switcher) would otherwise keep the 'en' default.
      if (userId && userId !== previous) void persistLocale(localeRef.current);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => track(data.session?.user.id ?? null))
      .catch(() => {});

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      track(session?.user.id ?? null);
    });

    return () => { active = false; subscription.unsubscribe(); };
  }, [persistLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localeRef.current = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable — locale still applies for this session.
    }
    void persistLocale(next);
  }, [persistLocale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const value = lookup(dictionaries[locale], key) ?? lookup(dictionaries.en, key);
      if (typeof value !== "string") return key;
      return interpolate(value, vars);
    },
    [locale]
  );

  return <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
