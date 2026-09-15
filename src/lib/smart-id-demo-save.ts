/**
 * Saving a Smart-ID demo verification on the signed-in user's profile (spec
 * 2026-09-15-smart-id-demo-badge-design.md). The browser only names the session; the database
 * asks SK's demo service about it (pg_net, so the answer arrives a moment later) and decides.
 */

export type SaveResult = "verified" | "not_verified" | "signed_out" | "error";

interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { hint?: string } | null }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function saveDemoVerification(
  sessionId: string,
  client?: RpcClient,
  { waitMs = 700, attempts = 15 }: { waitMs?: number; attempts?: number } = {},
): Promise<SaveResult> {
  try {
    // Loaded lazily, so the demo page's other states never need a configured client.
    const db = client ?? ((await import("@/lib/supabase")).supabase as unknown as RpcClient);

    const requested = await db.rpc("request_smart_id_demo_verification", { p_session_id: sessionId });
    if (requested.error) return requested.error.hint === "signed_out" ? "signed_out" : "error";

    for (let i = 0; i < attempts; i++) {
      if (waitMs > 0) await sleep(waitMs);
      const finished = await db.rpc("finish_smart_id_demo_verification", { p_session_id: sessionId });
      if (finished.error) return finished.error.hint === "signed_out" ? "signed_out" : "error";
      if (finished.data === "verified" || finished.data === "not_verified") return finished.data;
    }
    return "error";
  } catch {
    return "error";
  }
}
