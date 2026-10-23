import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeSwitch from "@/components/ThemeSwitch";
import { ThemeProvider } from "@/context/ThemeContext";
import { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

// Rendered without a LanguageProvider, so `t` returns the key.
const renderSwitch = () =>
  render(
    <ThemeProvider>
      <ThemeSwitch />
    </ThemeProvider>,
  );

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("ThemeSwitch", () => {
  it("starts light: dark is something you ask for, not the default", () => {
    renderSwitch();
    expect(screen.getByRole("button", { name: "common.darkMode" })).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("turns dark on and off, and remembers the choice", () => {
    renderSwitch();
    const button = screen.getByRole("button", { name: "common.darkMode" });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("picks up a dark choice saved on an earlier visit", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderSwitch();
    expect(screen.getByRole("button", { name: "common.darkMode" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the theme boot script", () => {
  it("applies a saved dark choice before React runs", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("leaves the page light when nothing, or light, was saved", () => {
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBeUndefined();
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    new Function(THEME_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
