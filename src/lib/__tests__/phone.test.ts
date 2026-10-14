import { describe, it, expect } from "vitest";
import { parsePhone, splitPhone, formatPhone } from "@/lib/phone";

describe("parsePhone", () => {
  it("reads a Lithuanian mobile number the way people type it", () => {
    expect(parsePhone("LT", "612 34567")).toEqual({ country: "LT", national: "61234567" });
    expect(parsePhone("LT", "61234567")).toEqual({ country: "LT", national: "61234567" });
    expect(parsePhone("LT", "(8-612) 34567")).toEqual({ country: "LT", national: "61234567" });
  });

  it("drops Lithuania's domestic 8 or 0 in front", () => {
    expect(parsePhone("LT", "8 612 34567")).toEqual({ country: "LT", national: "61234567" });
    expect(parsePhone("LT", "0 612 34567")).toEqual({ country: "LT", national: "61234567" });
  });

  it("takes a pasted international number and switches to its country", () => {
    expect(parsePhone("LT", "+370 612 34567")).toEqual({ country: "LT", national: "61234567" });
    expect(parsePhone("LT", "00370 61234567")).toEqual({ country: "LT", national: "61234567" });
    expect(parsePhone("LT", "370 61234567")).toEqual({ country: "LT", national: "61234567" });
    expect(parsePhone("LT", "+371 2123 4567")).toEqual({ country: "LV", national: "21234567" });
    expect(parsePhone("LV", "+372 5123 4567")).toEqual({ country: "EE", national: "51234567" });
  });

  it("checks each country's length", () => {
    expect(parsePhone("LV", "2123 4567")).toEqual({ country: "LV", national: "21234567" });
    expect(parsePhone("LV", "212 3456")).toBeNull();
    expect(parsePhone("EE", "5123 4567")).toEqual({ country: "EE", national: "51234567" });
    expect(parsePhone("EE", "512 3456")).toEqual({ country: "EE", national: "5123456" });
    expect(parsePhone("EE", "51 2345")).toBeNull();
    expect(parsePhone("LT", "612 3456")).toBeNull();
    expect(parsePhone("LT", "6123 45678")).toBeNull();
  });

  it("refuses what is not a Baltic number", () => {
    expect(parsePhone("LT", "+49 151 23456789")).toBeNull();
    expect(parsePhone("LT", "abc")).toBeNull();
    expect(parsePhone("LT", "")).toBeNull();
  });
});

describe("splitPhone", () => {
  it("finds the country of a stored number", () => {
    expect(splitPhone("+371 21234567")).toEqual({ country: "LV", national: "21234567" });
    expect(splitPhone("+372 5123456")).toEqual({ country: "EE", national: "5123456" });
    expect(splitPhone("+370 600 12345")).toEqual({ country: "LT", national: "600 12345" });
  });

  it("falls back to Lithuania", () => {
    expect(splitPhone(null)).toEqual({ country: "LT", national: "" });
    expect(splitPhone("61234567")).toEqual({ country: "LT", national: "61234567" });
  });
});

describe("formatPhone", () => {
  it("stores the dial code, a space and the national digits", () => {
    expect(formatPhone({ country: "LT", national: "61234567" })).toBe("+370 61234567");
    expect(formatPhone({ country: "EE", national: "5123456" })).toBe("+372 5123456");
  });
});
