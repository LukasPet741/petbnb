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
    { id: "kaunas-groomer", full_name: "A", city: "kaunas", services: { grooming: true }, prices: { grooming: { amount: 20 } } },
    { id: "kaunas-walker", full_name: "B", city: "Kaunas", services: { walking: true }, prices: { walking: { amount: 15, days: 1 } } },
    { id: "kaunas-boarder", full_name: "C", city: "Kaunas", services: { boarding: true }, prices: { boarding: { amount: 75, days: 3 } } },
    { id: "vilnius-groomer", full_name: "D", city: "Vilnius", services: { grooming: true }, prices: { grooming: { amount: 30 } } },
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
    expect(await cards()).toEqual(["card:kaunas-groomer"]);
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

    expect(pill("grooming")).toHaveTextContent("2");
    expect(pill("walking")).toHaveTextContent("1");

    fireEvent.click(pill("walking"));
    expect(pill("walking")).toHaveAttribute("aria-pressed", "true");
    expect(await cards()).toEqual(["card:kaunas-walker"]);
  });

  it("sorts by the lowest daily rate, groomers (no daily rate) last", async () => {
    window.history.replaceState({}, "", "/browse");
    render(<BrowsePage />);
    await cards();

    fireEvent.change(screen.getByRole("combobox", { name: "appPages.browse.sortLabel" }), { target: { value: "price" } });
    expect((await cards()).slice(0, 2)).toEqual(["card:kaunas-walker", "card:kaunas-boarder"]);
  });

  it("caps the daily price, and caps grooming by its visit price once grooming is chosen", async () => {
    window.history.replaceState({}, "", "/browse");
    render(<BrowsePage />);
    await cards();

    fireEvent.change(screen.getByRole("combobox", { name: "appPages.browse.priceLabel" }), { target: { value: "20" } });
    expect(await cards()).toEqual(["card:kaunas-groomer", "card:kaunas-walker", "card:vilnius-groomer"]);

    fireEvent.click(screen.getByRole("button", { name: /common\.services\.grooming/ }));
    expect(await cards()).toEqual(["card:kaunas-groomer"]);
  });

  it("clears every filter at once", async () => {
    window.history.replaceState({}, "", "/browse?service=grooming&city=kaunas");
    render(<BrowsePage />);
    await cards();

    fireEvent.click(screen.getByRole("button", { name: "appPages.browse.clearAllButton" }));
    expect(await cards()).toHaveLength(4);
  });
});
