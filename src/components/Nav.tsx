"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PawPrint, Menu, X, LayoutDashboard, Search, Heart, CalendarDays, User } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import Avatar from "./Avatar";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/browse", label: "Browse", icon: Search },
  { href: "/pets", label: "My Pets", icon: Heart },
  { href: "/bookings", label: "Bookings", icon: CalendarDays },
  { href: "/profile", label: "Profile", icon: User },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-stone-200 h-16">
      <div className="max-w-6xl mx-auto px-4 h-full flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-stone-900 text-lg">
          <span className="w-8 h-8 bg-[#D95F3B] rounded-lg flex items-center justify-center">
            <PawPrint className="w-5 h-5 text-white" />
          </span>
          PetBnB
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", pathname === href ? "bg-[#D95F3B] text-white" : "text-stone-600 hover:bg-stone-100 hover:text-stone-900")}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link href="/bookings/new" className="px-4 py-2 bg-[#D95F3B] text-white rounded-lg text-sm font-medium hover:bg-[#c4482a] transition-colors">
            Book a sitter
          </Link>
          {profile && (
            <button onClick={handleSignOut} className="flex items-center gap-2">
              <Avatar name={profile.full_name ?? "You"} url={profile.avatar_url} size="sm" />
            </button>
          )}
        </div>

        <button className="md:hidden p-2 rounded-lg hover:bg-stone-100 text-stone-600" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden absolute top-16 inset-x-0 bg-white border-b border-stone-200 shadow-lg">
          <nav className="flex flex-col p-3 gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors", pathname === href ? "bg-[#D95F3B] text-white" : "text-stone-600 hover:bg-stone-100")}>
                <Icon className="w-4 h-4" />{label}
              </Link>
            ))}
            <div className="pt-2 border-t border-stone-100 mt-1 space-y-2">
              <Link href="/bookings/new" onClick={() => setOpen(false)} className="flex items-center justify-center px-4 py-3 bg-[#D95F3B] text-white rounded-lg text-sm font-medium">
                Book a sitter
              </Link>
              <button onClick={handleSignOut} className="w-full px-4 py-3 text-stone-500 rounded-lg text-sm font-medium hover:bg-stone-50 transition-colors">
                Sign out
              </button>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
