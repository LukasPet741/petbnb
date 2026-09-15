import { describe, it, expect, vi } from "vitest";
import { saveDemoVerification } from "@/lib/smart-id-demo-save";

/**
 * Saving a Smart-ID demo verification: ask the database to check the session with SK, then
 * wait for its answer (pg_net answers after a moment). The client is faked.
 */

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { hint?: string } | null }>;

function client(request: Awaited<ReturnType<Rpc>>, finishes: Array<Awaited<ReturnType<Rpc>>>) {
  const rpc = vi.fn<Rpc>(async (fn) => (fn === "request_smart_id_demo_verification" ? request : finishes.shift() ?? { data: "pending", error: null }));
  return { rpc };
}

const noWait = { waitMs: 0 };

describe("saveDemoVerification", () => {
  it("requests the check, waits while pending, and reports verified", async () => {
    const c = client({ data: null, error: null }, [
      { data: "pending", error: null },
      { data: "verified", error: null },
    ]);
    expect(await saveDemoVerification("s-1", c, noWait)).toBe("verified");
    expect(c.rpc).toHaveBeenNthCalledWith(1, "request_smart_id_demo_verification", { p_session_id: "s-1" });
    expect(c.rpc).toHaveBeenNthCalledWith(2, "finish_smart_id_demo_verification", { p_session_id: "s-1" });
    expect(c.rpc).toHaveBeenCalledTimes(3);
  });

  it("reports not_verified when SK did not confirm the session", async () => {
    const c = client({ data: null, error: null }, [{ data: "not_verified", error: null }]);
    expect(await saveDemoVerification("s-1", c, noWait)).toBe("not_verified");
  });

  it("tells a signed-out visitor to sign in", async () => {
    const c = client({ data: null, error: { hint: "signed_out" } }, []);
    expect(await saveDemoVerification("s-1", c, noWait)).toBe("signed_out");
    expect(c.rpc).toHaveBeenCalledTimes(1);
  });

  it("gives up with an error when the answer never arrives or a call fails", async () => {
    expect(await saveDemoVerification("s-1", client({ data: null, error: null }, []), { waitMs: 0, attempts: 3 })).toBe("error");
    expect(await saveDemoVerification("s-1", client({ data: null, error: { hint: "provider" } }, []), noWait)).toBe("error");
    expect(await saveDemoVerification("s-1", client({ data: null, error: null }, [{ data: null, error: {} }]), noWait)).toBe("error");
  });
});
