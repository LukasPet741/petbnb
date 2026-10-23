/**
 * Light or dark, chosen by the visitor (ThemeSwitch). Light is the default and the OS
 * setting is not followed: dark is something you ask for, and then it is remembered.
 *
 * The choice lives in localStorage and is applied as data-theme="dark" on <html>, which
 * redefines the colour tokens in globals.css.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "petbnb-theme";

export function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    // localStorage unavailable (private browsing, blocked storage): stay light.
    return "light";
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
}

/**
 * Runs in <head> before the page paints (root layout, next/script beforeInteractive), so a
 * visitor who chose dark never sees a light flash first. Kept tiny and self-contained:
 * it cannot import anything.
 */
export const THEME_BOOT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;
