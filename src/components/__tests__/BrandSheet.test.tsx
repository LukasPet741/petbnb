import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import BrandSheet from "@/components/brand/BrandSheet";
import { PALETTE } from "@/lib/brand";

// Rendered without a LanguageProvider, so t() returns its key: the assertions name
// exactly which strings each part of the page asks for.
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

describe("BrandSheet", () => {
  it("shows the logo, the colours, the type and the three promises", () => {
    render(<BrandSheet />);
    expect(screen.getByRole("heading", { level: 1, name: "brand.title" })).toBeInTheDocument();
    for (const key of ["brand.logo.title", "brand.colour.title", "brand.type.title", "brand.signatures.title"]) {
      expect(screen.getByRole("heading", { level: 2, name: key })).toBeInTheDocument();
    }
    for (const { hex } of PALETTE) expect(screen.getByText(hex.toUpperCase())).toBeInTheDocument();
    for (const id of ["smartId", "live", "agreed"]) {
      expect(screen.getByText(`brand.signatures.${id}.name`)).toBeInTheDocument();
    }
  });

  it("offers the mark itself as a file", () => {
    render(<BrandSheet />);
    expect(screen.getByRole("link", { name: /brand\.logo\.download/ })).toHaveAttribute("href", "/icon.svg");
  });
});
