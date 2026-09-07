"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import { useLanguage } from "@/context/LanguageContext";

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-50 glass border-b transition-shadow duration-300 ease-out ${scrolled ? "shadow-[var(--shadow-sm)]" : ""}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Logo size={32} showWordmark />
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher className="mr-1" />
          <Link href="/login" className="text-sm font-medium text-ink-soft hover:text-ink transition-colors px-3 py-2">{t("common.signIn")}</Link>
          <Link href="/signup" className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium hover:bg-brand-strong transition-colors">
            {t("common.getStarted")}
          </Link>
        </div>
      </div>
    </header>
  );
}
