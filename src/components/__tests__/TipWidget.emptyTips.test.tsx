import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

/**
 * The empty-TIPS case lives in its own file deliberately.
 *
 * Testing it inside TipWidget.test.tsx required vi.resetModules() plus a
 * dynamic re-import mid-file, which rebuilds the module registry and hands the
 * re-imported component a *second* React context instance. That passed in
 * isolation but crashed the worker process outright when run after the other
 * tests, taking the rest of the file down with it. A file-level vi.mock has no
 * such hazard: the module graph is mocked once, before anything imports it.
 */
vi.mock("@/lib/tips", () => ({ TIPS: [] }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

vi.mock("framer-motion", async (orig) => {
  const actual = await orig<typeof import("framer-motion")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const { default: TipWidget } = await import("@/components/TipWidget");

afterEach(() => {
  vi.useRealTimers();
});

describe("TipWidget with an empty tip list", () => {
  // BUG (src/components/TipWidget.tsx:102): the rotation index is computed as
  // `(p + 1) % order.length`, which is NaN when the list is empty, and
  // `order[NaN]` is undefined. After the first tick the card area is blank
  // forever with no way to recover, and no crash to make the failure visible.
  // Correct behaviour would be to skip scheduling the interval entirely when
  // order.length === 0.
  it("renders no card and no dots to begin with", () => {
    const { container } = render(<TipWidget intervalMs={1000} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("stays blank after the first tick instead of recovering (current buggy behaviour)", () => {
    vi.useFakeTimers();
    const { container } = render(<TipWidget intervalMs={1000} />);

    act(() => void vi.advanceTimersByTime(1000));

    // The index is now NaN, so nothing indexes back into view.
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("keeps scheduling ticks forever even though there is nothing to show", () => {
    // The effect does not guard on an empty list, so the interval is still
    // installed and still firing - wasted work on every mounted dashboard.
    vi.useFakeTimers();
    const before = vi.getTimerCount();
    const { unmount } = render(<TipWidget intervalMs={1000} />);
    expect(vi.getTimerCount()).toBeGreaterThan(before);
    unmount();
    expect(vi.getTimerCount()).toBe(before);
  });
});
