import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PlacesNearCard from "@/components/partners/PlacesNearCard";

// The real hook reads the places tables over the network; here it is the built-in list.
vi.mock("@/lib/useSitterAreas", () => ({ useSitterAreas: () => [] }));
vi.mock("@/lib/usePlaces", async () => {
  const { ALL_PLACES } = await import("@/lib/partners");
  return { usePlaces: () => ALL_PLACES };
});

vi.mock("@/components/partners/LazyPlacesMap", () => ({
  default: (props: { places: { slug: string }[] }) => (
    <div data-testid="map" data-slugs={props.places.map((p) => p.slug).join(",")} />
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const slugs = () => screen.getByTestId("map").dataset.slugs;
const reksas = { id: "p1", name: "Reksas", type: "dog" };
const murka = { id: "p2", name: "Murka", type: "cat" };

describe("PlacesNearCard", () => {
  it("shows a dog owner the places that take dogs", () => {
    render(<PlacesNearCard pets={[reksas]} />);
    expect(slugs()).toContain("dogiday");
  });

  it("does not show a cat owner a dogs-only place, but does show the listed vets and shops", () => {
    render(<PlacesNearCard pets={[murka]} />);
    expect(slugs()).not.toContain("dogiday");
    expect(slugs()).toContain("kika");
  });

  it("shows every partner to someone with no pets yet, without pet chips", () => {
    render(<PlacesNearCard pets={[]} />);
    expect(slugs()).toContain("dogiday");
    expect(slugs()).toContain("dogpunk");
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("takes a pet out of the filter with its chip, and All places drops the filter", () => {
    render(<PlacesNearCard pets={[reksas, murka]} />);
    expect(slugs()).toContain("dogiday");

    fireEvent.click(screen.getByRole("button", { name: /Reksas/ }));
    expect(slugs()).not.toContain("dogiday");

    fireEvent.click(screen.getByRole("button", { name: /partners.near.allPlaces/ }));
    expect(slugs()).toContain("dogpunk");
    expect(screen.getByText("partners.near.all")).toBeTruthy();
  });
});
