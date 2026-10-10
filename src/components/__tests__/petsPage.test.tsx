import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PetsPage from "@/app/(app)/pets/page";
import { ConfirmProvider } from "@/components/ui/Confirm";
import { ToastProvider } from "@/components/ui/Toast";
import { MotionGlobalConfig } from "framer-motion";

// The card departs with a layout animation that jsdom cannot measure; the behaviour,
// not the motion, is under test here.
MotionGlobalConfig.skipAnimations = true;

/**
 * Removing a pet (plan §2.4).
 *
 * In the database a pet's deletion CASCADES into every booking it was on
 * (bookings_pet_id_fkey, checked on prod 2026-10-10), and the bookings take their
 * messages and reviews with them — the sitter's history too. So a pet with bookings is
 * kept, without asking, and the page says why; any other pet goes after a Confirm, row
 * first, photo second. Rendered without a LanguageProvider: each string is its key.
 */

const h = vi.hoisted(() => ({
  bookingCount: 0 as number | null,
  countError: null as { code?: string } | null,
  deleteError: null as { code?: string } | null,
  deleted: [] as string[],
  removedPaths: [] as string[][],
}));

vi.mock("@/lib/supabase", () => {
  const rows = [{ id: "pet-1", owner_id: "u1", name: "Luna", photo_url: "https://x.test/photos/u1/luna.jpg" }];
  const pets = {
    mode: "select" as "select" | "delete",
    select: () => pets,
    delete: () => {
      pets.mode = "delete";
      return pets;
    },
    eq: (_col: string, value: string) => {
      if (pets.mode === "delete") {
        h.deleted.push(value);
        return Promise.resolve({ error: h.deleteError });
      }
      return { order: () => Promise.resolve({ data: rows }) };
    },
  };
  const bookings = {
    select: () => bookings,
    eq: () => Promise.resolve({ count: h.bookingCount, error: h.countError }),
  };
  return {
    supabase: {
      from: (table: string) => {
        if (table === "bookings") return bookings;
        pets.mode = "select";
        return pets;
      },
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

const renderPage = () =>
  render(
    <ToastProvider>
      <ConfirmProvider>
        <PetsPage />
      </ConfirmProvider>
    </ToastProvider>,
  );

const removePet = async () => {
  expect(await screen.findByText("Luna")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "appPages.petCard.removeLabel" }));
};

beforeEach(() => {
  h.bookingCount = 0;
  h.countError = null;
  h.deleteError = null;
  h.deleted = [];
  h.removedPaths = [];
});

describe("/pets removing a pet", () => {
  it("asks first, then deletes the row, then the photo, and takes the card away", async () => {
    renderPage();
    await removePet();
    const dialog = await screen.findByRole("dialog", { name: "appPages.pets.removeConfirm" });
    expect(dialog).toHaveTextContent("appPages.pets.removeConfirmBody");
    await userEvent.setup().click(screen.getByRole("button", { name: "appPages.pets.removeButton" }));
    await waitFor(() => expect(screen.queryByText("Luna")).toBeNull());
    expect(h.deleted).toEqual(["pet-1"]);
    expect(h.removedPaths).toEqual([["u1/luna.jpg"]]);
  });

  it("deletes nothing when you choose to keep it", async () => {
    renderPage();
    await removePet();
    await userEvent.setup().click(await screen.findByRole("button", { name: "common.ui.keep" }));
    expect(h.deleted).toEqual([]);
    expect(screen.getByText("Luna")).toBeTruthy();
  });

  it("keeps a pet that has bookings, without asking, and says why", async () => {
    h.bookingCount = 2;
    renderPage();
    await removePet();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("appPages.pets.removeHasBookings"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(h.deleted).toEqual([]);
    expect(h.removedPaths).toEqual([]);
  });

  it("says so for any other refusal rather than pretending the pet is gone", async () => {
    h.deleteError = { code: "42501" };
    renderPage();
    await removePet();
    await userEvent.setup().click(await screen.findByRole("button", { name: "appPages.pets.removeButton" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("appPages.pets.removeFailed"));
    expect(screen.getByText("Luna")).toBeTruthy();
    expect(h.removedPaths).toEqual([]);
  });
});
