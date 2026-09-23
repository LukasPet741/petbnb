import { describe, it, expect } from "vitest";
import { onboardingSteps, onboardingPercent, type OnboardingInput } from "@/lib/sitter-onboarding";

const blank: OnboardingInput = { avatar_url: null, about_me: null, services: {}, prices: {}, verification_method: "none" };
const done = (p: OnboardingInput) => Object.fromEntries(onboardingSteps(p).map((s) => [s.key, s.done]));

describe("onboardingSteps", () => {
  it("a fresh sitter has everything left to do", () => {
    expect(done(blank)).toEqual({ photo: false, bio: false, services: false, prices: false, verified: false });
    expect(onboardingPercent(onboardingSteps(blank))).toBe(0);
  });

  it("keeps the steps in the order a sitter would do them", () => {
    expect(onboardingSteps(blank).map((s) => s.key)).toEqual(["photo", "bio", "services", "prices", "verified"]);
  });

  it("a whitespace bio is not a bio", () => {
    expect(done({ ...blank, about_me: "   " }).bio).toBe(false);
    expect(done({ ...blank, about_me: "Loves dogs." }).bio).toBe(true);
  });

  it("prices count only when every offered service has a valid one", () => {
    const services = { walking: true, boarding: true };
    expect(done({ ...blank, services, prices: { walking: { amount: 10, days: 1 } } }).prices).toBe(false);
    expect(done({ ...blank, services, prices: { walking: { amount: 10, days: 1 }, boarding: { amount: 30, days: 1 } } }).prices).toBe(true);
  });

  it("grooming is priced per visit", () => {
    expect(done({ ...blank, services: { grooming: true }, prices: { grooming: { amount: 25 } } }).prices).toBe(true);
  });

  it("a malformed price does not count", () => {
    expect(done({ ...blank, services: { walking: true }, prices: { walking: { amount: 0, days: 1 } } }).prices).toBe(false);
  });

  it("no services means the prices step is not done either", () => {
    expect(done({ ...blank, prices: { walking: { amount: 10, days: 1 } } }).prices).toBe(false);
  });

  it("a service switched off does not need a price", () => {
    const services = { walking: true, boarding: false };
    expect(done({ ...blank, services, prices: { walking: { amount: 10, days: 1 } } }).prices).toBe(true);
  });

  it("verified is anything but 'none', matching sitterBlocker", () => {
    expect(done({ ...blank, verification_method: "smart_id_demo" }).verified).toBe(true);
    expect(done({ ...blank, verification_method: "seed" }).verified).toBe(true);
    expect(done({ ...blank, verification_method: null }).verified).toBe(false);
  });

  it("tolerates null services and prices from the database", () => {
    expect(done({ ...blank, services: null, prices: null })).toEqual({ photo: false, bio: false, services: false, prices: false, verified: false });
  });

  it("links profile steps to /profile and verification to the Smart-ID demo", () => {
    const hrefs = Object.fromEntries(onboardingSteps(blank).map((s) => [s.key, s.href]));
    expect(hrefs).toEqual({ photo: "/profile", bio: "/profile", services: "/profile", prices: "/profile", verified: "/smart-id-demo" });
  });
});

describe("onboardingPercent", () => {
  it("is a whole number from 0 to 100", () => {
    expect(onboardingPercent(onboardingSteps({ ...blank, avatar_url: "x" }))).toBe(20);
    const full: OnboardingInput = {
      avatar_url: "x",
      about_me: "Hi",
      services: { walking: true },
      prices: { walking: { amount: 10, days: 1 } },
      verification_method: "smart_id_demo",
    };
    expect(onboardingPercent(onboardingSteps(full))).toBe(100);
  });

  it("an empty list is 0, not NaN", () => {
    expect(onboardingPercent([])).toBe(0);
  });
});
