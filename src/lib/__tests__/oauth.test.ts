import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ calls: [] as unknown[], error: null as { message: string } | null }));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: (args: unknown) => {
        h.calls.push(args);
        return Promise.resolve({ data: {}, error: h.error });
      },
    },
  },
}));

import { enabledProviders, signInWithProvider } from "@/lib/oauth";

beforeEach(() => {
  h.calls = [];
  h.error = null;
});

describe("enabledProviders", () => {
  it("is empty until the switch is set, so no half-working button ever shows", () => {
    expect(enabledProviders(undefined)).toEqual([]);
    expect(enabledProviders("")).toEqual([]);
  });

  it("keeps a fixed order and drops anything it does not know", () => {
    expect(enabledProviders("facebook,google")).toEqual(["google", "facebook"]);
    expect(enabledProviders(" google , twitter ")).toEqual(["google"]);
  });
});

describe("signInWithProvider", () => {
  it("sends the visitor back to where they were going", async () => {
    await signInWithProvider("facebook", "/browse?service=walking");
    expect(h.calls).toEqual([
      { provider: "facebook", options: { redirectTo: `${window.location.origin}/browse?service=walking` } },
    ]);
  });

  it("defaults to the dashboard, which sends a new account on to finish its profile", async () => {
    await signInWithProvider("google", null);
    expect(h.calls).toEqual([{ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard` } }]);
  });

  it("passes a refusal on", async () => {
    h.error = { message: "Unsupported provider: provider is not enabled" };
    await expect(signInWithProvider("google", null)).rejects.toThrow(/not enabled/);
  });
});
