"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, LayoutDashboard, MessageCircle, MoreHorizontal, Search, type LucideIcon } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { DUR, EASE, SPRING_SOFT } from "@/lib/motion";
import { cn } from "@/lib/utils";

const TABS: { href: string; key: string; icon: LucideIcon }[] = [
  { href: "/dashboard", key: "appShell.sidebar.nav.dashboard", icon: LayoutDashboard },
  { href: "/browse", key: "appShell.sidebar.nav.browse", icon: Search },
  { href: "/bookings", key: "appShell.sidebar.nav.bookings", icon: CalendarDays },
  { href: "/messages", key: "appShell.sidebar.nav.messages", icon: MessageCircle },
];

/**
 * The phone's tab bar (below lg): the four places a thumb needs most, and More for the
 * drawer with everything else. The active pill glides between tabs (a shared layoutId),
 * the icon gives a small hop when you arrive, and the bar slides away while you scroll
 * down a page and comes back the moment you scroll up. Sits above the home indicator.
 */
export default function BottomNav({ pathname, unread, onMore }: { pathname: string; unread: number; onMore: () => void }) {
  const { t } = useLanguage();
  const hidden = useHideOnScroll();

  return (
    <motion.nav
      aria-label={t("appShell.sidebar.tabs")}
      data-bottom-nav=""
      animate={{ y: hidden ? "110%" : 0 }}
      transition={{ duration: DUR.calm, ease: EASE.calm }}
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 glass border-t pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
    >
      <ul className="grid grid-cols-5 h-16">
        {TABS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge = href === "/messages" ? unread : 0;
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => !active && tick()}
                className="pb-press flex-1 flex flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand"
              >
                <span className="relative grid place-items-center w-14 h-8">
                  {active && (
                    <motion.span layoutId="pb-tab-pill" transition={SPRING_SOFT} className="absolute inset-0 rounded-full bg-brand-soft" />
                  )}
                  <motion.span
                    key={active ? "on" : "off"}
                    initial={false}
                    animate={active ? { scale: [1, 1.18, 1], y: [0, -2, 0] } : { scale: 1, y: 0 }}
                    transition={{ duration: DUR.calm, ease: EASE.calm }}
                    className={cn("relative", active ? "text-brand-strong" : "text-ink-soft")}
                  >
                    <Icon className="w-5 h-5" strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                  </motion.span>
                  {badge > 0 && (
                    <span className="absolute top-0 right-2 min-w-[18px] h-[18px] px-1 grid place-items-center rounded-full bg-amber text-ink text-xs font-bold leading-none ring-2 ring-surface">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span className={cn("text-xs leading-none", active ? "font-semibold text-ink" : "font-medium text-ink-soft")}>{t(key)}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex">
          <button
            type="button"
            onClick={onMore}
            className="pb-press flex-1 flex flex-col items-center justify-center gap-1 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-brand"
          >
            <span className="grid place-items-center w-14 h-8 text-ink-soft">
              <MoreHorizontal className="w-5 h-5" aria-hidden="true" />
            </span>
            <span className="text-xs font-medium leading-none text-ink-soft">{t("appShell.sidebar.more")}</span>
          </button>
        </li>
      </ul>
    </motion.nav>
  );
}

/** A light haptic tick on Android when you switch tabs; iOS and desktops ignore it. */
function tick() {
  try {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) navigator.vibrate?.(6);
  } catch {
    /* no vibration API */
  }
}

/** True while the reader scrolls down a page; false again as soon as they scroll up. */
function useHideOnScroll() {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    last.current = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - last.current;
      if (Math.abs(delta) < 8) return;
      setHidden(delta > 0 && y > 120);
      last.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return hidden;
}
