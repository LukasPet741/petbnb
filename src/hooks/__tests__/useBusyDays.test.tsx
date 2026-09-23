import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useBusyDays } from "@/hooks/useBusyDays";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase", () => ({ supabase: { rpc: rpcMock } }));

beforeEach(() => {
  rpcMock.mockReset();
  rpcMock.mockResolvedValue({ data: [], error: null });
});

describe("useBusyDays", () => {
  it("asks nothing while there is no sitter yet", () => {
    const { result } = renderHook(() => useBusyDays(null, "2026-10-01", "2026-12-01"));
    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.current.busy.size).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it("reads one sitter's busy days in one call and merges them (booked wins)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        { day: "2026-10-02", kind: "off" },
        { day: "2026-10-05", kind: "booked" },
        { day: "2026-10-05", kind: "off" },
      ],
      error: null,
    });
    const { result } = renderHook(() => useBusyDays("s1", "2026-10-01", "2026-12-01"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("sitter_busy_days", { p_sitter: "s1", p_from: "2026-10-01", p_to: "2026-12-01" });
    expect([...result.current.busy]).toEqual([["2026-10-02", "off"], ["2026-10-05", "booked"]]);
  });

  it("a failed read shows every day free: the database still refuses a clash", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { result } = renderHook(() => useBusyDays("s1", "2026-10-01", "2026-12-01"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.busy.size).toBe(0);
  });

  it("reload asks again, for after a sitter toggles a day", async () => {
    const { result } = renderHook(() => useBusyDays("s1", "2026-10-01", "2026-12-01"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    rpcMock.mockResolvedValue({ data: [{ day: "2026-10-03", kind: "off" }], error: null });
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.busy.get("2026-10-03")).toBe("off"));
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });
});
