"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Search, Heart, CalendarDays, Bookmark, User, Menu, X, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";
import Avatar from "./Avatar";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";

const LINKS = [
  { href: "/dashboard", key: "appShell.sidebar.nav.dashboard", icon: LayoutDashboard },
  { href: "/browse", key: "appShell.sidebar.nav.browse", icon: Search },
  { href: "/pets", key: "appShell.sidebar.nav.pets", icon: Heart },
  { href: "/bookings", key: "appShell.sidebar.nav.bookings", icon: CalendarDays },
  { href: "/saved", key: "appShell.sidebar.nav.saved", icon: Bookmark },
  { href: "/profile", key: "appShell.sidebar.nav.profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => { await signOut(); router.push("/login"); };

  const Inner = (
    <>
      <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center px-2 mb-6">
        <Logo size={32} showWordmark />
      </Link>

      <nav className="space-y-1">
        {LINKS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", active ? "bg-brand-soft text-brand-strong" : "text-ink-soft hover:bg-brand-softer hover:text-ink")}>
              <Icon className="w-[18px] h-[18px]" />{t(key)}
            </Link>
          );
        })}
      </nav>

      <Link href="/browse" onClick={() => setOpen(false)} className="mt-5 flex items-center justify-center gap-2 h-11 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
        <Search className="w-4 h-4" />{t("appShell.findASitter")}
      </Link>

      <div className="flex-1" />

      <div className="px-1 mt-2">
        <LanguageSwitcher />
      </div>

      {profile && (
        <div className="border-t border-ink/8 pt-4 mt-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={profile.full_name ?? t("appShell.sidebar.youFallback")} url={profile.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink truncate">{profile.full_name ?? t("appShell.sidebar.youFallback")}</div>
              <div className="text-xs text-ink-soft truncate">{profile.city ?? ""}</div>
            </div>
            <button onClick={handleSignOut} title={t("appShell.sidebar.signOut")} className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-brand-softer transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-ink-soft/60 px-1 mt-3">{t("appShell.sidebar.footerNote")}</p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className={`lg:hidden sticky top-0 z-40 bg-canvas/85 backdrop-blur-md border-b border-ink/8 h-14 flex items-center justify-between px-4 transition-shadow duration-300 ease-out ${scrolled ? "shadow-[var(--shadow-sm)]" : ""}`}>
        <Link href="/dashboard" className="flex items-center">
          <Logo size={28} showWordmark />
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-ink-soft hover:bg-brand-softer"><Menu className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-surface border-r border-ink/8 flex-col p-4 z-40">
        {Inner}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div className="fixed inset-0 bg-ink/40 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="fixed inset-y-0 left-0 w-72 bg-surface p-4 flex flex-col z-50 shadow-[var(--shadow-lg)]"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 400, damping: 38 }}>
              <button onClick={() => setOpen(false)} className="self-end p-2 rounded-lg text-ink-soft hover:bg-brand-softer -mt-1 mb-1"><X className="w-5 h-5" /></button>
              {Inner}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
