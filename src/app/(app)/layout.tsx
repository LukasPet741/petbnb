"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { NotificationsProvider } from "@/context/NotificationsContext";
import { CollarLiveProvider } from "@/context/CollarLiveContext";
import { withNext } from "@/lib/next-path";
import MoonLoader from "@/components/ui/MoonLoader";

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
      <div className="min-h-[100dvh] flex items-center justify-center" aria-busy="true">
        <MoonLoader size={44} />
      </div>
    );
  }

  if (!user) return null;

  return (
    <FavoritesProvider>
      <NotificationsProvider>
        <CollarLiveProvider>
          {/* No backdrop of its own: the root layout's Atmosphere is the one ambient
              field behind every page, signed in or not. */}
          <div className="min-h-[100dvh]">
            <Sidebar />

            <div className="lg:pl-64 relative z-10">
              {/* Room at the bottom on phones for the tab bar (BottomNav) and the home indicator. */}
              <main className="min-h-[calc(100dvh-3.5rem)] lg:min-h-[100dvh] pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
            </div>
          </div>
        </CollarLiveProvider>
      </NotificationsProvider>
    </FavoritesProvider>
  );
}
