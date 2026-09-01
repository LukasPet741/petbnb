import { describe, it, expect, vi, beforeEach } from "vitest";
import { dictionaries } from "@/lib/i18n";

const signUpMock = vi.fn();
const signInMock = vi.fn();
const signOutMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: (...a: unknown[]) => signUpMock(...a),
      signInWithPassword: (...a: unknown[]) => signInMock(...a),
      signOut: (...a: unknown[]) => signOutMock(...a),
      getSession: (...a: unknown[]) => getSessionMock(...a),
    },
  },
}));

const { matchAuthErrorKey, signUp, signIn, signOut, getSession } = await import(
  "@/lib/auth"
);

beforeEach(() => {
  signUpMock.mockReset();
  signInMock.mockReset();
  signOutMock.mockReset();
  getSessionMock.mockReset();
});

describe("matchAuthErrorKey", () => {
  it.each([
    ["Invalid login credentials", "invalidCredentials"],
    ["User already registered", "userAlreadyRegistered"],
    ["Email not confirmed", "emailNotConfirmed"],
    ["Password should be at least 6 characters", "weakPassword"],
  ])("maps %j to the %s key", (message, key) => {
    expect(matchAuthErrorKey(message)).toBe(`auth.knownErrors.${key}`);
  });

  it("matches case-insensitively", () => {
    expect(matchAuthErrorKey("INVALID LOGIN CREDENTIALS")).toBe(
      "auth.knownErrors.invalidCredentials",
    );
  });

  it("matches a pattern anywhere in the message, not just at the start", () => {
    // Supabase prefixes its messages with the error class name.
    expect(matchAuthErrorKey("AuthApiError: Invalid login credentials")).toBe(
      "auth.knownErrors.invalidCredentials",
    );
  });

  it("returns the first matching arm when a message matches two patterns", () => {
    // Pins the precedence, which is array order, not specificity.
    expect(
      matchAuthErrorKey(
        "Invalid login credentials; password should be at least 6 characters",
      ),
    ).toBe("auth.knownErrors.invalidCredentials");
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   "],
    ["a doubled space", "invalid  login credentials"],
    ["a singular noun", "invalid login credential"],
    ["underscores instead of spaces", "Invalid_login_credentials"],
    ["an unrelated message", "Network request failed"],
  ])("returns null for %s", (_label, message) => {
    expect(matchAuthErrorKey(message)).toBeNull();
  });

  it("returns null for a Lithuanian-language error, which falls back to generic copy", () => {
    // Documents that a localised Supabase error is NOT recognised, so the
    // login page shows auth.login.errorFallback rather than a specific message.
    expect(matchAuthErrorKey("Neteisingi prisijungimo duomenys")).toBeNull();
  });

  it.each([
    ["regex metacharacters", "(((("],
    ["an XSS-ish payload", "<script>alert(1)</script>"],
  ])("returns null for %s without throwing", (_label, message) => {
    expect(() => matchAuthErrorKey(message)).not.toThrow();
    expect(matchAuthErrorKey(message)).toBeNull();
  });

  it("handles a one-megabyte message quickly, so the patterns cannot backtrack", () => {
    const huge = "a".repeat(1_000_000);
    const started = performance.now();
    expect(matchAuthErrorKey(huge)).toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("returns null rather than throwing when handed a non-string", () => {
    // The signature says string, but an error with no message is reachable:
    // login/page.tsx passes err.message straight through.
    expect(matchAuthErrorKey(undefined as unknown as string)).toBeNull();
  });

  it("returns only keys that exist in both dictionaries", () => {
    // A key returned here goes straight into t(). If it were missing, the user
    // would see the literal string "auth.knownErrors.weakPassword" on the
    // login form. This closes the loop between the mapper and the dictionaries.
    const messages = [
      "Invalid login credentials",
      "User already registered",
      "Email not confirmed",
      "Password should be at least 6 characters",
    ];
    for (const message of messages) {
      const key = matchAuthErrorKey(message);
      expect(key).not.toBeNull();
      const path = (key as string).split(".");
      for (const dict of [dictionaries.en, dictionaries.lt]) {
        const value = path.reduce<unknown>(
          (node, part) =>
            node && typeof node === "object"
              ? (node as Record<string, unknown>)[part]
              : undefined,
          dict,
        );
        expect(typeof value, `${key} missing from a dictionary`).toBe("string");
      }
    }
  });
});

describe("signUp", () => {
  it("returns the data payload on success", async () => {
    const data = { user: { id: "u1" }, session: null };
    signUpMock.mockResolvedValue({ data, error: null });
    await expect(signUp("a@b.com", "pw")).resolves.toBe(data);
  });

  it("forwards credentials to Supabase verbatim", async () => {
    signUpMock.mockResolvedValue({ data: {}, error: null });
    await signUp("a@b.com", "pw");
    expect(signUpMock).toHaveBeenCalledWith({ email: "a@b.com", password: "pw" });
  });

  it("passes whitespace-padded input through untrimmed", async () => {
    // There is no client-side normalisation anywhere in this module.
    signUpMock.mockResolvedValue({ data: {}, error: null });
    await signUp("  a@b.com  ", " pw ");
    expect(signUpMock).toHaveBeenCalledWith({
      email: "  a@b.com  ",
      password: " pw ",
    });
  });

  it("rethrows the original error object, not a copy", async () => {
    // login/page.tsx reads err.message off this, so identity matters.
    const error = new Error("User already registered");
    signUpMock.mockResolvedValue({ data: null, error });
    await expect(signUp("a@b.com", "pw")).rejects.toBe(error);
  });
});

describe("signIn", () => {
  it("returns the data payload on success", async () => {
    const data = { user: { id: "u1" }, session: { access_token: "t" } };
    signInMock.mockResolvedValue({ data, error: null });
    await expect(signIn("a@b.com", "pw")).resolves.toBe(data);
  });

  it("uses the password grant", async () => {
    signInMock.mockResolvedValue({ data: {}, error: null });
    await signIn("a@b.com", "pw");
    expect(signInMock).toHaveBeenCalledWith({ email: "a@b.com", password: "pw" });
  });

  it("rethrows the original error object", async () => {
    const error = new Error("Invalid login credentials");
    signInMock.mockResolvedValue({ data: null, error });
    await expect(signIn("a@b.com", "pw")).rejects.toBe(error);
  });
});

describe("signOut", () => {
  it("resolves to undefined on success", async () => {
    signOutMock.mockResolvedValue({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
  });

  it("rethrows the original error object", async () => {
    // Sidebar.handleSignOut does not catch this, so a failed sign-out
    // surfaces as an unhandled rejection.
    const error = new Error("network");
    signOutMock.mockResolvedValue({ error });
    await expect(signOut()).rejects.toBe(error);
  });
});

describe("getSession", () => {
  it("returns the session when one exists", async () => {
    const session = { access_token: "t" };
    getSessionMock.mockResolvedValue({ data: { session }, error: null });
    await expect(getSession()).resolves.toBe(session);
  });

  it("returns null when logged out", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    await expect(getSession()).resolves.toBeNull();
  });

  // Asymmetry worth pinning: the other three helpers throw on error, but this
  // one ignores the error field entirely and reports "logged out" instead.
  // A transient auth outage is therefore indistinguishable from a real
  // sign-out, which is what makes the app bounce users to /login.
  it("swallows an error and reports no session (current behaviour)", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: null },
      error: new Error("network"),
    });
    await expect(getSession()).resolves.toBeNull();
  });
});
