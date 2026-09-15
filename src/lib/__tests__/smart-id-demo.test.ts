import { describe, it, expect } from "vitest";
import {
  DEMO,
  TEST_IDENTITIES,
  acspV2Payload,
  authenticationRequestBody,
  demoInteractions,
  newRpChallenge,
  outcomeOf,
  parseSubject,
  verificationCode,
  verifyAuthentication,
  type DemoSession,
} from "@/lib/smart-id-demo";
import recorded from "./fixtures/smart-id-demo-session.json";

/**
 * Smart-ID against SK's DEMO environment (option B, 2026-09-15): nothing is stored, nothing
 * about a real person is involved. The rules below were checked against sid.demo.sk.ee before
 * this was written; the fixture is a real COMPLETE response for SK's public test identity
 * PNOLT-40404040009 ("TEST, OK").
 */

const session = recorded.session as DemoSession;

describe("verificationCode", () => {
  it("matches SK's documented example: SHA-256 of the raw challenge, last two bytes, mod 10000", () => {
    expect(verificationCode("GYS+yoah6emAcVDNIajwSs6UB/M95XrDxMzXBUkwQJ9YFDipXXzGpPc7raWcuc2+TEoRc7WvIZ/7dU/iRXenYg==")).toBe("7180");
  });

  it("always gives four digits, zero-padded", () => {
    for (let i = 0; i < 50; i++) expect(verificationCode(newRpChallenge())).toMatch(/^\d{4}$/);
  });
});

describe("newRpChallenge", () => {
  it("is 32 random bytes, base64", () => {
    const a = newRpChallenge();
    expect(Buffer.from(a, "base64")).toHaveLength(32);
    expect(newRpChallenge()).not.toBe(a);
  });
});

describe("authenticationRequestBody", () => {
  it("asks for a qualified ACSP_V2 authentication with a PIN interaction and a 4-digit code", () => {
    const body = authenticationRequestBody("CHALLENGE==");
    expect(body).toMatchObject({
      relyingPartyUUID: DEMO.relyingPartyUUID,
      relyingPartyName: "DEMO",
      certificateLevel: "QUALIFIED",
      signatureProtocol: "ACSP_V2",
      signatureProtocolParameters: {
        rpChallenge: "CHALLENGE==",
        signatureAlgorithm: "rsassa-pss",
        signatureAlgorithmParameters: { hashAlgorithm: "SHA3-512" },
      },
      interactions: demoInteractions(),
      vcType: "numeric4",
    });
    const decoded = JSON.parse(Buffer.from(demoInteractions(), "base64").toString("utf8"));
    expect(decoded).toEqual([{ type: "displayTextAndPIN", displayText60: expect.any(String) }]);
    expect(decoded[0].displayText60.length).toBeLessThanOrEqual(60);
  });
});

describe("acspV2Payload", () => {
  it("joins the eleven ACSP_V2 fields with | in SK's order", () => {
    const payload = acspV2Payload({
      schemeName: "smart-id-demo",
      serverRandom: "SR",
      rpChallenge: "RC",
      userChallenge: "UC",
      relyingPartyName: "DEMO",
      interactions: "INT",
      interactionTypeUsed: "displayTextAndPIN",
      flowType: "Notification",
    }).split("|");
    expect(payload).toHaveLength(11);
    expect(payload.slice(0, 5)).toEqual(["smart-id-demo", "ACSP_V2", "SR", "RC", "UC"]);
    expect(payload[5]).toBe(Buffer.from("DEMO").toString("base64"));
    expect(payload[6]).toBe(""); // no brokered RP
    expect(payload[8]).toBe("displayTextAndPIN");
    expect(payload[9]).toBe(""); // no callback URL in a notification flow
    expect(payload[10]).toBe("Notification");
  });
});

describe("parseSubject", () => {
  it("reads name, country and personal code from a Smart-ID certificate subject", () => {
    expect(parseSubject("C=LT\nCN=TEST\\,OK\nSN=TEST\nGN=OK\nserialNumber=PNOLT-40404040009")).toEqual({
      givenName: "OK",
      surname: "TEST",
      country: "LT",
      personalCode: "40404040009",
    });
  });
});

describe("verifyAuthentication", () => {
  it("accepts SK's real signature over our challenge and reads the identity", () => {
    const result = verifyAuthentication(session, recorded.rpChallenge, recorded.interactions);
    expect(result.signatureValid).toBe(true);
    expect(result.identity).toEqual({ givenName: "OK", surname: "TEST", country: "LT", personalCode: "40404040009" });
    expect(result.certificateLevel).toBe("QUALIFIED");
    expect(result.issuer).toContain("SK ID Solutions");
  });

  it("rejects the same signature for a different challenge", () => {
    const result = verifyAuthentication(session, newRpChallenge(), recorded.interactions);
    expect(result.signatureValid).toBe(false);
  });

  it("rejects it when the interactions were changed", () => {
    expect(verifyAuthentication(session, recorded.rpChallenge, demoInteractions() + "x").signatureValid).toBe(false);
  });

  it("does not throw on a response without a certificate", () => {
    const result = verifyAuthentication({ ...session, cert: undefined }, recorded.rpChallenge, recorded.interactions);
    expect(result).toEqual({ signatureValid: false, identity: null, certificateLevel: null, issuer: null });
  });
});

describe("outcomeOf and TEST_IDENTITIES", () => {
  it.each([
    ["OK", "ok"],
    ["USER_REFUSED", "refused"],
    ["USER_REFUSED_INTERACTION", "refused"],
    ["USER_REFUSED_DISPLAYTEXTANDPIN", "refused"],
    ["WRONG_VC", "wrong_code"],
    ["TIMEOUT", "timeout"],
    ["DOCUMENT_UNUSABLE", "error"],
    ["SOMETHING_NEW", "error"],
  ])("maps %s to %s", (endResult, outcome) => {
    expect(outcomeOf(endResult)).toBe(outcome);
  });

  it("offers only SK's Lithuanian test identities, one per outcome worth showing", () => {
    expect(TEST_IDENTITIES.map((i) => i.outcome)).toEqual(["ok", "refused", "refused", "wrong_code", "timeout"]);
    for (const identity of TEST_IDENTITIES) expect(identity.id).toMatch(/^PNOLT-\d{11}$/);
  });
});
