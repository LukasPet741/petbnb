import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePageTitle } from "@/hooks/usePageTitle";

const DEFAULT = "PetBnB: Pet sitters near you in Lithuania";

describe("usePageTitle", () => {
  beforeEach(() => {
    document.title = DEFAULT;
  });

  it("frames the title with the brand, follows changes and restores the default on unmount", () => {
    const { rerender, unmount } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "Bookings" },
    });
    expect(document.title).toBe("Bookings · PetBnB");

    rerender({ title: "Užsakymai" });
    expect(document.title).toBe("Užsakymai · PetBnB");

    unmount();
    expect(document.title).toBe(DEFAULT);
  });

  it("keeps a title the next route's metadata already set", () => {
    const { unmount } = renderHook(() => usePageTitle("Bookings"));
    document.title = "Log in · PetBnB";
    unmount();
    expect(document.title).toBe("Log in · PetBnB");
  });

  it("leaves the tab alone while the title is still loading", () => {
    renderHook(() => usePageTitle(undefined));
    expect(document.title).toBe(DEFAULT);
  });
});
