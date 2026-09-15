import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BrowsePage from "@/app/(app)/browse/page";

/**
 * /browse is the only sitter directory since 2026-09-15, and the landing page's links arrive
 * here filtered: a service tile sends ?service=, the hero search and city tiles ?city=.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

vi.mock("@/lib/supabase", () => {
  const rows = [
    { id: "kaunas-groomer", full_name: "A", city: "kaunas", services: { grooming: true }, rate_per_hour: 20 },
    { id: "kaunas-walker", full_name: "B", city: "Kaunas", services: { walking: true }, rate_per_hour: 15 },
    { id: "kaunas-groomer-2", full_name: "C", city: "Kaunas", services: { grooming: true }, rate_per_hour: 25 },
    { id: "vilnius-groomer", full_name: "D", city: "Vilnius", services: { grooming: true }, rate_per_hour: 30 },
  ];
  const chain = {
    select: () => chain,
    eq: () => ({ then: (cb: (r: { data: typeof rows }) => void) => Promise.resolve(cb({ data: rows })) }),
  };
  return { supabase: { from: () => chain } };
});
vi.mock("@/hooks/useSitterRatings", () => ({ useSitterRatings: () => new Map() }));
vi.mock("@/components/SitterCard", () => ({ default: ({ sitter }: { sitter: { id: string } }) => <p>card:{sitter.id}</p> }));
vi.mock("@/components/SitterMini", () => ({ default: () => null }));

afterEach(() => window.history.replaceState({}, "", "/"));

const cards = async () => (await screen.findAllByText(/^card:/)).map((el) => el.textContent);

describe("/browse", () => {
  it("arrives filtered to ?service= and ?city=, counting every spelling of the city", async () => {
    window.history.replaceState({}, "", "/browse?service=grooming&city=kaunas");
    render(<BrowsePage />);
    expect(await cards()).toEqual(["card:kaunas-groomer", "card:kaunas-groomer-2"]);
  });

  it("lists everyone when the link carries no filters", async () => {
    window.history.replaceState({}, "", "/browse");
    render(<BrowsePage />);
    expect(await cards()).toHaveLength(4);
  });
});

describe("/browse filter bar (variant A, 2026-09-15)", () => {
  const pill = (service: string) => screen.getByRole("button", { name: new RegExp(`common\\.services\\.${service}`) });

  it("says on each service pill how many sitters it would show, and filters when pressed", async () => {
    window.history.replaceState({}, "", "/browse");
    render(<BrowsePage />);
    await cards();

    expect(pill("grooming")).toHaveTextContent("3");
    expect(pill("walking")).toHaveTextContent("1");

    fireEvent.click(pill("walking"));
    expect(pill("walking")).toHaveAttribute("aria-pressed", "true");
    expect(await cards()).toEqual(["card:kaunas-walker"]);
  });

  it("sorts by lowest price", async () => {
    window.history.replaceState({}, "", "/browse");
    render(<BrowsePage />);
    await cards();

    fireEvent.change(screen.getByRole("combobox", { name: "appPages.browse.sortLabel" }), { target: { value: "price" } });
    expect(await cards()).toEqual(["card:kaunas-walker", "card:kaunas-groomer", "card:kaunas-groomer-2", "card:vilnius-groomer"]);
  });

  it("caps the hourly price", async () => {
    window.history.replaceState({}, "", "/browse");
    render(<BrowsePage />);
    await cards();

    fireEvent.change(screen.getByRole("combobox", { name: "appPages.browse.priceLabel" }), { target: { value: "20" } });
    expect(await cards()).toEqual(["card:kaunas-groomer", "card:kaunas-walker"]);
  });

  it("clears every filter at once", async () => {
    window.history.replaceState({}, "", "/browse?service=grooming&city=kaunas");
    render(<BrowsePage />);
    await cards();

    fireEvent.click(screen.getByRole("button", { name: "appPages.browse.clearAllButton" }));
    expect(await cards()).toHaveLength(4);
  });
});
