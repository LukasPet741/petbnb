"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { withNext } from "@/lib/next-path";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { isComplete, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading || profileLoading) return;
    // Both bounces remember the page asked for, query included, so a visitor who clicked
    // "Find a groomer" on the landing page ends up at the filtered list after logging in or
    // finishing their profile, not at the dashboard.
    const here = window.location.pathname + window.location.search;
    if (!user) { router.replace(withNext("/login", here)); return; }
    if (!isComplete && pathname !== "/profile") router.replace(withNext("/profile", here));
  }, [user, authLoading, profileLoading, isComplete, pathname, router]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <FavoritesProvider>
      <NotificationsProvider>
        {/* No backdrop of its own: the root layout's Atmosphere is the one ambient
            field behind every page, signed in or not. */}
        <div className="min-h-[100dvh]">
          <Sidebar />

          <div className="lg:pl-64 relative z-10">
            <main className="min-h-[calc(100dvh-3.5rem)] lg:min-h-[100dvh]">{children}</main>
          </div>
        </div>
      </NotificationsProvider>
    </FavoritesProvider>
  );
}
