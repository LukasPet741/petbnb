"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Search, PawPrint, CalendarDays, MessageCircle, Bookmark, User, Menu, X, LogOut, Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { VerificationMethod } from "@/lib/types";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useCollarLive } from "@/context/CollarLiveContext";
import Avatar from "./Avatar";
import VerifiedSeal from "./VerifiedSeal";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeSwitch from "./ThemeSwitch";
import NotificationBell from "@/components/NotificationBell";
import SidebarSpotlight from "@/components/SidebarSpotlight";
import LiveDot from "@/components/collar/LiveDot";

// Legal moved into the footer line (2026-09-26): the collar and Smart-ID cards took its height,
// and it is reference material, not somewhere anyone came here to go.
const LINKS = [
  { href: "/dashboard", key: "appShell.sidebar.nav.dashboard", icon: LayoutDashboard },
  { href: "/browse", key: "appShell.sidebar.nav.browse", icon: Search },
  { href: "/pets", key: "appShell.sidebar.nav.pets", icon: PawPrint },
  { href: "/bookings", key: "appShell.sidebar.nav.bookings", icon: CalendarDays },
  { href: "/messages", key: "appShell.sidebar.nav.messages", icon: MessageCircle },
  { href: "/saved", key: "appShell.sidebar.nav.saved", icon: Bookmark },
  { href: "/profile", key: "appShell.sidebar.nav.profile", icon: User },
];

// The phone's bottom bar carries the four places people go most; "More" opens the drawer
// with the rest (pets, saved, profile, language). Screens with their own bottom bar or a
// full-height layout hide it: the booking form's Send bar, a chat's composer, a walk map.
const TABS = ["/dashboard", "/browse", "/bookings", "/messages"];
const NO_TAB_BAR = [/^\/bookings\/new/, /^\/messages\/[^/]+/, /^\/walks\/[^/]+/];
export const hasTabBar = (pathname: string) => !NO_TAB_BAR.some((re) => re.test(pathname));

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const { unreadCount } = useNotifications();
  const { state: collarState } = useCollarLive();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the drawer. Without this, dragging the backdrop scrolls the
  // content underneath and closing the drawer drops you somewhere else on the page.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const handleSignOut = async () => { await signOut(); router.push("/login"); };
  const close = () => setOpen(false);
  // /legal redirects to /legal/terms, so this stays current on the privacy tab too.
  const legalActive = pathname === "/legal" || pathname.startsWith("/legal/");
  const collarPulsing = collarState === "live" || collarState === "replaying";

  // Shared by the desktop rail and the mobile drawer. The drawer is opened from the mobile
  // top bar, which carries its own bell, so this one is hidden below lg to avoid two bells
  // on the same screen. It opens left-anchored: a right-anchored panel would run off the
  // left edge of this 256px rail.
  const Inner = (
    <>
      <div className="flex items-center justify-between px-2 mb-4">
        <Link href="/dashboard" onClick={close} className="flex items-center">
          <Logo size={32} showWordmark wordmarkClassName="text-chrome-ink" />
        </Link>
        <div className="hidden lg:block -mr-1">
          <NotificationBell align="left" />
        </div>
      </div>

      <nav className="space-y-0.5">
        {LINKS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge = href === "/messages" ? unreadCount : 0;
          return (
            <Link key={href} href={href} onClick={close}
              // The active state used to be styling only, and colour alone does not
              // tell a screen reader which section it is in.
              aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", active ? "bg-[var(--chrome-active)] text-chrome-ink" : "text-chrome-ink-soft hover:bg-[var(--chrome-active)] hover:text-chrome-ink")}>
              <Icon className="w-[18px] h-[18px]" />{t(key)}
              {badge > 0 && (
                <span className="ml-auto bg-brand-leaf text-brand-deep text-[11px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Below the navigation, not above it: the places someone came to go come first. */}
      <div className="mt-4">
        <SidebarSpotlight onNavigate={close} />
      </div>

      <div className="flex-1" />

      <div className="px-1 mt-2 flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeSwitch onChrome />
      </div>

      <div className="border-t border-[var(--chrome-line)] pt-4 mt-4">
        {profile && (
          <div className="flex items-center gap-3 px-1">
            <Avatar name={profile.full_name ?? t("appShell.sidebar.youFallback")} url={profile.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              {/* The same seal as on sitter cards, and the same rule: only a Smart-ID someone went through. */}
              <div className="flex min-w-0 items-center gap-1">
                <span className="text-sm font-medium text-chrome-ink truncate">{profile.full_name ?? t("appShell.sidebar.youFallback")}</span>
                <VerifiedSeal method={profile.verification_method as VerificationMethod | null | undefined} size="sm" />
              </div>
              <div className="text-xs text-chrome-ink-soft truncate">{profile.city ?? ""}</div>
            </div>
            <button onClick={handleSignOut} title={t("appShell.sidebar.signOut")} className="p-2 rounded-lg text-chrome-ink-soft hover:text-chrome-ink hover:bg-[var(--chrome-active)] transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        )}
        <p className="text-[11px] text-chrome-ink-soft/70 px-1 mt-3">
          {t("appShell.sidebar.footerNote")} ·{" "}
          <Link href="/legal" onClick={close} aria-current={legalActive ? "page" : undefined}
            className={cn("underline-offset-2 hover:underline", legalActive ? "font-medium text-chrome-ink" : "text-chrome-ink-soft")}>
            {t("appShell.sidebar.nav.legal")}
          </Link>
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className={`lg:hidden sticky top-0 z-40 bg-chrome text-chrome-ink border-b border-[var(--chrome-line)] h-14 flex items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] transition-shadow duration-300 ease-out ${scrolled ? "shadow-[var(--shadow-sm)]" : ""}`}>
        <Link href="/dashboard" className="flex items-center">
          <Logo size={28} showWordmark wordmarkClassName="text-chrome-ink" />
        </Link>
        <div className="flex items-center gap-1.5">
          <Link href="/collar" aria-label={t("appShell.spotlight.collarButton")}
            className="relative grid h-9 w-9 place-items-center rounded-xl bg-brand-mid text-chrome-ink">
            <Radar className="h-[17px] w-[17px]" aria-hidden="true" />
            {collarPulsing && <LiveDot className="absolute -right-0.5 -top-0.5" />}
          </Link>
          <NotificationBell />
          {/* Where there is no tab bar (and so no More), the menu stays reachable from here. */}
          {!hasTabBar(pathname) && (
            <button type="button" onClick={() => setOpen(true)} aria-label={t("appShell.sidebar.openMenu")} aria-expanded={open} className="p-2 rounded-lg text-chrome-ink-soft hover:bg-[var(--chrome-active)]"><Menu className="w-5 h-5" aria-hidden="true" /></button>
          )}
        </div>
      </header>

      {/* Phone tab bar */}
      {hasTabBar(pathname) && (
        <nav aria-label={t("appShell.sidebar.tabBarLabel")}
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-chrome border-t border-[var(--chrome-line)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <div className="grid grid-cols-5 h-16">
            {TABS.map((href) => {
              const link = LINKS.find((l) => l.href === href)!;
              const Icon = link.icon;
              const active = pathname === href || pathname.startsWith(href + "/");
              const badge = href === "/messages" ? unreadCount : 0;
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined}
                  className={cn("pb-press relative flex flex-col items-center justify-center gap-1 text-xs font-medium", active ? "text-chrome-ink" : "text-chrome-ink-soft")}>
                  <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-colors", active && "bg-brand-mid")}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="max-w-full truncate px-1">{t(link.key)}</span>
                  {badge > 0 && (
                    <span className="absolute top-1.5 left-1/2 ml-2 bg-brand-leaf text-brand-deep text-xs font-semibold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </Link>
              );
            })}
            <button type="button" onClick={() => setOpen(true)} aria-expanded={open}
              className="pb-press flex flex-col items-center justify-center gap-1 text-xs font-medium text-chrome-ink-soft">
              <span className="grid h-7 w-12 place-items-center rounded-full"><Menu className="h-5 w-5" aria-hidden="true" /></span>
              <span>{t("appShell.sidebar.moreTab")}</span>
            </button>
          </div>
        </nav>
      )}

      {/* Desktop fixed sidebar. Scrolls on short screens now that it carries the spotlight cards,
          without a visible scrollbar: a 10 px Windows one narrowed the cards and clipped their text. */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-chrome text-chrome-ink border-r border-[var(--chrome-line)] flex-col p-4 z-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {Inner}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div className="fixed inset-0 glass-scrim z-50 touch-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
            <motion.aside className="fixed inset-y-0 left-0 w-72 bg-chrome text-chrome-ink flex flex-col z-50 overflow-y-auto overscroll-contain pl-[max(1rem,env(safe-area-inset-left))] pr-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 400, damping: 38 }}
              // Swipe it back to the left to close, the way a phone's drawers work.
              drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={{ left: 0.5, right: 0 }}
              onDragEnd={(_, info) => { if (info.offset.x < -80 || info.velocity.x < -500) close(); }}>
              <button type="button" onClick={close} aria-label={t("appShell.sidebar.closeMenu")} className="pb-press self-end p-2 rounded-full text-chrome-ink-soft hover:bg-[var(--chrome-active)] -mt-1 mb-1"><X className="w-5 h-5" aria-hidden="true" /></button>
              {Inner}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
