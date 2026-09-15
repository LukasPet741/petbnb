import crypto from "node:crypto";

/**
 * Smart-ID authentication against SK's DEMO environment, for the /smart-id-demo page (option B,
 * 2026-09-15). Server-only: the route handler imports this; the browser never talks to SK.
 *
 * What it is and is not. The demo environment is SK's official, free, contract-free sandbox. It
 * only knows SK's published test identities, so no real person can be verified here and nothing
 * is stored: no database row changes, no badge. The fuller design (verification stored on the
 * profile, a badge, a session table binding a session to its user) is
 * docs/superpowers/specs/2026-09-12-smart-id-verification-design.md, and would reuse this file.
 *
 * Protocol, checked against sid.demo.sk.ee and SK's PHP client (SK-EID/smart-id-php-client):
 *  - POST /authentication/notification/etsi/PNOLT-<personal code>  starts a session
 *  - GET  /session/<id>?timeoutMs=…                                 long-polls its status
 *  - the verification code is SHA-256(raw rpChallenge), last two bytes, mod 10000
 *  - a successful response is an RSA-PSS (SHA3-512) signature over the ACSP_V2 payload, made
 *    with the key in the returned certificate
 *
 * Certificate chain and OCSP revocation checks are not done: in the demo environment they would
 * need SK's demo CA certificates bundled and demo certificates uploaded to the demo OCSP, and
 * they prove nothing about a test identity anyway. A production integration must add them.
 */

export const DEMO = {
  host: "https://sid.demo.sk.ee/smart-id-rp/v3",
  relyingPartyUUID: "00000000-0000-4000-8000-000000000000",
  relyingPartyName: "DEMO",
  schemeName: "smart-id-demo",
} as const;

export { TEST_IDENTITIES, type DemoOutcome } from "@/lib/smart-id-demo-identities";
import type { DemoOutcome } from "@/lib/smart-id-demo-identities";

/** What the Smart-ID app shows while asking for the PIN. SK allows at most 60 characters. */
const DISPLAY_TEXT = "Prisijungimas prie PetBnB (demo)";

export function newRpChallenge(): string {
  return crypto.randomBytes(32).toString("base64");
}

/** The code the user compares with their Smart-ID app, derived from our own challenge. */
export function verificationCode(rpChallengeBase64: string): string {
  const hash = crypto.createHash("sha256").update(Buffer.from(rpChallengeBase64, "base64")).digest();
  return String(hash.readUInt16BE(hash.length - 2) % 10000).padStart(4, "0");
}

/** Base64 of the interactions JSON. Constant, so the poll can rebuild exactly what was signed. */
export function demoInteractions(): string {
  return Buffer.from(JSON.stringify([{ type: "displayTextAndPIN", displayText60: DISPLAY_TEXT }]), "utf8").toString("base64");
}

export function authenticationRequestBody(rpChallenge: string) {
  return {
    relyingPartyUUID: DEMO.relyingPartyUUID,
    relyingPartyName: DEMO.relyingPartyName,
    certificateLevel: "QUALIFIED",
    signatureProtocol: "ACSP_V2",
    signatureProtocolParameters: {
      rpChallenge,
      signatureAlgorithm: "rsassa-pss",
      signatureAlgorithmParameters: { hashAlgorithm: "SHA3-512" },
    },
    interactions: demoInteractions(),
    vcType: "numeric4",
  };
}

/**
 * The string SK signs, per ACSP_V2:
 * scheme|ACSP_V2|serverRandom|rpChallenge|userChallenge|B64(rpName)|B64(brokeredRpName)|
 * B64(SHA-256(interactions))|interactionTypeUsed|initialCallbackUrl|flowType
 */
export function acspV2Payload(p: {
  schemeName: string;
  serverRandom: string;
  rpChallenge: string;
  userChallenge: string;
  relyingPartyName: string;
  interactions: string;
  interactionTypeUsed: string;
  flowType: string;
}): string {
  return [
    p.schemeName,
    "ACSP_V2",
    p.serverRandom,
    p.rpChallenge,
    p.userChallenge,
    Buffer.from(p.relyingPartyName, "utf8").toString("base64"),
    "",
    crypto.createHash("sha256").update(p.interactions, "utf8").digest("base64"),
    p.interactionTypeUsed,
    "",
    p.flowType,
  ].join("|");
}

export interface DemoIdentity {
  givenName: string;
  surname: string;
  country: string;
  personalCode: string;
}

/** A Smart-ID certificate subject, as Node prints it: one "KEY=value" per line. */
export function parseSubject(subject: string): DemoIdentity {
  const fields = new Map<string, string>();
  for (const line of subject.split("\n")) {
    const at = line.indexOf("=");
    if (at > 0) fields.set(line.slice(0, at), line.slice(at + 1).replace(/\\,/g, ","));
  }
  const serial = fields.get("serialNumber") ?? "";
  return {
    givenName: fields.get("GN") ?? "",
    surname: fields.get("SN") ?? "",
    country: fields.get("C") ?? "",
    personalCode: serial.replace(/^PNO[A-Z]{2}-/, ""),
  };
}

/** The part of SK's session status this page reads. */
export interface DemoSession {
  state: string;
  result?: { endResult: string };
  interactionTypeUsed?: string;
  signature?: {
    value: string;
    serverRandom: string;
    userChallenge: string;
    flowType: string;
    signatureAlgorithm?: string;
    signatureAlgorithmParameters?: { hashAlgorithm?: string; saltLength?: number };
  };
  cert?: { value: string; certificateLevel?: string };
}

export interface DemoVerification {
  signatureValid: boolean;
  identity: DemoIdentity | null;
  certificateLevel: string | null;
  issuer: string | null;
}

/** Checks SK's signature over our challenge with the returned certificate's key, and reads who it is. */
export function verifyAuthentication(session: DemoSession, rpChallenge: string, interactions: string): DemoVerification {
  const none: DemoVerification = { signatureValid: false, identity: null, certificateLevel: null, issuer: null };
  const { signature, cert } = session;
  if (!signature || !cert || !session.interactionTypeUsed) return none;

  try {
    const certificate = new crypto.X509Certificate(Buffer.from(cert.value, "base64"));
    const payload = acspV2Payload({
      schemeName: DEMO.schemeName,
      serverRandom: signature.serverRandom,
      rpChallenge,
      userChallenge: signature.userChallenge,
      relyingPartyName: DEMO.relyingPartyName,
      interactions,
      interactionTypeUsed: session.interactionTypeUsed,
      flowType: signature.flowType,
    });
    const signatureValid =
      (signature.signatureAlgorithm ?? "rsassa-pss").toLowerCase() === "rsassa-pss" &&
      crypto.verify(
        "sha3-512",
        Buffer.from(payload, "utf8"),
        { key: certificate.publicKey, padding: crypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: 64 },
        Buffer.from(signature.value, "base64"),
      );
    return {
      signatureValid,
      identity: parseSubject(certificate.subject),
      certificateLevel: cert.certificateLevel ?? null,
      issuer: certificate.issuer.split("\n").find((l) => l.startsWith("CN="))?.slice(3) ?? null,
    };
  } catch {
    return none;
  }
}

export function outcomeOf(endResult: string): DemoOutcome {
  if (endResult === "OK") return "ok";
  if (endResult.startsWith("USER_REFUSED")) return "refused";
  if (endResult === "WRONG_VC") return "wrong_code";
  if (endResult === "TIMEOUT") return "timeout";
  return "error";
}
