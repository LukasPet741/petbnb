import { describe, it, expect } from "vitest";
import { cleanPairCode, formatPairCode, isPairCode } from "@/lib/collar/pairCode";

describe("cleanPairCode", () => {
  it.each([
    ["7K3Q-9D2M", "7K3Q9D2M"],
    ["7k3q 9d2m", "7K3Q9D2M"],
    [" 7K3Q–9D2M ", "7K3Q9D2M"],
    ["7K3Q-9D2O", "7K3Q9D20"],
    ["IL00-ABCD", "1100ABCD"],
  ])("cleans %j to %s", (input, expected) => {
    expect(cleanPairCode(input)).toBe(expected);
  });
});

describe("isPairCode", () => {
  it("accepts eight Crockford characters", () => {
    expect(isPairCode("7K3Q9D2M")).toBe(true);
  });

  it.each(["7K3Q9D2", "7K3Q9D2MX", "7K3Q9D2U", ""])("rejects %j", (code) => {
    expect(isPairCode(code)).toBe(false);
  });
});

describe("formatPairCode", () => {
  it("adds the dash after four characters", () => {
    expect(formatPairCode("7K3Q9D2M")).toBe("7K3Q-9D2M");
  });

  it("leaves a short code alone while it is being typed", () => {
    expect(formatPairCode("7K3")).toBe("7K3");
  });
});
