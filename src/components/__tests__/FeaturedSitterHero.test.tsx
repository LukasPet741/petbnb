import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FeaturedSitterHero, { excerpt } from "@/components/FeaturedSitterHero";
import type { Profile } from "@/lib/types";

// ---------------------------------------------------------------------------
// Mocks. The component runs one Supabase query on mount and pushes to the
// router on search. The query uses a TWO-argument .then, so the rejection
// handler is a real branch and the stub must honour both callbacks.
// ---------------------------------------------------------------------------

const h = vi.hoisted(() => ({
  result: { data: null as unknown, error: null as unknown },
  reject: false,
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock("@/lib/supabase", () => {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: () => chain,
    then: (
      resolve: (v: unknown) => unknown,
      onReject?: (e: unknown) => unknown,
    ) =>
      h.reject
        ? Promise.reject(new Error("network")).then(resolve, onReject)
        : Promise.resolve(h.result).then(resolve),
  };
  return { supabase: { from: () => chain } };
});

let seq = 0;
function sitter(over: Partial<Profile> = {}): Profile {
  seq += 1;
  return {
    id: `s-${seq}`,
    full_name: `Sitter ${seq}`,
    phone: "+370 600 00000",
    city: "Vilnius",
    is_sitter: true,
    rate_per_hour: 15,
    experience_years: 3,
    services: { walking: true, boarding: false, daycare: false, grooming: false },
    about_me: "I have looked after dogs for years and love long walks.",
    avatar_url: "https://x/a.jpg",
    last_active_at: "2026-09-01T10:00:00Z",
    ...over,
  } as Profile;
}

beforeEach(() => {
  seq = 0;
  h.result = { data: [], error: null };
  h.reject = false;
  h.push.mockReset();
});

const quoteHero = () => screen.queryByText(/home\.hero\.readyEyebrow/);
const fallbackHero = () => screen.queryByText(/home\.hero\.fallbackEyebrow/);
const searchBox = () => screen.queryByRole("textbox");

async function renderHero() {
  const view = render(<FeaturedSitterHero />);
  await waitFor(() =>
    expect(quoteHero() ?? fallbackHero()).toBeInTheDocument(),
  );
  return view;
}

// ---------------------------------------------------------------------------
// excerpt — pure
// ---------------------------------------------------------------------------

describe("excerpt", () => {
  it("returns a short string unchanged", () => {
    expect(excerpt("Short bio.")).toBe("Short bio.");
  });

  it("trims surrounding whitespace", () => {
    expect(excerpt("   padded   ")).toBe("padded");
  });

  it("collapses newlines and tabs into single spaces", () => {
    expect(excerpt("a\n\nb\tc")).toBe("a b c");
  });

  it("collapses a non-breaking space too, since \\s matches it", () => {
    expect(excerpt("a b")).toBe("a b");
  });

  it("returns an empty string for whitespace-only input", () => {
    expect(excerpt("   \n\t  ")).toBe("");
  });

  it("leaves a string of exactly the limit untouched, with no ellipsis", () => {
    const exact = "x".repeat(220);
    expect(excerpt(exact)).toBe(exact);
    expect(excerpt(exact)).not.toContain("…");
  });

  it("cuts at the last word boundary once over the limit", () => {
    // The space at index 210 falls inside the 220-character window, so the
    // partial word after it is dropped rather than severed mid-way.
    const out = excerpt(`${"x".repeat(210)} ${"y".repeat(50)}`);
    expect(out).toBe(`${"x".repeat(210)}…`);
  });

  it("hard-cuts a long unbroken string that has no spaces at all", () => {
    // lastIndexOf(" ") is -1, so it falls back to the raw limit.
    const out = excerpt("y".repeat(300));
    expect(out).toBe(`${"y".repeat(220)}…`);
  });

  // BUG (src/components/FeaturedSitterHero.tsx:26): the cut always retreats to
  // the last space inside the window, however early that space is. A bio that
  // opens with a short token followed by a very long unbroken run - "A" then a
  // 400-character URL, say - collapses to a one-letter quote, "a…", which is
  // then rendered as the featured sitter's headline testimonial.
  // Correct behaviour would be to keep the hard cut when the word boundary
  // would discard most of the available window.
  it("collapses to a single character when the only space is near the start (current buggy behaviour)", () => {
    expect(excerpt(`a ${"z".repeat(400)}`)).toBe("a…");
  });

  it("hard-cuts when there is no space left after trimming", () => {
    // The leading space is trimmed away, so lastIndexOf returns -1.
    expect(excerpt(` ${"z".repeat(400)}`)).toBe(`${"z".repeat(220)}…`);
  });

  it("counts a Lithuanian diacritic as a single character", () => {
    const text = "ą".repeat(221);
    expect(excerpt(text)).toHaveLength(221); // 220 chars + the ellipsis
  });

  // slice() works in UTF-16 code units, so a surrogate pair straddling the cut
  // is torn in half and renders as a replacement character.
  it("splits an emoji that straddles the cut boundary (current behaviour)", () => {
    const text = `${"x".repeat(219)}🐶${"y".repeat(50)}`;
    const out = excerpt(text);
    const lastChar = out.slice(-2, -1);
    expect(lastChar.charCodeAt(0)).toBeGreaterThanOrEqual(0xd800);
    expect(lastChar.charCodeAt(0)).toBeLessThanOrEqual(0xdbff);
  });

  it("returns just an ellipsis when the limit is zero", () => {
    expect(excerpt("anything at all", 0)).toBe("…");
  });

  it("treats a negative limit as a slice from the end, not as zero", () => {
    // slice(0, -5) drops the last five characters rather than taking none, so
    // the result is longer than the caller asked for, not shorter.
    expect(excerpt("anything at all", -5)).toBe("anything…");
  });
});

// ---------------------------------------------------------------------------
// Render branches
// ---------------------------------------------------------------------------

describe("loading state", () => {
  it("shows neither hero variant and no search form while the query is in flight", () => {
    // The promise never settles during this synchronous assertion.
    render(<FeaturedSitterHero />);
    expect(quoteHero()).not.toBeInTheDocument();
    expect(fallbackHero()).not.toBeInTheDocument();
    expect(searchBox()).not.toBeInTheDocument();
  });
});

describe("ready state", () => {
  it("quotes an eligible sitter's own bio", async () => {
    h.result = { data: [sitter({ about_me: "I walk dogs every morning." })], error: null };
    await renderHero();
    expect(quoteHero()).toBeInTheDocument();
    expect(screen.getByText(/I walk dogs every morning\./)).toBeInTheDocument();
  });

  it("shows the sitter's photo when they have one", async () => {
    h.result = { data: [sitter({ avatar_url: "https://x/face.jpg" })], error: null };
    const { container } = await renderHero();
    const srcs = Array.from(container.querySelectorAll("img")).map((i) => i.getAttribute("src"));
    expect(srcs).toContain("https://x/face.jpg");
  });

  it("falls back to an initials tile when no eligible sitter has a photo", async () => {
    h.result = {
      data: [sitter({ full_name: "Jonas Petraitis", avatar_url: null })],
      error: null,
    };
    await renderHero();
    // Two tiles render: one for the mobile byline, one for the desktop panel.
    expect(screen.getAllByText("JP")).toHaveLength(2);
  });

  it("prefers a sitter with a photo over one without", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    h.result = {
      data: [
        sitter({ full_name: "No Photo", avatar_url: null }),
        sitter({ full_name: "Has Photo", avatar_url: "https://x/p.jpg" }),
      ],
      error: null,
    };
    await renderHero();
    // Index 0 of the with-photo pool is the second row, not the first overall.
    expect(screen.getByText(/Has Photo/)).toBeInTheDocument();
  });

  it("picks the first of the pool when random returns 0", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    h.result = {
      data: [sitter({ full_name: "First One" }), sitter({ full_name: "Second One" })],
      error: null,
    };
    await renderHero();
    expect(screen.getByText(/First One/)).toBeInTheDocument();
  });

  it("picks the last of the pool when random approaches 1, without running off the end", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    h.result = {
      data: [sitter({ full_name: "First One" }), sitter({ full_name: "Second One" })],
      error: null,
    };
    await renderHero();
    expect(screen.getByText(/Second One/)).toBeInTheDocument();
  });

  it("shows the experience suffix when the sitter has years recorded", async () => {
    h.result = { data: [sitter({ experience_years: 5 })], error: null };
    await renderHero();
    expect(screen.getByText(/common\.experienceSuffixPlural/)).toBeInTheDocument();
  });

  it("uses the singular suffix for exactly one year", async () => {
    h.result = { data: [sitter({ experience_years: 1 })], error: null };
    await renderHero();
    expect(screen.getByText(/common\.experienceSuffix(?!Plural)/)).toBeInTheDocument();
  });

  it("omits the experience clause when no years are recorded", async () => {
    h.result = { data: [sitter({ experience_years: null })], error: null };
    await renderHero();
    expect(screen.queryByText(/common\.experienceSuffix/)).not.toBeInTheDocument();
  });
});

describe("fallback state", () => {
  it("falls back when the query returns an error object", async () => {
    h.result = { data: null, error: { message: "boom" } };
    await renderHero();
    expect(fallbackHero()).toBeInTheDocument();
    expect(quoteHero()).not.toBeInTheDocument();
  });

  it("falls back when the query promise rejects outright", async () => {
    // Exercises the second argument of the two-argument .then.
    h.reject = true;
    await renderHero();
    expect(fallbackHero()).toBeInTheDocument();
  });

  it("falls back when the query resolves with null data", async () => {
    h.result = { data: null, error: null };
    await renderHero();
    expect(fallbackHero()).toBeInTheDocument();
  });

  it("falls back when there are no sitters at all", async () => {
    h.result = { data: [], error: null };
    await renderHero();
    expect(fallbackHero()).toBeInTheDocument();
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["whitespace only", "   \n  "],
  ])("treats a sitter whose bio is %s as ineligible", async (_label, about_me) => {
    h.result = { data: [sitter({ about_me })], error: null };
    await renderHero();
    // Status is "ready", yet with an empty pool the fallback hero is shown.
    expect(fallbackHero()).toBeInTheDocument();
  });
});

describe("search form", () => {
  it("is present in the ready state", async () => {
    h.result = { data: [sitter()], error: null };
    await renderHero();
    expect(searchBox()).toBeInTheDocument();
  });

  it("is present in the fallback state too", async () => {
    h.result = { data: [], error: null };
    await renderHero();
    expect(searchBox()).toBeInTheDocument();
  });

  it("navigates to the bare sitters route for an empty query", async () => {
    const user = userEvent.setup();
    h.result = { data: [], error: null };
    await renderHero();
    await user.click(screen.getByRole("button", { name: /home\.hero\.searchButton/ }));
    expect(h.push).toHaveBeenCalledWith("/sitters");
  });

  it("navigates to the bare sitters route for a whitespace-only query", async () => {
    const user = userEvent.setup();
    h.result = { data: [], error: null };
    await renderHero();
    await user.type(searchBox()!, "   ");
    await user.click(screen.getByRole("button", { name: /home\.hero\.searchButton/ }));
    expect(h.push).toHaveBeenCalledWith("/sitters");
  });

  it("percent-encodes a Lithuanian city name", async () => {
    const user = userEvent.setup();
    h.result = { data: [], error: null };
    await renderHero();
    await user.type(searchBox()!, "Klaipėda");
    await user.click(screen.getByRole("button", { name: /home\.hero\.searchButton/ }));
    expect(h.push).toHaveBeenCalledWith("/sitters?city=Klaip%C4%97da");
  });

  it.each([
    ["an ampersand and equals", "a&b=c", "/sitters?city=a%26b%3Dc"],
    ["a fragment character", "a#b", "/sitters?city=a%23b"],
    ["a traversal attempt", "../../etc", "/sitters?city=..%2F..%2Fetc"],
  ])("encodes %s rather than letting it alter the URL", async (_label, input, expected) => {
    const user = userEvent.setup();
    h.result = { data: [], error: null };
    await renderHero();
    await user.type(searchBox()!, input);
    await user.click(screen.getByRole("button", { name: /home\.hero\.searchButton/ }));
    expect(h.push).toHaveBeenCalledWith(expected);
  });
});

describe("unguarded avatar name", () => {
  // BUG (src/components/FeaturedSitterHero.tsx): the sitter's full_name is
  // handed to <Avatar name={...}> with no fallback, and Avatar calls
  // name.split(" ") unconditionally. Profile.full_name is nullable in the
  // generated database row type, so a sitter row with a null name takes the
  // whole landing page down with a TypeError. This is the only unguarded
  // Avatar call site in the codebase - SitterCard guards with ?? and
  // BookingCard guards with a ?? chain.
  // Correct behaviour would be `name={sitter.full_name ?? t("appShell.sitterFallback")}`.
  it("crashes the hero when the chosen sitter has a null full_name (current buggy behaviour)", async () => {
    h.result = {
      data: [sitter({ full_name: null as unknown as string, avatar_url: null })],
      error: null,
    };

    // The crash happens on the re-render triggered by the resolved query, not
    // during the first render, so it has to be caught by a boundary rather
    // than by wrapping render() in expect(...).toThrow().
    const caught: Error[] = [];
    class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error: Error) {
        caught.push(error);
      }
      render() {
        return this.state.failed ? <p>crashed</p> : this.props.children;
      }
    }

    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(
        <Boundary>
          <FeaturedSitterHero />
        </Boundary>,
      );
      await waitFor(() => expect(screen.getByText("crashed")).toBeInTheDocument());
    } finally {
      quiet.mockRestore();
    }

    expect(caught).toHaveLength(1);
    expect(caught[0]).toBeInstanceOf(TypeError);
    expect(caught[0].message).toMatch(/split/i);
  });
});
