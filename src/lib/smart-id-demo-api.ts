import {
  DEMO,
  TEST_IDENTITIES,
  authenticationRequestBody,
  demoInteractions,
  newRpChallenge,
  outcomeOf,
  verificationCode,
  verifyAuthentication,
  type DemoIdentity,
  type DemoOutcome,
  type DemoSession,
} from "@/lib/smart-id-demo";

/**
 * What /api/smart-id-demo does, with fetch passed in so it can be tested without SK.
 *
 * Stateless on purpose: the page sends back the session id and the challenge it was given, and
 * the poll re-checks SK's signature against that challenge. Nothing is stored and nothing is
 * trusted beyond the page it is shown on. Storing a verification would need the challenge kept
 * server-side and bound to the user (the smart_id_sessions table in the full design).
 */

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export type StartResult =
  | { status: 200; body: { sessionId: string; rpChallenge: string; verificationCode: string } }
  | { status: 400 | 502; body: { error: "bad_request" | "provider" } };

export type PollResult =
  | { status: 200; body: { state: "running" } }
  | {
      status: 200;
      body: {
        state: "complete";
        outcome: DemoOutcome;
        verification?: { signatureValid: boolean; identity: DemoIdentity | null; certificateLevel: string | null; issuer: string | null };
      };
    }
  | { status: 400 | 502; body: { error: "bad_request" | "provider" } };

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64_32 = /^[A-Za-z0-9+/]{43}=$/;
/** Short enough to finish well inside a serverless function's time limit; the page polls again. */
const LONG_POLL_MS = 4000;

const badRequest = { status: 400 as const, body: { error: "bad_request" as const } };
const provider = { status: 502 as const, body: { error: "provider" as const } };

/** Shows the first three digits only, as a real integration would. */
function maskPersonalCode(code: string): string {
  return code.slice(0, 3) + "•".repeat(Math.max(0, code.length - 3));
}

export async function startDemo(identity: string, fetchImpl: Fetch = fetch): Promise<StartResult> {
  if (!TEST_IDENTITIES.some((t) => t.id === identity)) return badRequest;

  const rpChallenge = newRpChallenge();
  try {
    const response = await fetchImpl(`${DEMO.host}/authentication/notification/etsi/${identity}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authenticationRequestBody(rpChallenge)),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return provider;
    const { sessionID } = (await response.json()) as { sessionID?: string };
    if (!sessionID || !SESSION_ID.test(sessionID)) return provider;
    return { status: 200, body: { sessionId: sessionID, rpChallenge, verificationCode: verificationCode(rpChallenge) } };
  } catch {
    return provider;
  }
}

export async function pollDemo(
  sessionId: string,
  rpChallenge: string,
  fetchImpl: Fetch = fetch,
  interactions: string = demoInteractions(),
): Promise<PollResult> {
  if (!SESSION_ID.test(sessionId) || !BASE64_32.test(rpChallenge)) return badRequest;

  let session: DemoSession;
  try {
    const response = await fetchImpl(`${DEMO.host}/session/${sessionId}?timeoutMs=${LONG_POLL_MS}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(LONG_POLL_MS + 4000),
    });
    if (!response.ok) return provider;
    session = (await response.json()) as DemoSession;
  } catch {
    return provider;
  }

  if (session.state !== "COMPLETE") return { status: 200, body: { state: "running" } };

  const outcome = outcomeOf(session.result?.endResult ?? "");
  if (outcome !== "ok") return { status: 200, body: { state: "complete", outcome } };

  const verification = verifyAuthentication(session, rpChallenge, interactions);
  return {
    status: 200,
    body: {
      state: "complete",
      // An OK that we cannot verify is not an OK.
      outcome: verification.signatureValid && verification.identity ? "ok" : "error",
      verification: {
        ...verification,
        identity: verification.identity
          ? { ...verification.identity, personalCode: maskPersonalCode(verification.identity.personalCode) }
          : null,
      },
    },
  };
}
