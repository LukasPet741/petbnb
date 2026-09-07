"use client";
import Link from "next/link";
import Logo from "./Logo";
import { useLanguage } from "@/context/LanguageContext";

export default function PublicFooter() {
  const { t } = useLanguage();

  return (
    <footer className="bg-ink text-white py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <Logo size={32} showWordmark wordmarkClassName="text-white text-lg" />
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            <Link href="/login" className="hover:text-white transition-colors">{t("common.signIn")}</Link>
            <Link href="/signup" className="hover:text-white transition-colors">{t("common.createAccount")}</Link>
            <Link href="/legal/terms" className="hover:text-white transition-colors">{t("common.terms")}</Link>
            <Link href="/legal/privacy" className="hover:text-white transition-colors">{t("common.privacy")}</Link>
          </div>
        </div>
        <div className="border-t border-white/10 mt-8 pt-6 text-sm text-white/45 text-center md:text-left">
          © {new Date().getFullYear()} PetBnB. {t("common.footerNote")}
        </div>
      </div>
    </footer>
  );
}
