// Proves the test harness itself is wired correctly before the real suites lean
// on it: the @/* alias resolves, JSX renders under jsdom, jest-dom matchers are
// registered, and the timezone is pinned. If this file fails, every other
// failure in the suite is suspect.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { cn } from "@/lib/utils";
import Badge from "@/components/Badge";

describe("test harness", () => {
  it("resolves the @/* path alias", () => {
    expect(typeof cn).toBe("function");
  });

  it("merges conflicting tailwind classes through cn", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("renders JSX under jsdom with jest-dom matchers available", () => {
    render(<Badge>Walking</Badge>);
    expect(screen.getByText("Walking")).toBeInTheDocument();
  });

  it("pins the timezone to Europe/Vilnius so date assertions are portable", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(
      "Europe/Vilnius",
    );
  });
});
