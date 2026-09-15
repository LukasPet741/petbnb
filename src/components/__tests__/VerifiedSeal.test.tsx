import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VerifiedSeal, { VerificationRow, showsBadge } from "@/components/VerifiedSeal";

/**
 * The Smart-ID badge (2026-09-15). Only a verification someone actually went through shows it:
 * the 25 seeded sitters are is_verified under 'seed' and must show nothing. Rendered without a
 * LanguageProvider, so labels are their translation keys.
 */

describe("showsBadge", () => {
  it.each([
    [undefined, false],
    ["none", false],
    ["seed", false],
    ["smart_id_demo", true],
    ["smart_id", true],
  ] as const)("%s -> %s", (method, expected) => {
    expect(showsBadge(method)).toBe(expected);
  });
});

describe("VerifiedSeal", () => {
  it("renders nothing for a seeded or unverified profile", () => {
    const { container, rerender } = render(<VerifiedSeal method="seed" />);
    expect(container).toBeEmptyDOMElement();
    rerender(<VerifiedSeal method="none" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is an image named as a demo verification for a demo badge", () => {
    render(<VerifiedSeal method="smart_id_demo" />);
    expect(screen.getByRole("img", { name: "common.verification.sealDemo" })).toBeInTheDocument();
  });

  it("drops the demo wording for a real Smart-ID verification", () => {
    render(<VerifiedSeal method="smart_id" />);
    expect(screen.getByRole("img", { name: "common.verification.seal" })).toBeInTheDocument();
  });
});

describe("VerificationRow", () => {
  it("says who verified, marks it DEMO and dates it", () => {
    render(<VerificationRow method="smart_id_demo" verifiedAt="2026-09-15T17:10:13Z" />);
    expect(screen.getByText("common.verification.rowTitle")).toBeInTheDocument();
    expect(screen.getByText("common.verification.demoTag")).toBeInTheDocument();
    expect(screen.getByText("common.verification.demoNote")).toBeInTheDocument();
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("renders nothing without a badge-worthy verification", () => {
    const { container } = render(<VerificationRow method="seed" verifiedAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
