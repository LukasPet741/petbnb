import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PetPublicToggle from "@/components/PetPublicToggle";

/** Rendered without a LanguageProvider, so every label is the key it asked for. */

vi.mock("@/lib/supabase", () => ({ supabase: {} }));
const setPetPublic = vi.hoisted(() => vi.fn());
vi.mock("@/lib/placeCommunity", () => ({ setPetPublic }));

describe("PetPublicToggle", () => {
  it("stays hidden until the pet row knows is_public (the migration is not live)", () => {
    const { container } = render(<PetPublicToggle pet={{ id: "p1", name: "Reksas" }} />);
    expect(container.textContent).toBe("");
  });

  it("is off by default and turns the profile public, then offers its link", async () => {
    setPetPublic.mockResolvedValue(null);
    render(<PetPublicToggle pet={{ id: "p1", name: "Reksas", is_public: false }} />);
    const toggle = screen.getByRole("switch");
    expect((toggle as HTMLInputElement).checked).toBe(false);
    fireEvent.click(toggle);
    await waitFor(() => expect(setPetPublic).toHaveBeenCalledWith(expect.anything(), "p1", true));
    expect((await screen.findByRole("link", { name: "partners.petPage.open" })).getAttribute("href")).toBe("/p/p1");
  });
});
