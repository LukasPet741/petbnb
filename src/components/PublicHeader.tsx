"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeSwitch from "./ThemeSwitch";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "@/lib/auth";

/* Section links are written as "/#id" so they also work from /legal and the other
   public pages that share this header; on "/" Next just scrolls to the section. */
const NAV = [
  { href: "/browse", key: "home.nav.findSitters" },
  { href: "/#services", key: "home.nav.services" },
  { href: "/#how-it-works", key: "home.nav.how" },
  { href: "/#become-a-sitter", key: "home.nav.becomeSitter" },
  { href: "/#faq", key: "home.nav.faq" },
] as const;

// The header is the deep-green chrome (Spruce & Moss, look Layered), so its colours come
// from the --chrome-* tokens and the call to action is leaf on deep.
const PRIMARY = "pb-press h-9 inline-flex items-center justify-center whitespace-nowrap px-4 bg-brand-leaf text-brand-deep rounded-full text-sm font-semibold hover:brightness-110 transition";
const QUIET = "h-9 inline-flex items-center justify-center whitespace-nowrap px-3 rounded-full text-sm font-medium text-chrome-ink-soft hover:text-chrome-ink hover:bg-[var(--chrome-active)] transition-colors";

const MENU_ITEM = "min-h-11 flex items-center rounded-lg px-2 text-base font-medium text-chrome-ink hover:bg-[var(--chrome-active)] transition-colors";

export default function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A link inside the menu navigates (or scrolls) away; the menu should not follow.
  useEffect(() => setOpen(false), [pathname]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    router.refresh();
  };

  // Signed in, "Sign in" and "Get started" read as being logged out; signed out,
  // an app link reads as being logged in. The header says which one you are.
  const secondary = (className: string) => user ? (
    <button type="button" onClick={handleSignOut} className={className}>{t("home.nav.signOut")}</button>
  ) : (
    <Link href="/login" className={className}>{t("common.signIn")}</Link>
  );
  const primary = user ? (
    <Link href="/dashboard" className={PRIMARY}>{t("home.nav.myAccount")}</Link>
  ) : (
    <Link href="/signup" className={PRIMARY}>{t("common.getStarted")}</Link>
  );

  return (
    <header className={`sticky top-0 z-50 bg-chrome text-chrome-ink border-b border-[var(--chrome-line)] transition-shadow duration-300 ease-out ${scrolled || open ? "shadow-[var(--shadow-md)]" : ""}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center shrink-0">
          {/* The wordmark gives way below 440px: with it, the Lithuanian labels pushed the
              header past a 390px phone and the whole page scrolled sideways. The mark keeps
              its aria-label, so the link is still named. */}
          <Logo size={32} showWordmark wordmarkClassName="text-chrome-ink hidden min-[440px]:inline" />
        </Link>

        <nav aria-label={t("home.nav.label")} className="hidden lg:flex items-center gap-0.5">
          {NAV.map(({ href, key }) => (
            <Link key={href} href={href} className={QUIET}>{t(key)}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeSwitch onChrome />
          <LanguageSwitcher />
          <div className="hidden md:flex">{secondary(QUIET)}</div>
          {primary}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="public-menu"
            aria-label={t(open ? "home.nav.closeMenu" : "home.nav.openMenu")}
            className="lg:hidden w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-full text-chrome-ink hover:bg-[var(--chrome-active)] transition-colors"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="public-menu" className="lg:hidden border-t border-[var(--chrome-line)]">
          <nav aria-label={t("home.nav.label")} className="max-w-6xl mx-auto px-4 py-3 flex flex-col">
            {NAV.map(({ href, key }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className={MENU_ITEM}>
                {t(key)}
              </Link>
            ))}
            <div className="md:hidden mt-2 pt-2 border-t border-[var(--chrome-line)] flex flex-col">{secondary(MENU_ITEM)}</div>
          </nav>
        </div>
      )}
    </header>
  );
}
