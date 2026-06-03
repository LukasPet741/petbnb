"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useAuth } from "@/context/AuthContext";
import { useProfile } from "@/hooks/useProfile";

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
      <div className="min-h-screen bg-[#F8F6F3] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#D95F3B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F3]">
      <Nav />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
