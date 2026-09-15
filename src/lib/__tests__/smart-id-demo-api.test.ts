import { describe, it, expect, vi } from "vitest";
import { pollDemo, startDemo } from "@/lib/smart-id-demo-api";
import { demoInteractions, verificationCode } from "@/lib/smart-id-demo";
import recorded from "./fixtures/smart-id-demo-session.json";

/**
 * The two calls the /api/smart-id-demo route makes, with SK's demo service replaced by a fake
 * fetch. The page never talks to SK itself.
 */

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const SESSION = "4cbe6d1a-1173-4814-9f6e-85bb5eac1484";

describe("startDemo", () => {
  it("starts a session for a known test identity and returns the code to show", async () => {
    const fetchImpl = vi.fn(async () => json(200, { sessionID: SESSION }));
    const result = await startDemo("PNOLT-40404040009", fetchImpl);

    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.sessionId).toBe(SESSION);
    expect(result.body.verificationCode).toBe(verificationCode(result.body.rpChallenge));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://sid.demo.sk.ee/smart-id-rp/v3/authentication/notification/etsi/PNOLT-40404040009");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).signatureProtocolParameters.rpChallenge).toBe(result.body.rpChallenge);
  });

  it("refuses anything but SK's test identities, without calling SK", async () => {
    const fetchImpl = vi.fn();
    for (const id of ["PNOLT-39001010000", "PNOLT-40404040009/../x", "", "PNOEE-40404040009"]) {
      expect((await startDemo(id, fetchImpl)).status).toBe(400);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports SK being unavailable as a provider error", async () => {
    expect((await startDemo("PNOLT-40404040009", vi.fn(async () => json(503, {})))).status).toBe(502);
    expect((await startDemo("PNOLT-40404040009", vi.fn(async () => { throw new Error("network"); }))).status).toBe(502);
  });
});

describe("pollDemo", () => {
  it("says running while SK is still waiting", async () => {
    const result = await pollDemo(SESSION, recorded.rpChallenge, vi.fn(async () => json(200, { state: "RUNNING" })));
    expect(result).toEqual({ status: 200, body: { state: "running" } });
  });

  it("returns the verified identity with the personal code masked, for a real signed response", async () => {
    const result = await pollDemo(SESSION, recorded.rpChallenge, vi.fn(async () => json(200, recorded.session)), recorded.interactions);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      state: "complete",
      outcome: "ok",
      verification: {
        signatureValid: true,
        identity: { givenName: "OK", surname: "TEST", country: "LT", personalCode: "404••••••••" },
        certificateLevel: "QUALIFIED",
      },
    });
  });

  it("reports an unverifiable signature as an error, never as ok", async () => {
    const result = await pollDemo(SESSION, "AAAA" + recorded.rpChallenge.slice(4), vi.fn(async () => json(200, recorded.session)), recorded.interactions);
    expect(result.body).toMatchObject({ state: "complete", outcome: "error" });
  });

  it("maps a refusal without reading any certificate", async () => {
    const result = await pollDemo(SESSION, recorded.rpChallenge, vi.fn(async () => json(200, { state: "COMPLETE", result: { endResult: "USER_REFUSED" } })));
    expect(result).toEqual({ status: 200, body: { state: "complete", outcome: "refused" } });
  });

  it("asks SK with a short long-poll and checks what it is given", async () => {
    const fetchImpl = vi.fn(async () => json(200, { state: "RUNNING" }));
    await pollDemo(SESSION, recorded.rpChallenge, fetchImpl);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(`https://sid.demo.sk.ee/smart-id-rp/v3/session/${SESSION}?timeoutMs=4000`);
    expect((await pollDemo("not-a-session", recorded.rpChallenge, fetchImpl)).status).toBe(400);
    expect((await pollDemo(SESSION, "not base64!", fetchImpl)).status).toBe(400);
  });

  it("uses the page's constant interactions by default", () => {
    expect(demoInteractions()).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });
});
