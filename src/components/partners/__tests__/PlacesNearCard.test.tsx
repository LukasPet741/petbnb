import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PlacesNearCard from "@/components/partners/PlacesNearCard";

vi.mock("@/components/partners/LazyPlacesMap", () => ({
  default: (props: { places: { slug: string }[] }) => (
    <div data-testid="map" data-slugs={props.places.map((p) => p.slug).join(",")} />
  ),
}));

const slugs = () => screen.getByTestId("map").dataset.slugs;

describe("PlacesNearCard", () => {
  it("shows a dog owner the places that take dogs", () => {
    render(<PlacesNearCard pets={[{ name: "Reksas", type: "dog" }]} />);
    expect(slugs()).toContain("dogiday");
  });

  it("does not show a cat owner a dogs-only place", () => {
    render(<PlacesNearCard pets={[{ name: "Murka", type: "cat" }]} />);
    expect(slugs()).not.toContain("dogiday");
  });

  it("shows every partner to someone with no pets yet", () => {
    render(<PlacesNearCard pets={[]} />);
    expect(slugs()).toContain("dogiday");
    expect(slugs()).toContain("dogpunk");
  });
});
