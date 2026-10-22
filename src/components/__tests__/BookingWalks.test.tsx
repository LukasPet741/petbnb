import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import BookingWalks from "@/components/BookingWalks";
import type { CollarWalk } from "@/lib/collar/walks";

const h = vi.hoisted(() => ({ loadBookingWalks: vi.fn(), startWalk: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/collar/walks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/collar/walks")>()),
  loadBookingWalks: (...a: unknown[]) => h.loadBookingWalks(...a),
  startWalk: (...a: unknown[]) => h.startWalk(...a),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));

const walk = (id: string, over: Partial<CollarWalk> = {}): CollarWalk => ({
  id, device_id: "c1", booking_id: "b1", walker_id: "s1", walker_name: "Jonas", walked_by_me: true,
  started_at: "2026-10-22T10:00:00Z", ended_at: "2026-10-22T10:30:00Z", end_reason: "stopped", points: [], ...over,
});

async function renderSlot() {
  const view = render(<BookingWalks bookingId="b1" />);
  await act(async () => {});
  return view;
}

beforeEach(() => {
  h.loadBookingWalks.mockReset();
  h.startWalk.mockReset().mockResolvedValue("w9");
  h.push.mockReset();
});

describe("BookingWalks", () => {
  it("shows nothing when there is no collar to walk with and no walk yet", async () => {
    h.loadBookingWalks.mockResolvedValue({ collars: [], running: null, recent: [] });
    const { container } = await renderSlot();
    expect(h.loadBookingWalks).toHaveBeenCalledWith("b1");
    expect(container.textContent).toBe("");
  });

  it("starts a walk on the owner's collar and opens it", async () => {
    h.loadBookingWalks.mockResolvedValue({ collars: [{ id: "c1", label: "Antkaklis" }], running: null, recent: [] });
    await renderSlot();
    expect(screen.queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.start" }));
    await act(async () => {});
    expect(h.startWalk).toHaveBeenCalledWith("c1", "b1");
    expect(h.push).toHaveBeenCalledWith("/walks/w9");
  });

  it("lets the sitter pick the collar when the owner has two", async () => {
    h.loadBookingWalks.mockResolvedValue({ collars: [{ id: "c1", label: "Antkaklis" }, { id: "c2", label: null }], running: null, recent: [] });
    await renderSlot();
    fireEvent.change(screen.getByRole("combobox", { name: "appPages.collar.walks.pickCollar" }), { target: { value: "c2" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.start" }));
    await act(async () => {});
    expect(h.startWalk).toHaveBeenCalledWith("c2", "b1");
  });

  it("leads back into a walk that is still running", async () => {
    h.loadBookingWalks.mockResolvedValue({ collars: [{ id: "c1", label: null }], running: walk("w1", { ended_at: null, end_reason: null }), recent: [] });
    await renderSlot();
    expect(screen.getByRole("link", { name: "appPages.collar.walks.open" }).getAttribute("href")).toBe("/walks/w1");
    expect(screen.queryByRole("button", { name: "appPages.collar.walks.start" })).toBeNull();
  });

  it("keeps the sitter's saved walks after the stay", async () => {
    h.loadBookingWalks.mockResolvedValue({ collars: [], running: null, recent: [walk("w2"), walk("w1")] });
    await renderSlot();
    expect(screen.getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual(["/walks/w2", "/walks/w1"]);
  });

  it("says when the collar already has a walk running", async () => {
    h.loadBookingWalks.mockResolvedValue({ collars: [{ id: "c1", label: null }], running: null, recent: [] });
    h.startWalk.mockRejectedValue(new Error("walk_running"));
    await renderSlot();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.walks.start" }));
    await act(async () => {});
    expect(screen.getByRole("alert").textContent).toBe("appPages.collar.walks.running");
    expect(h.push).not.toHaveBeenCalled();
  });
});
