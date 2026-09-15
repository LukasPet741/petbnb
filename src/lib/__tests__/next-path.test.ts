import { describe, it, expect } from "vitest";
import { safeNextPath, nextFromSearch, withNext } from "@/lib/next-path";

/**
 * Where to continue after signing in. Since 2026-09-15 finding sitters needs an account, so
 * the login wall has to remember the page a visitor was heading for — and must never become
 * an open redirect, because ?next= is attacker-controlled: a phishing link to
 * petbnb.lt/login?next=//evil.example would otherwise hand a fresh session's tab to them.
 */

describe("safeNextPath", () => {
  it.each([
    ["/browse", "/browse"],
    ["/browse?service=grooming", "/browse?service=grooming"],
    ["/browse/740b5962-4f41-4871-9c4e-333d7680325b", "/browse/740b5962-4f41-4871-9c4e-333d7680325b"],
    ["/bookings/new?sitter=abc#dates", "/bookings/new?sitter=abc#dates"],
  ])("keeps the same-site path %s", (raw, want) => {
    expect(safeNextPath(raw)).toBe(want);
  });

  it.each([
    ["a protocol-relative URL", "//evil.example/x"],
    ["a backslash authority, which browsers read as //", "/\\evil.example"],
    ["an absolute URL", "https://evil.example/"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a relative path", "browse"],
    ["an empty string", ""],
    ["a tab smuggled into the authority", "/\t/evil.example"],
  ])("refuses %s", (_label, raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it.each(["/login", "/login?next=/browse", "/signup"])("refuses %s, which would loop back to the wall", (raw) => {
    expect(safeNextPath(raw)).toBeNull();
  });

  it("refuses a missing value", () => {
    expect(safeNextPath(null)).toBeNull();
    expect(safeNextPath(undefined)).toBeNull();
  });
});

describe("nextFromSearch", () => {
  it("reads and decodes ?next= from a location search string", () => {
    expect(nextFromSearch("?next=%2Fbrowse%3Fservice%3Dwalking")).toBe("/browse?service=walking");
  });

  it("returns null when ?next= is absent or unsafe", () => {
    expect(nextFromSearch("")).toBeNull();
    expect(nextFromSearch("?next=%2F%2Fevil.example")).toBeNull();
  });
});

describe("withNext", () => {
  it("appends the path as an encoded ?next=", () => {
    expect(withNext("/login", "/browse?city=Klaipėda")).toBe("/login?next=%2Fbrowse%3Fcity%3DKlaip%C4%97da");
  });

  it("leaves the path alone when there is nowhere safe to continue to", () => {
    expect(withNext("/profile", null)).toBe("/profile");
    expect(withNext("/login", "//evil.example")).toBe("/login");
  });
});
