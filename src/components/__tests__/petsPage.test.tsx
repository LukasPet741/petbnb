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
 * A pet on a booking is part of the sitter's history too (the booking, its messages, its
 * reviews), so it is archived, never deleted: after a Confirm it leaves the owner's lists
 * and stays on the bookings. Any other pet is deleted after a Confirm, row first, photo
 * second. Rendered without a LanguageProvider: each string is its key.
 */

const h = vi.hoisted(() => ({
  bookingCount: 0 as number | null,
  countError: null as { code?: string } | null,
  deleteError: null as { code?: string } | null,
  deleted: [] as string[],
  archived: [] as { id: string; archived_at: unknown }[],
  archiveError: null as { code?: string } | null,
  listFilters: [] as [string, unknown][],
  removedPaths: [] as string[][],
}));

vi.mock("@/lib/supabase", () => {
  const rows = [{ id: "pet-1", owner_id: "u1", name: "Luna", photo_url: "https://x.test/photos/u1/luna.jpg" }];
  let patch: Record<string, unknown> = {};
  const list = {
    is: (col: string, value: unknown) => {
      h.listFilters.push([col, value]);
      return list;
    },
    order: () => Promise.resolve({ data: rows }),
  };
  const pets = {
    mode: "select" as "select" | "delete" | "update",
    select: () => pets,
    delete: () => {
      pets.mode = "delete";
      return pets;
    },
    update: (values: Record<string, unknown>) => {
      pets.mode = "update";
      patch = values;
      return pets;
    },
    eq: (_col: string, value: string) => {
      if (pets.mode === "delete") {
        h.deleted.push(value);
        return Promise.resolve({ error: h.deleteError });
      }
      if (pets.mode === "update") {
        h.archived.push({ id: value, archived_at: patch.archived_at });
        return Promise.resolve({ error: h.archiveError });
      }
      return list;
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
// One user object, as AuthContext gives: a new one per render would reload the list forever.
const auth = vi.hoisted(() => ({ user: { id: "u1" } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
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
  h.archived = [];
  h.archiveError = null;
  h.listFilters = [];
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

  it("lists only the pets you have not archived", async () => {
    renderPage();
    expect(await screen.findByText("Luna")).toBeTruthy();
    expect(h.listFilters.length).toBeGreaterThan(0);
    expect(h.listFilters.every(([col, value]) => col === "archived_at" && value === null)).toBe(true);
  });

  it("archives a pet that has bookings after a Confirm: never deleted, photo kept for the bookings", async () => {
    h.bookingCount = 2;
    renderPage();
    await removePet();
    const dialog = await screen.findByRole("dialog", { name: "appPages.pets.archiveConfirm" });
    expect(dialog).toHaveTextContent("appPages.pets.archiveConfirmBody");
    await userEvent.setup().click(screen.getByRole("button", { name: "appPages.pets.archiveButton" }));
    await waitFor(() => expect(screen.queryByText("Luna")).toBeNull());
    expect(h.archived).toHaveLength(1);
    expect(h.archived[0].id).toBe("pet-1");
    expect(typeof h.archived[0].archived_at).toBe("string");
    expect(h.deleted).toEqual([]);
    expect(h.removedPaths).toEqual([]);
  });

  it("archives nothing when you choose to keep a pet with bookings", async () => {
    h.bookingCount = 2;
    renderPage();
    await removePet();
    await userEvent.setup().click(await screen.findByRole("button", { name: "common.ui.keep" }));
    expect(h.archived).toEqual([]);
    expect(screen.getByText("Luna")).toBeTruthy();
  });

  it("says so when the archive fails, and keeps the card", async () => {
    h.bookingCount = 2;
    h.archiveError = { code: "42501" };
    renderPage();
    await removePet();
    await userEvent.setup().click(await screen.findByRole("button", { name: "appPages.pets.archiveButton" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("appPages.pets.removeFailed"));
    expect(screen.getByText("Luna")).toBeTruthy();
  });

  it("explains a delete the database refuses because a booking appeared meanwhile", async () => {
    h.deleteError = { code: "23503" };
    renderPage();
    await removePet();
    await userEvent.setup().click(await screen.findByRole("button", { name: "appPages.pets.removeButton" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("appPages.pets.removeHasBookings"));
    expect(screen.getByText("Luna")).toBeTruthy();
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
