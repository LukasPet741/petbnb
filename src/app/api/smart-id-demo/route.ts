import { pollDemo, startDemo } from "@/lib/smart-id-demo-api";

/**
 * POST /api/smart-id-demo — the /smart-id-demo page's only server call.
 *   { action: "start", identity }             -> { sessionId, rpChallenge, verificationCode }
 *   { action: "poll", sessionId, rpChallenge } -> { state: "running" } | { state: "complete", outcome, verification? }
 *
 * Talks only to SK's DEMO environment and only for SK's test identities (see lib/smart-id-demo-api).
 * Never cached: every call is a fresh session or a fresh status.
 */

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400, headers: noStore });
  }

  if (body.action === "start" && typeof body.identity === "string") {
    const result = await startDemo(body.identity);
    return Response.json(result.body, { status: result.status, headers: noStore });
  }

  if (body.action === "poll" && typeof body.sessionId === "string" && typeof body.rpChallenge === "string") {
    const result = await pollDemo(body.sessionId, body.rpChallenge);
    return Response.json(result.body, { status: result.status, headers: noStore });
  }

  return Response.json({ error: "bad_request" }, { status: 400, headers: noStore });
}
