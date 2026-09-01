"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { NotificationsProvider } from "@/context/NotificationsContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { isComplete, loading: profileLoading } = useProfile();

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!user) { router.replace("/login"); return; }
    if (!isComplete && pathname !== "/profile") router.replace("/profile");
  }, [user, authLoading, profileLoading, isComplete, pathname, router]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-[100dvh] bg-canvas flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <FavoritesProvider>
      <NotificationsProvider>
        <div className="min-h-[100dvh]">
          {/* Ambient warmth */}
          <div aria-hidden className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-48 -right-40 w-[40rem] h-[40rem] rounded-full bg-brand/10 blur-3xl" />
            <div className="absolute top-1/4 -left-44 w-[34rem] h-[34rem] rounded-full bg-amber/15 blur-3xl" />
            <div className="absolute -bottom-40 left-1/3 w-[34rem] h-[34rem] rounded-full bg-brand-soft/40 blur-3xl" />
          </div>

          <Sidebar />

          <div className="lg:pl-64 relative z-10">
            <main className="min-h-[calc(100dvh-3.5rem)] lg:min-h-[100dvh]">{children}</main>
          </div>
        </div>
      </NotificationsProvider>
    </FavoritesProvider>
  );
}
