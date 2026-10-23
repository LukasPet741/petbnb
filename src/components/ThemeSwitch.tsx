"use client";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";

/**
 * One button: dark mode on or off. A toggle (aria-pressed), named for what it turns on, so a
 * screen reader hears "Dark mode, pressed" or "not pressed". The icon shows what you get.
 * `onChrome` is for the deep-green header and rail; without it, it sits on light paper.
 */
export default function ThemeSwitch({ onChrome = false, className }: { onChrome?: boolean; className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label={t("common.darkMode")}
      title={t("common.darkMode")}
      className={cn(
        "pb-press grid h-9 w-9 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
        onChrome
          ? "text-chrome-ink-soft hover:text-chrome-ink hover:bg-[var(--chrome-active)] focus-visible:outline-brand-leaf"
          : "border border-ink/10 bg-surface text-ink-soft hover:text-ink focus-visible:outline-brand",
        className,
      )}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
    </button>
  );
}
