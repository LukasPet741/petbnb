import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SmartIdDemo from "@/components/SmartIdDemo";

// jsdom has no IntersectionObserver, which next/link uses to prefetch; a plain anchor is enough here.
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));

/**
 * The Smart-ID demo page's flow: pick a test person (or type their code), see the verification
 * code while the simulated phone plays along, then the outcome. /api/smart-id-demo is faked.
 * Rendered without a LanguageProvider, so labels are their translation keys.
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

function startAs(person: "ok" | "refused" | "refusedPin" | "wrongCode" | "timeout" = "ok") {
  // Not followed by a letter, so "refused" does not also match "refusedPin".
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`identities\\.${person}(?![A-Za-z])`) }));
  fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
}

/** SK's session never finishes; each poll takes 20 ms, so the loop yields to the test's timers. */
function slowRunningApi() {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    if (body.action === "start") return json({ sessionId: "s-1", rpChallenge: "RC", verificationCode: "7180" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    return json({ state: "running" });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const okPoll = {
  state: "complete",
  outcome: "ok",
  verification: {
    signatureValid: true,
    identity: { givenName: "OK", surname: "TEST", country: "LT", personalCode: "404••••••••" },
    certificateLevel: "QUALIFIED",
    issuer: "TEST of SK ID Solutions EID-Q 2024E",
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("SmartIdDemo", () => {
  it("shows the verification code, then the verified identity with a checked signature", async () => {
    const { calls } = fakeApi({ state: "running" }, okPoll);
    // A short pause, so the code is on screen long enough to be seen before SK answers.
    render(<SmartIdDemo codeDelayMs={100} />);
    startAs("ok");
    expect(await screen.findByText("7180")).toBeInTheDocument();
    expect(await screen.findByText("appPages.smartIdDemo.okTitle")).toBeInTheDocument();
    expect(screen.getByText("OK TEST")).toBeInTheDocument();
    expect(screen.getByText("404••••••••")).toBeInTheDocument();
    expect(screen.getByText("appPages.smartIdDemo.signatureValid")).toBeInTheDocument();
    expect(calls[0]).toEqual({ action: "start", identity: "PNOLT-40404040009" });
    expect(calls[1]).toEqual({ action: "poll", sessionId: "s-1", rpChallenge: "RC" });
  });

  it("starts with the test person the presenter picked", async () => {
    const { calls } = fakeApi({ state: "complete", outcome: "wrong_code" });
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("wrongCode");
    expect(await screen.findByText("appPages.smartIdDemo.wrongCodeTitle")).toBeInTheDocument();
    expect(calls[0]).toEqual({ action: "start", identity: "PNOLT-30403039972" });
  });

  it("never calls SK for a code that is not a test person", async () => {
    const { fetchMock } = fakeApi();
    render(<SmartIdDemo codeDelayMs={0} />);
    fireEvent.change(screen.getByLabelText("appPages.smartIdDemo.personalCodeLabel"), { target: { value: "38901011234" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));
    expect(screen.getByRole("alert").textContent).toBe("appPages.smartIdDemo.notTestPerson");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["refused", "appPages.smartIdDemo.refusedTitle"],
    ["timeout", "appPages.smartIdDemo.timeoutTitle"],
    ["error", "appPages.smartIdDemo.errorTitle"],
  ])("explains a %s outcome and offers to try again", async (outcome, title) => {
    fakeApi({ state: "complete", outcome });
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    expect(await screen.findByText(title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.again" }));
    expect(screen.getByRole("button", { name: "appPages.smartIdDemo.start" })).toBeInTheDocument();
  });

  it("shows the error state when the service cannot be reached", async () => {
    fakeApi(json({ error: "provider" }, 502));
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    expect(await screen.findByText("appPages.smartIdDemo.errorTitle")).toBeInTheDocument();
  });

  it("cancel returns to the form and stops polling", async () => {
    const fetchMock = slowRunningApi();
    render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    expect(await screen.findByText("7180")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.cancel" }));
    expect(screen.getByRole("button", { name: "appPages.smartIdDemo.start" })).toBeInTheDocument();
    const callsAtCancel = fetchMock.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 100));
    // At most the one poll already in flight when Cancel was pressed.
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(callsAtCancel + 1);
  });

  it("plays the phone's ending to match SK's answer", async () => {
    fakeApi(okPoll);
    const { container } = render(<SmartIdDemo codeDelayMs={0} />);
    startAs("ok");
    await screen.findByText("appPages.smartIdDemo.okTitle");
    expect(container.querySelector("[data-screen='ending']")).not.toBeNull();
    expect(screen.getByText("appPages.smartIdDemo.phone.confirmed")).toBeInTheDocument();
  });
});

describe("saving the badge", () => {
  it("saves the verification after an OK result and says the badge was added", async () => {
    fakeApi(okPoll);
    const saveVerification = vi.fn(async () => "verified" as const);
    const onVerified = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={saveVerification} onVerified={onVerified} />);
    startAs("ok");
    expect(await screen.findByText("appPages.smartIdDemo.badgeSaved")).toBeInTheDocument();
    expect(saveVerification).toHaveBeenCalledWith("s-1");
    await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
  });

  it.each([
    ["not_verified", "appPages.smartIdDemo.badgeNotVerified"],
    ["signed_out", "appPages.smartIdDemo.badgeSignedOut"],
    ["error", "appPages.smartIdDemo.badgeError"],
  ] as const)("explains a %s save", async (result, message) => {
    fakeApi(okPoll);
    const onVerified = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={async () => result} onVerified={onVerified} />);
    startAs("ok");
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("does not try to save a refusal", async () => {
    fakeApi({ state: "complete", outcome: "refused" });
    const saveVerification = vi.fn();
    render(<SmartIdDemo codeDelayMs={0} saveVerification={saveVerification} />);
    startAs("refused");
    expect(await screen.findByText("appPages.smartIdDemo.refusedTitle")).toBeInTheDocument();
    expect(saveVerification).not.toHaveBeenCalled();
  });
});
