import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SmartIdDemo from "@/components/SmartIdDemo";

// jsdom has no IntersectionObserver, which next/link uses to prefetch; a plain anchor is enough here.
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

/**
 * The Smart-ID demo page's flow: pick one of SK's test identities, see the verification code,
 * then the outcome. /api/smart-id-demo is faked. Rendered without a LanguageProvider, so labels
 * are their translation keys.
 */

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function fakeApi(...polls: unknown[]) {
  const calls: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    calls.push(body);
    if (body.action === "start") return json({ sessionId: "s-1", rpChallenge: "RC", verificationCode: "7180" });
    const next = polls.shift();
    return next instanceof Response ? next : json(next ?? { state: "running" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

afterEach(() => vi.unstubAllGlobals());

describe("SmartIdDemo", () => {
  it("shows the verification code, then the verified identity with a checked signature", async () => {
    const { calls } = fakeApi(
      { state: "running" },
      {
        state: "complete",
        outcome: "ok",
        verification: {
          signatureValid: true,
          identity: { givenName: "OK", surname: "TEST", country: "LT", personalCode: "404••••••••" },
          certificateLevel: "QUALIFIED",
          issuer: "TEST of SK ID Solutions EID-Q 2024E",
        },
      },
    );
    // A short pause, so the code is on screen long enough to be seen before SK answers.
    render(<SmartIdDemo codeDelayMs={100} />);

    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText("7180")).toBeInTheDocument();
    expect(await screen.findByText("appPages.smartIdDemo.okTitle")).toBeInTheDocument();
    expect(screen.getByText("OK TEST")).toBeInTheDocument();
    expect(screen.getByText("404••••••••")).toBeInTheDocument();
    expect(screen.getByText("appPages.smartIdDemo.signatureValid")).toBeInTheDocument();
    expect(calls[0]).toEqual({ action: "start", identity: "PNOLT-40404040009" });
    expect(calls[1]).toEqual({ action: "poll", sessionId: "s-1", rpChallenge: "RC" });
  });

  it("starts with the identity the presenter picked", async () => {
    const { calls } = fakeApi({ state: "complete", outcome: "wrong_code" });
    render(<SmartIdDemo codeDelayMs={0} />);
    fireEvent.click(screen.getByRole("radio", { name: /appPages\.smartIdDemo\.identities\.wrongCode/ }));
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText("appPages.smartIdDemo.wrongCodeTitle")).toBeInTheDocument();
    expect(calls[0]).toEqual({ action: "start", identity: "PNOLT-30403039972" });
  });

  it.each([
    ["refused", "appPages.smartIdDemo.refusedTitle"],
    ["timeout", "appPages.smartIdDemo.timeoutTitle"],
    ["error", "appPages.smartIdDemo.errorTitle"],
  ])("explains a %s outcome and offers to try again", async (outcome, title) => {
    fakeApi({ state: "complete", outcome });
    render(<SmartIdDemo codeDelayMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText(title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.again" }));
    expect(screen.getByRole("button", { name: "appPages.smartIdDemo.start" })).toBeInTheDocument();
  });

  it("shows the error state when the service cannot be reached", async () => {
    fakeApi(json({ error: "provider" }, 502));
    render(<SmartIdDemo codeDelayMs={0} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText("appPages.smartIdDemo.errorTitle")).toBeInTheDocument();
  });
});

describe("saving the badge", () => {
  const okPoll = {
    state: "complete",
    outcome: "ok",
    verification: {
      signatureValid: true,
      identity: { givenName: "OK", surname: "TEST", country: "LT", personalCode: "404" },
      certificateLevel: "QUALIFIED",
      issuer: "TEST of SK ID Solutions EID-Q 2024E",
    },
  };

  it("saves the verification after an OK result and says the badge was added", async () => {
    fakeApi(okPoll);
    const saveVerification = vi.fn(async () => "verified" as const);
    const onVerified = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={saveVerification} onVerified={onVerified} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText("appPages.smartIdDemo.badgeSaved")).toBeInTheDocument();
    expect(saveVerification).toHaveBeenCalledWith("s-1");
    expect(onVerified).toHaveBeenCalledOnce();
  });

  it.each([
    ["not_verified", "appPages.smartIdDemo.badgeNotVerified"],
    ["signed_out", "appPages.smartIdDemo.badgeSignedOut"],
    ["error", "appPages.smartIdDemo.badgeError"],
  ] as const)("explains a %s save", async (result, message) => {
    fakeApi(okPoll);
    const onVerified = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={async () => result} onVerified={onVerified} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("does not try to save a refusal", async () => {
    fakeApi({ state: "complete", outcome: "refused" });
    const saveVerification = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={saveVerification} />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(await screen.findByText("appPages.smartIdDemo.refusedTitle")).toBeInTheDocument();
    expect(saveVerification).not.toHaveBeenCalled();
  });
});
