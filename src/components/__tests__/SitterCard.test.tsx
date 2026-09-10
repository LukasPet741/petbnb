import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SitterCard, { getActivityBucket as bucketFromCard } from "@/components/SitterCard";
import SitterMini, { getActivityBucket as bucketFromMini } from "@/components/SitterMini";
import { lookup } from "@/context/LanguageContext";
import { dictionaries } from "@/lib/i18n";
import type { Profile } from "@/lib/types";

// Neither component touches Supabase or the router - only useLanguage, next/link,
// Avatar, Badge and (optionally) FavoriteButton. Rendered without a LanguageProvider
// the default context's t is the identity function, so every label below IS the
// translation key the component asked for. That makes these assertions precise about
// which key each branch requests, which is what actually breaks in a rename.

const NOW = new Date("2026-09-01T12:00:00+03:00"); // Vilnius local noon
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** An ISO timestamp `ms` milliseconds before the pinned system time. */
const agoIso = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

function sitter(overrides: Partial<Profile> = {}): Profile {
  return {
    id: "s-1",
    full_name: "Jonas Petraitis",
    phone: "+37060000000",
    city: "Vilnius",
    is_sitter: true,
    rate_per_hour: 12,
    experience_years: 3,
    services: { walking: true, boarding: false, daycare: false, grooming: false },
    about_me: "I have looked after dogs for years.",
    avatar_url: null,
    last_active_at: agoIso(5 * MINUTE),
    ...overrides,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// getActivityBucket - duplicated verbatim in SitterCard.tsx and SitterMini.tsx
// ---------------------------------------------------------------------------

/** Every boundary the bucket function has, as [label, input, expected]. */
const BUCKET_CASES: ReadonlyArray<
  readonly [string, string | null | undefined, "now" | "today" | "week" | null]
> = [
  ["null", null, null],
  ["undefined", undefined, null],
  ["an empty string", "", null],
  ["a non-date string", "not a date", null],
  ["a half-parsed garbage string", "2026-13-45T99:99:99Z", null],
  ["exactly 15 minutes ago", agoIso(15 * MINUTE), "now"],
  ["a hair over 15 minutes ago", agoIso(15 * MINUTE + 1000), "today"],
  ["exactly 24 hours ago", agoIso(24 * HOUR), "today"],
  ["a hair over 24 hours ago", agoIso(24 * HOUR + 1000), "week"],
  ["exactly 7 days ago", agoIso(7 * DAY), "week"],
  ["a hair over 7 days ago", agoIso(7 * DAY + 1000), null],
  ["one second in the future", new Date(NOW.getTime() + 1000).toISOString(), "now"],
  ["a year in the future", new Date(NOW.getTime() + 365 * DAY).toISOString(), "now"],
];

describe("getActivityBucket", () => {
  const withPinnedClock = <T,>(fn: () => T): T => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    try {
      return fn();
    } finally {
      vi.useRealTimers();
    }
  };

  describe("SitterCard's copy", () => {
    it.each(BUCKET_CASES)("returns %s -> the expected bucket", (_label, input, expected) => {
      expect(withPinnedClock(() => bucketFromCard(input))).toBe(expected);
    });
  });

  describe("SitterMini's copy", () => {
    it.each(BUCKET_CASES)("returns %s -> the expected bucket", (_label, input, expected) => {
      expect(withPinnedClock(() => bucketFromMini(input))).toBe(expected);
    });
  });

  // The helper is copy-pasted verbatim into both components. Nothing in the build
  // stops someone editing one copy and not the other, so this is the drift guard:
  // it fails the moment the two implementations disagree on any input.
  it("agrees between the two duplicated implementations on every input", () => {
    const inputs = BUCKET_CASES.map(([, input]) => input);
    const fromCard = withPinnedClock(() => inputs.map(bucketFromCard));
    const fromMini = withPinnedClock(() => inputs.map(bucketFromMini));
    expect(fromMini).toEqual(fromCard);
  });

  // Unlike timeAgo() in lib/utils, this helper DOES guard NaN, so a corrupt
  // last_active_at renders no activity line rather than a "NaNd ago" string.
  it("guards NaN, which is the guard timeAgo in lib/utils is missing", () => {
    expect(withPinnedClock(() => bucketFromCard("garbage"))).toBeNull();
    expect(withPinnedClock(() => bucketFromMini("garbage"))).toBeNull();
  });

  // BUG: a future last_active_at (clock skew on the writer, or a seeded row)
  // yields a NEGATIVE age, which is <= 15 and so buckets as "now". A sitter who
  // has never been online can therefore advertise "Active now" indefinitely.
  // Correct behaviour would be to clamp negative ages, or return null for them.
  it("reports a future timestamp as active-now (current buggy behaviour)", () => {
    const future = new Date(NOW.getTime() + 30 * DAY).toISOString();
    expect(withPinnedClock(() => bucketFromCard(future))).toBe("now");
  });
});

describe("SitterCard activity line", () => {
  const renderAt = (lastActiveAt: string | null) => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    const result = render(<SitterCard sitter={sitter({ last_active_at: lastActiveAt as string })} />);
    vi.useRealTimers();
    return result;
  };

  it.each([
    ["now", agoIso(MINUTE), "bg-brand"],
    ["today", agoIso(3 * HOUR), "bg-brand/60"],
    ["week", agoIso(3 * DAY), "bg-ink-soft/40"],
  ])("renders the %s bucket label with its own dot colour", (bucketName, iso, dotClass) => {
    const { container } = renderAt(iso);
    expect(screen.getByText(`sitters.activity.${bucketName}`)).toBeInTheDocument();
    expect(container.querySelector(`span.${CSS.escape(dotClass)}`)).not.toBeNull();
  });

  it("omits the activity line entirely for a sitter dormant longer than a week", () => {
    renderAt(agoIso(8 * DAY));
    expect(screen.queryByText(/^sitters\.activity\./)).not.toBeInTheDocument();
  });

  it("omits the activity line for a null last_active_at", () => {
    renderAt(null);
    expect(screen.queryByText(/^sitters\.activity\./)).not.toBeInTheDocument();
  });
});

describe("SitterMini activity line", () => {
  it("renders the bucket label for a recently active sitter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    render(<SitterMini sitter={sitter({ last_active_at: agoIso(2 * MINUTE) })} />);
    vi.useRealTimers();
    expect(screen.getByText("sitters.activity.now")).toBeInTheDocument();
  });

  it("omits the activity line for a dormant sitter", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    render(<SitterMini sitter={sitter({ last_active_at: agoIso(30 * DAY) })} />);
    vi.useRealTimers();
    expect(screen.queryByText(/^sitters\.activity\./)).not.toBeInTheDocument();
  });
});

describe("hourly rate", () => {
  // BUG: the rate is interpolated as `€{sitter.rate_per_hour}` with no guard, but
  // Profile.rate_per_hour is `number | null` - an owner-only profile, or a sitter
  // who has not set a price, renders a bare "€" with nothing after it. Correct
  // behaviour would be to hide the block or show a "rate not set" string.
  it("renders a bare currency symbol for a null rate in SitterCard (current buggy behaviour)", () => {
    render(<SitterCard sitter={sitter({ rate_per_hour: null })} />);
    expect(screen.getByText("€")).toBeInTheDocument();
    expect(screen.queryByText(/€\s*\d/)).not.toBeInTheDocument();
  });

  // Same bug, duplicated in the compact card.
  it("renders a bare currency symbol for a null rate in SitterMini (current buggy behaviour)", () => {
    render(<SitterMini sitter={sitter({ rate_per_hour: null })} />);
    expect(screen.getByText("€")).toBeInTheDocument();
  });

  it("renders a zero rate as €0 rather than hiding it", () => {
    render(<SitterCard sitter={sitter({ rate_per_hour: 0 })} />);
    expect(screen.getByText("€0")).toBeInTheDocument();
  });

  it("renders a whole rate unformatted, with no decimal padding", () => {
    render(<SitterCard sitter={sitter({ rate_per_hour: 12 })} />);
    expect(screen.getByText("€12")).toBeInTheDocument();
  });
});

describe("null full name", () => {
  // Profile.full_name is typed `string`, but the generated row type is nullable and
  // a profile created without a name reaches these cards. The two components disagree
  // about that: SitterCard guards the Avatar but not the heading; SitterMini guards
  // neither and crashes.
  const NAMELESS = { full_name: null as unknown as string };

  it("falls back to the sitter placeholder for the SitterCard avatar", () => {
    const { container } = render(<SitterCard sitter={sitter(NAMELESS)} />);
    // Avatar receives t("appShell.sitterFallback"), which the identity t returns
    // verbatim, so the initials tile shows its first letter.
    expect(container.querySelector("div.rounded-full")).toHaveTextContent("A");
  });

  // BUG: the heading interpolates sitter.full_name with NO fallback, even though the
  // Avatar two lines above HAS one. A nameless sitter renders an empty <h3> - an
  // anonymous card with a price and a "View profile" link. Correct behaviour would
  // be to reuse the same t("appShell.sitterFallback") fallback in the heading.
  it("renders an empty heading in SitterCard (current buggy behaviour)", () => {
    const { container } = render(<SitterCard sitter={sitter(NAMELESS)} />);
    expect(container.querySelector("h3")).not.toBeNull();
    expect(container.querySelector("h3")?.textContent).toBe("");
  });

  // BUG: SitterMini passes sitter.full_name straight to Avatar, which calls
  // name.split(" ") unguarded, so a nameless sitter takes the whole dashboard
  // "Nearby sitters" rail down with a TypeError. Correct behaviour would be the
  // same ?? t("appShell.sitterFallback") guard SitterCard uses.
  it("throws a TypeError from SitterMini (current buggy behaviour)", () => {
    expect(() => render(<SitterMini sitter={sitter(NAMELESS)} />)).toThrow(TypeError);
  });
});

describe("services badges", () => {
  it("renders one badge per enabled service and none for the disabled ones", () => {
    render(
      <SitterCard
        sitter={sitter({ services: { walking: true, boarding: true, daycare: false, grooming: false } })}
      />,
    );
    expect(screen.getByText("common.services.walking")).toBeInTheDocument();
    expect(screen.getByText("common.services.boarding")).toBeInTheDocument();
    expect(screen.queryByText("common.services.daycare")).not.toBeInTheDocument();
    expect(screen.queryByText("common.services.grooming")).not.toBeInTheDocument();
  });

  it("omits the badge row entirely when every service is disabled", () => {
    render(
      <SitterCard
        sitter={sitter({ services: { walking: false, boarding: false, daycare: false, grooming: false } })}
      />,
    );
    expect(screen.queryAllByText(/^common\.services\./)).toHaveLength(0);
  });

  // Object.entries(sitter.services ?? {}) means a null services column degrades to an
  // empty object rather than throwing. Note the card shows NOTHING here - unlike the
  // sitter detail page, which renders sitters.profile.noServicesListed.
  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("falls back to an empty object and shows no message for %s services", (_label, value) => {
    render(<SitterCard sitter={sitter({ services: value as unknown as Profile["services"] })} />);
    expect(screen.queryAllByText(/^common\.services\./)).toHaveLength(0);
    expect(screen.queryByText(/noServicesListed/)).not.toBeInTheDocument();
  });
});

describe("experience chip", () => {
  it("omits the chip for a null experience_years", () => {
    render(<SitterCard sitter={sitter({ experience_years: null })} />);
    expect(screen.queryByText(/^sitters\.card\.experience/)).not.toBeInTheDocument();
  });

  it("uses the singular key for exactly one year", () => {
    render(<SitterCard sitter={sitter({ experience_years: 1 })} />);
    expect(screen.getByText("sitters.card.experienceSingular")).toBeInTheDocument();
  });

  // Zero is `!== 1`, so a brand-new sitter gets the plural form: "0 yrs". That reads
  // correctly in English, so it is pinned as intended behaviour rather than a bug.
  it("uses the plural key for zero years", () => {
    render(<SitterCard sitter={sitter({ experience_years: 0 })} />);
    expect(screen.getByText("sitters.card.experiencePlural")).toBeInTheDocument();
  });

  it("uses the plural key for 21 years", () => {
    render(<SitterCard sitter={sitter({ experience_years: 21 })} />);
    expect(screen.getByText("sitters.card.experiencePlural")).toBeInTheDocument();
  });

  // BUG (i18n): the singular/plural choice is `years !== 1`, which is the English rule.
  // Lithuanian needs the singular form for every number ending in 1 except 11, so 21
  // and 31 pick the wrong grammatical form. It is invisible today only because the lt
  // dictionary papers over it by giving both keys the same string - pinned here so the
  // day someone writes a real Lithuanian plural, this test fails and flags the rule.
  it("papers over the Lithuanian plural rule by giving both lt keys the same string", () => {
    expect(lookup(dictionaries.lt, "sitters.card.experienceSingular")).toBe(
      lookup(dictionaries.lt, "sitters.card.experiencePlural"),
    );
    expect(lookup(dictionaries.en, "sitters.card.experienceSingular")).not.toBe(
      lookup(dictionaries.en, "sitters.card.experiencePlural"),
    );
  });

  // Negative experience is not validated anywhere, and the chip renders it as-is.
  it("renders a negative experience with the plural key rather than rejecting it", () => {
    render(<SitterCard sitter={sitter({ experience_years: -4 })} />);
    expect(screen.getByText("sitters.card.experiencePlural")).toBeInTheDocument();
  });
});

describe("link targets", () => {
  it("defaults to the in-app browse route", () => {
    render(<SitterCard sitter={sitter({ id: "abc" })} />);
    expect(screen.getByRole("link", { name: /sitters\.card\.viewProfile/ })).toHaveAttribute(
      "href",
      "/browse/abc",
    );
  });

  it("uses the public sitters route when basePath says so", () => {
    render(<SitterCard sitter={sitter({ id: "abc" })} basePath="/sitters" />);
    expect(screen.getByRole("link", { name: /sitters\.card\.viewProfile/ })).toHaveAttribute(
      "href",
      "/sitters/abc",
    );
  });

  // SitterMini takes no basePath prop at all: its target is hardcoded to /browse,
  // which is an authenticated route. It is only ever rendered inside the app shell
  // today, but it cannot be reused on the public marketing pages without an edit.
  it("hardcodes the browse route in SitterMini, with no basePath escape hatch", () => {
    render(<SitterMini sitter={sitter({ id: "abc" })} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/browse/abc");
  });
});

describe("favourite button", () => {
  it("is absent unless showFavorite is set", () => {
    render(<SitterCard sitter={sitter()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders in the inactive state when there is no favourites provider", () => {
    render(<SitterCard sitter={sitter()} showFavorite />);
    // The default FavoritesContext returns isFavorite() === false, so the button asks
    // for the "save" label rather than the "remove" one, and the heart is unfilled.
    const button = screen.getByRole("button", { name: "appPages.favoriteButton.saveSitter" });
    expect(button).toHaveClass("bg-surface-2");
    expect(button.querySelector("svg")).not.toHaveClass("fill-rose-500");
  });

  it("stays inactive and does not throw when clicked without a provider", async () => {
    const user = userEvent.setup();
    render(<SitterCard sitter={sitter()} showFavorite />);
    const button = screen.getByRole("button");
    await user.click(button);
    // The default context's toggle is a no-op, so the label must not flip.
    expect(
      screen.getByRole("button", { name: "appPages.favoriteButton.saveSitter" }),
    ).toBeInTheDocument();
  });
});

describe("overflow guards", () => {
  const LONG_NAME = "Konstantinas Aleksandras Bartkevicius-Petrauskas the Third";
  const LONG_CITY = "Vilniaus miesto savivaldybes seniunija, Naujamiescio rajonas";
  const LONG_ABOUT = "I love animals. ".repeat(60);

  it("truncates the SitterCard heading rather than wrapping a long name", () => {
    const { container } = render(<SitterCard sitter={sitter({ full_name: LONG_NAME })} />);
    const heading = container.querySelector("h3");
    expect(heading).toHaveTextContent(LONG_NAME);
    expect(heading).toHaveClass("truncate");
  });

  it("truncates the city, and does so on the inner span that holds the text", () => {
    const { container } = render(<SitterCard sitter={sitter({ city: LONG_CITY })} />);
    const city = screen.getByText(LONG_CITY);
    expect(city).toHaveClass("truncate");
    // The truncate only works because the flex parent is min-w-0.
    expect(container.querySelector("div.flex-1")).toHaveClass("min-w-0");
  });

  it("clamps a long about-me to two lines", () => {
    render(<SitterCard sitter={sitter({ about_me: LONG_ABOUT }) } />);
    expect(screen.getByText(LONG_ABOUT.trim())).toHaveClass("line-clamp-2");
  });

  it("omits the about-me paragraph entirely when it is null or empty", () => {
    const { container: withNull } = render(<SitterCard sitter={sitter({ about_me: null })} />);
    expect(withNull.querySelector("p")).toBeNull();
    const { container: withEmpty } = render(<SitterCard sitter={sitter({ about_me: "" })} />);
    expect(withEmpty.querySelector("p")).toBeNull();
  });

  it("truncates the SitterMini name and city", () => {
    render(<SitterMini sitter={sitter({ full_name: LONG_NAME, city: LONG_CITY })} />);
    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });
});

describe("rate suffix keys", () => {
  // The two cards ask for DIFFERENT keys for the same concept, and the two keys carry
  // different copy ("/ hour" vs "/ hr"). Renaming or deleting either one silently
  // regresses one card, so both are pinned here.
  it("uses sitters.card.rateSuffix in SitterCard and appShell.sitterMini.rateSuffix in SitterMini", () => {
    render(<SitterCard sitter={sitter()} />);
    expect(screen.getByText("sitters.card.rateSuffix")).toBeInTheDocument();
    expect(screen.queryByText("appShell.sitterMini.rateSuffix")).not.toBeInTheDocument();

    render(<SitterMini sitter={sitter()} />);
    expect(screen.getByText("appShell.sitterMini.rateSuffix")).toBeInTheDocument();
  });

  it("resolves both keys in both dictionaries, to different English copy", () => {
    for (const locale of ["en", "lt"] as const) {
      expect(typeof lookup(dictionaries[locale], "sitters.card.rateSuffix")).toBe("string");
      expect(typeof lookup(dictionaries[locale], "appShell.sitterMini.rateSuffix")).toBe("string");
    }
    expect(lookup(dictionaries.en, "sitters.card.rateSuffix")).not.toBe(
      lookup(dictionaries.en, "appShell.sitterMini.rateSuffix"),
    );
  });
});

describe("SitterCard rating", () => {
  it("shows the stars, average and count for a rated sitter", () => {
    const { container } = render(
      <SitterCard sitter={sitter()} rating={{ average: 4.8, count: 12 }} />,
    );
    expect(container.querySelectorAll("[data-star]")).toHaveLength(5);
    expect(screen.getByText("4.8")).toBeInTheDocument();
    expect(screen.getByText("sitters.reviews.count.other")).toBeInTheDocument();
  });

  // Every sitter is unrated on day one. A "no reviews yet" line repeated down a
  // listing of 25 cards reads as a dead marketplace, so the card shows nothing at
  // all and only the profile says it out loud.
  it("shows no rating line at all for a sitter nobody has reviewed", () => {
    const { container } = render(
      <SitterCard sitter={sitter()} rating={{ average: null, count: 0 }} />,
    );
    expect(container.querySelectorAll("[data-star]")).toHaveLength(0);
    expect(screen.queryByText(/^sitters\.reviews\./)).not.toBeInTheDocument();
  });

  it("shows no rating line before the ratings query has come back", () => {
    // The listings render their cards first and fill ratings in afterwards, so the
    // prop is absent for a beat on every page load.
    const { container } = render(<SitterCard sitter={sitter()} />);
    expect(container.querySelectorAll("[data-star]")).toHaveLength(0);
  });
});
