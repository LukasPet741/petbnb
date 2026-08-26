"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PawPrint, LayoutDashboard, Search, Heart, CalendarDays, Bookmark, User, Menu, X, LogOut } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import Avatar from "./Avatar";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/browse", label: "Browse", icon: Search },
  { href: "/pets", label: "My Pets", icon: Heart },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => { await signOut(); router.push("/login"); };

  const Inner = (
    <>
      <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 font-semibold text-lg text-ink px-2 mb-6">
        <span className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center"><PawPrint className="w-5 h-5 text-white" /></span>
        <span className="font-display tracking-tight">PetBnB</span>
      </Link>

      <nav className="space-y-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href} onClick={() => setOpen(false)}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", active ? "bg-brand-soft text-brand-strong" : "text-ink-soft hover:bg-brand-softer hover:text-ink")}>
              <Icon className="w-[18px] h-[18px]" />{label}
            </Link>
          );
        })}
      </nav>

      <Link href="/browse" onClick={() => setOpen(false)} className="mt-5 flex items-center justify-center gap-2 h-11 bg-brand text-white rounded-xl text-sm font-medium hover:bg-brand-strong transition-colors">
        <Search className="w-4 h-4" />Find a sitter
      </Link>

      <div className="flex-1" />

      {profile && (
        <div className="border-t border-black/5 pt-4 mt-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={profile.full_name ?? "You"} url={profile.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink truncate">{profile.full_name ?? "You"}</div>
              <div className="text-xs text-ink-soft truncate">{profile.city ?? ""}</div>
            </div>
            <button onClick={handleSignOut} title="Sign out" className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-brand-softer transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
          <p className="text-[11px] text-ink-soft/60 px-1 mt-3">PetBnB · a student project</p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-40 bg-canvas/85 backdrop-blur-md border-b border-black/5 h-14 flex items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-ink">
          <span className="w-7 h-7 bg-brand rounded-lg flex items-center justify-center"><PawPrint className="w-4 h-4 text-white" /></span>
          <span className="font-display tracking-tight">PetBnB</span>
        </Link>
        <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-ink-soft hover:bg-brand-softer"><Menu className="w-5 h-5" /></button>
      </header>

      {/* Desktop fixed sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-surface border-r border-black/5 flex-col p-4 z-40">
        {Inner}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div className="fixed inset-0 bg-ink/40 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside className="fixed inset-y-0 left-0 w-72 bg-surface p-4 flex flex-col z-50 shadow-xl"
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
