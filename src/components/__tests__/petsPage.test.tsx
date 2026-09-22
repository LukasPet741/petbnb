import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PetsPage from "@/app/(app)/pets/page";

/**
 * Removing a pet, and what happens when the database says no.
 *
 * A pet's row is the parent of every booking it was ever on, and those bookings are the
 * parents of the messages and reviews — so a refused delete has to leave everything where
 * it is, photo included, and say why. Rendered without a LanguageProvider, so `t` is the
 * identity function and each string is the key it asked for.
 */

const h = vi.hoisted(() => ({
  deleteError: null as { code?: string } | null,
  deleted: [] as string[],
  removedPaths: [] as string[][],
}));

vi.mock("@/lib/supabase", () => {
  const rows = [{ id: "pet-1", owner_id: "u1", name: "Luna", photo_url: "https://x.test/photos/u1/luna.jpg" }];
  const table = {
    select: () => table,
    eq: (_col: string, value: string) => {
      // The read path resolves rows; the delete path resolves an error or nothing.
      if (table.mode === "delete") {
        h.deleted.push(value);
        return Promise.resolve({ error: h.deleteError });
      }
      return { order: () => Promise.resolve({ data: rows }) };
    },
    delete: () => { table.mode = "delete"; return table; },
    mode: "select" as "select" | "delete",
  };
  return {
    supabase: {
      from: () => { table.mode = "select"; return table; },
      storage: { from: () => ({ remove: (paths: string[]) => { h.removedPaths.push(paths); return Promise.resolve({ error: null }); } }) },
    },
  };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/pets" }));
vi.mock("@/components/RightRail", () => ({ default: () => null }));
vi.mock("@/lib/upload", () => ({
  PHOTO_BUCKET: "photos",
  storagePathFromPublicUrl: (url: string | null) => (url ? "u1/luna.jpg" : null),
}));

const removePet = async () => {
  const card = await screen.findByText("Luna");
  expect(card).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "appPages.petCard.removeLabel" }));
};

beforeEach(() => {
  h.deleteError = null;
  h.deleted = [];
  h.removedPaths = [];
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("/pets removing a pet", () => {
  it("deletes the row, then the photo, and takes the card away", async () => {
    render(<PetsPage />);
    await removePet();
    await waitFor(() => expect(screen.queryByText("Luna")).toBeNull());
    expect(h.deleted).toEqual(["pet-1"]);
    expect(h.removedPaths).toEqual([["u1/luna.jpg"]]);
  });

  it("keeps the pet, its photo and an explanation when the row is on a booking", async () => {
    h.deleteError = { code: "23503" };
    render(<PetsPage />);
    await removePet();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("appPages.pets.removeHasBookings"));
    expect(screen.getByText("Luna")).toBeTruthy();
    // The photo outlives a refused delete; the other order would have destroyed it.
    expect(h.removedPaths).toEqual([]);
  });

  it("says so for any other refusal rather than pretending the pet is gone", async () => {
    h.deleteError = { code: "42501" };
    render(<PetsPage />);
    await removePet();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("appPages.pets.removeFailed"));
    expect(screen.getByText("Luna")).toBeTruthy();
    expect(h.removedPaths).toEqual([]);
  });
});
