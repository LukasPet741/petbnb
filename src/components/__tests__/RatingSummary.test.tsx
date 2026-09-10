import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RatingSummary from "@/components/RatingSummary";
import { LanguageProvider } from "@/context/LanguageContext";

// LanguageProvider subscribes to Supabase auth, and the suite's fetch guard throws
// on any real network call, so the client is stubbed for the locale-aware tests.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

/** Renders inside a real provider with the locale forced, so Intl actually runs. */
function renderIn(locale: "en" | "lt", ui: React.ReactElement) {
  window.localStorage.setItem("petbnb-locale", locale);
  return render(<LanguageProvider>{ui}</LanguageProvider>);
}

describe("RatingSummary when the sitter has reviews", () => {
  it("shows the stars, the average and the count together", () => {
    // No provider, so `t` is the identity function and the count text below IS the
    // key the component asked for — which is what a rename actually breaks.
    const { container } = render(<RatingSummary average={4.8} count={12} />);
    expect(container.querySelectorAll("[data-star]")).toHaveLength(5);
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("sitters.reviews.count.other")).toBeInTheDocument();
  });

  it("asks for the singular count key for a single review", () => {
    render(<RatingSummary average={5} count={1} />);
    expect(screen.getByText("sitters.reviews.count.one")).toBeInTheDocument();
  });

  it("pads a whole average to one decimal, so 4 does not render as bare 4", () => {
    render(<RatingSummary average={4} count={3} />);
    expect(screen.getByText("4.0")).toBeInTheDocument();
  });
});

describe("RatingSummary formatting by locale", () => {
  it("writes the average with a decimal comma in Lithuanian", () => {
    renderIn("lt", <RatingSummary average={4.8} count={12} />);
    expect(screen.getByText("4,8")).toBeInTheDocument();
    expect(screen.queryByText("4.8")).not.toBeInTheDocument();
  });

  it("writes the average with a decimal point in English", () => {
    renderIn("en", <RatingSummary average={4.8} count={12} />);
    expect(screen.getByText("4.8")).toBeInTheDocument();
  });
});

describe("RatingSummary when the sitter has no reviews", () => {
  /**
   * Null, not zero. A sitter with no reviews has not been rated badly, they have
   * not been rated at all — the same distinction averageRating() exists to protect.
   */
  it("renders nothing at all by default, so a launch-day listing does not read as dead", () => {
    const { container } = render(<RatingSummary average={null} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an explicit label when asked for one", () => {
    render(<RatingSummary average={null} count={0} emptyState="label" />);
    expect(screen.getByText("sitters.reviews.none")).toBeInTheDocument();
  });

  it("shows no stars in the labelled empty state, rather than five grey ones", () => {
    // Five empty stars read as "rated zero", which is the exact misreading the
    // null-not-zero rule exists to prevent.
    const { container } = render(<RatingSummary average={null} count={0} emptyState="label" />);
    expect(container.querySelectorAll("[data-star]")).toHaveLength(0);
  });

  it("treats a null average with a non-zero count as unrated rather than rendering NaN", () => {
    // The view cannot produce this, but a partial select or a hand-built object can.
    const { container } = render(<RatingSummary average={null} count={4} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("treats a zero count with a present average as unrated", () => {
    const { container } = render(<RatingSummary average={4.5} count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
