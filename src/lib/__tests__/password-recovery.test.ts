import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  capturePasswordRecoveryFromUrl,
  clearPasswordRecovery,
  isPasswordRecovery,
  markPasswordRecovery,
} from "@/lib/password-recovery";

/**
 * The marker that tells /reset-password a session came from a reset link rather than from
 * someone already signed in at the browser. Supabase's link lands with `#…type=recovery`
 * and the client wipes that hash as it starts, so the URL is read once at module load.
 */

const setUrl = (hash: string, search = "") => {
  window.history.replaceState(null, "", `/reset-password${search}${hash}`);
};

beforeEach(() => {
  window.sessionStorage.clear();
  setUrl("");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("password recovery marker", () => {
  it("is absent until something sets it", () => {
    expect(isPasswordRecovery()).toBe(false);
  });

  it("round-trips through mark and clear", () => {
    markPasswordRecovery();
    expect(isPasswordRecovery()).toBe(true);
    clearPasswordRecovery();
    expect(isPasswordRecovery()).toBe(false);
  });

  it("is set by the recovery tokens Supabase puts in the link's hash", () => {
    setUrl("#access_token=abc&expires_in=3600&type=recovery");
    capturePasswordRecoveryFromUrl();
    expect(isPasswordRecovery()).toBe(true);
  });

  it("is set when type=recovery arrives as a query parameter", () => {
    setUrl("", "?type=recovery&code=abc");
    capturePasswordRecoveryFromUrl();
    expect(isPasswordRecovery()).toBe(true);
  });

  it("is not set by an ordinary sign-in landing, or by a lookalike value", () => {
    setUrl("#access_token=abc&type=signup");
    capturePasswordRecoveryFromUrl();
    expect(isPasswordRecovery()).toBe(false);

    setUrl("", "?type=recovery-ish");
    capturePasswordRecoveryFromUrl();
    expect(isPasswordRecovery()).toBe(false);
  });

  it("survives a blocked sessionStorage instead of throwing", () => {
    vi.spyOn(window.sessionStorage.__proto__, "setItem").mockImplementation(() => {
      throw new Error("The operation is insecure.");
    });
    vi.spyOn(window.sessionStorage.__proto__, "getItem").mockImplementation(() => {
      throw new Error("The operation is insecure.");
    });
    expect(() => markPasswordRecovery()).not.toThrow();
    expect(isPasswordRecovery()).toBe(false);
  });
});
