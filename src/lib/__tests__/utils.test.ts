import { describe, it, expect, vi, afterEach } from "vitest";
import { cn, formatDate, formatCurrency, formatTime, timeAgo, normaliseCity } from "@/lib/utils";

// The suite pins TZ to Europe/Vilnius (see vitest.config.mts). Every assertion
// below assumes it, because these helpers all render user-facing wall-clock
// values for Lithuanian users.

afterEach(() => {
  vi.useRealTimers();
});

describe("cn", () => {
  it("returns an empty string when given nothing", () => {
    expect(cn()).toBe("");
  });

  it("drops falsy inputs", () => {
    expect(cn(undefined, null, false, 0, "")).toBe("");
  });

  it("keeps a later conflicting tailwind utility and drops the earlier one", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("resolves conflicts between arbitrary-value classes, which this app uses heavily", () => {
    // e.g. the sidebar rail width in src/app/(app)/layout.tsx
    expect(cn("w-[40rem]", "w-[34rem]")).toBe("w-[34rem]");
  });

  it("resolves conflicts between CSS-variable shadow classes", () => {
    // The whole design system expresses elevation this way.
    expect(cn("shadow-[var(--shadow-sm)]", "shadow-[var(--shadow-md)]")).toBe(
      "shadow-[var(--shadow-md)]",
    );
  });

  it("flattens nested arrays", () => {
    expect(cn(["a", ["b", ["c"]]])).toBe("a b c");
  });

  it("keeps object keys whose value is truthy", () => {
    expect(cn({ a: true, b: false, c: 1 })).toBe("a c");
  });

  it("collapses whitespace-only input to an empty string", () => {
    expect(cn("   ")).toBe("");
  });

  it("tolerates the real call-site shape of a trailing undefined className", () => {
    // Avatar, Badge and FavoriteButton all end with an optional className prop.
    expect(cn("w-9 h-9", undefined)).toBe("w-9 h-9");
  });
});

describe("formatDate", () => {
  it("formats an instant in Vilnius local time for en-GB", () => {
    expect(formatDate("2026-09-01T12:00:00Z")).toBe("1 Sept 2026");
  });

  it("formats the same instant in the Lithuanian ISO-like short form", () => {
    expect(formatDate("2026-09-01T12:00:00Z", "lt")).toBe("2026-09-01");
  });

  it("parses a date-only string as UTC midnight, which Vilnius renders as the same day", () => {
    // Vilnius is UTC+3 in September, so UTC midnight is 03:00 local and the
    // calendar day survives. In a negative-offset zone it would slip a day.
    expect(formatDate("2026-09-01")).toBe("1 Sept 2026");
  });

  it("rolls a non-existent 29 February into 1 March", () => {
    expect(formatDate("2027-02-29")).toBe("1 Mar 2027");
  });

  it("renders a real leap day", () => {
    expect(formatDate("2028-02-29T12:00:00Z")).toBe("29 Feb 2028");
  });

  it("accepts a Date object as well as a string", () => {
    expect(formatDate(new Date("2026-09-01T12:00:00Z"))).toBe("1 Sept 2026");
  });

  it("treats null as the epoch rather than as invalid", () => {
    // new Date(null) is 0, not Invalid Date - an asymmetry with undefined below.
    expect(formatDate(null as unknown as string)).toBe("1 Jan 1970");
  });

  it("renders the correct local day either side of the March DST jump", () => {
    // 2026-03-29: Vilnius goes 03:00 -> 04:00 (UTC+2 -> UTC+3).
    expect(formatDate("2026-03-29T00:30:00Z")).toBe("29 Mar 2026");
    expect(formatDate("2026-03-29T22:30:00Z")).toBe("30 Mar 2026");
  });

  it("renders the correct local day either side of the October DST fallback", () => {
    // 2026-10-25: Vilnius goes 04:00 -> 03:00 (UTC+3 -> UTC+2).
    expect(formatDate("2026-10-24T21:30:00Z")).toBe("25 Oct 2026");
    expect(formatDate("2026-10-25T22:30:00Z")).toBe("26 Oct 2026");
  });

  it("renders the last millisecond of a local day as that day", () => {
    expect(formatDate("2026-09-01T20:59:59.999Z")).toBe("1 Sept 2026");
  });

  // BUG: formatDate has no Invalid-Date guard, unlike formatMoment in the
  // booking-notify Edge Function which does check Number.isNaN(getTime()).
  // Correct behaviour would be to return "" (or null) for an unparseable value.
  // As written, a corrupt start_at from the database throws and takes down the
  // whole component tree - there is no error boundary anywhere in the app.
  // Reachable from BookingCard, RightRail, MessageThread.dayLabel and the
  // dashboard's relativeDate.
  it.each([
    ["an empty string", ""],
    ["a garbage string", "not-a-date"],
    ["an out-of-range date", "2026-13-45"],
  ])("throws RangeError for %s (current buggy behaviour)", (_label, input) => {
    expect(() => formatDate(input)).toThrow(RangeError);
  });

  it("throws for undefined, unlike null which yields the epoch", () => {
    expect(() => formatDate(undefined as unknown as string)).toThrow(RangeError);
  });

  it("throws for an already-invalid Date object", () => {
    expect(() => formatDate(new Date("nope"))).toThrow(RangeError);
  });

  // BUG: the locale map has no fallback, so an unknown key yields undefined and
  // Intl silently uses the SYSTEM locale rather than the intended en-GB default.
  it("falls back to the system locale for an unknown locale key, not to en-GB", () => {
    const unknown = formatDate(
      "2026-09-01T12:00:00Z",
      "de" as unknown as "en",
    );
    const system = new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date("2026-09-01T12:00:00Z"));
    expect(unknown).toBe(system);
  });
});

describe("formatTime", () => {
  it("shifts a UTC instant into Vilnius wall clock", () => {
    expect(formatTime("2026-09-01T12:00:00Z")).toBe("15:00");
  });

  it("renders UTC midnight as 03:00 local with a leading zero", () => {
    expect(formatTime("2026-09-01T00:00:00Z")).toBe("03:00");
  });

  it("uses a 24-hour clock in both locales", () => {
    expect(formatTime("2026-09-01T20:00:00Z")).toBe("23:00");
    expect(formatTime("2026-09-01T20:00:00Z", "lt")).toBe("23:00");
  });

  it("truncates seconds rather than rounding them up", () => {
    // 14:05:59 local must stay 14:05, not become 14:06.
    expect(formatTime("2026-09-01T11:05:59Z")).toBe("14:05");
  });

  // Same missing guard as formatDate. MessageThread renders this for every
  // message bubble, so one corrupt created_at blanks the entire thread.
  it("throws RangeError for an invalid input (current buggy behaviour)", () => {
    expect(() => formatTime("")).toThrow(RangeError);
  });
});

describe("formatCurrency", () => {
  // NOTE: this function is dead code. Nothing in src/ calls it - every rate in
  // the UI is hand-rolled as a template literal, e.g. `€${sitter.rate_per_hour}`
  // in SitterCard, SitterMini, browse/[id], sitters/[id] and bookings/new.
  // These tests document what the app WOULD get if the call sites were fixed.

  // BUG: minimumFractionDigits is 0, so money renders with a ragged number of
  // decimals. A €12.50 rate shows as "€12.5". Correct for currency would be to
  // leave minimumFractionDigits at its default of 2.
  it("renders a half-euro amount with a single decimal instead of two", () => {
    expect(formatCurrency(10.5)).toBe("€10.5");
  });

  it("rounds a sub-cent fraction up to a whole euro", () => {
    expect(formatCurrency(10.999)).toBe("€11");
  });

  it("renders zero with no decimals", () => {
    expect(formatCurrency(0)).toBe("€0");
  });

  it("puts the minus sign before the currency symbol in en-GB", () => {
    expect(formatCurrency(-5)).toBe("-€5");
  });

  it("absorbs classic float drift", () => {
    expect(formatCurrency(0.1 + 0.2)).toBe("€0.3");
  });

  // Unlike formatDate, this does NOT throw on bad input - it renders the
  // garbage straight into the UI. Worth pinning: the two helpers in the same
  // file disagree about how to handle invalid input.
  it("renders NaN as text rather than throwing", () => {
    expect(formatCurrency(NaN)).toBe("€NaN");
  });

  it("renders Infinity as an infinity sign rather than throwing", () => {
    expect(formatCurrency(Infinity)).toBe("€∞");
  });

  it("groups thousands with a comma in en-GB", () => {
    expect(formatCurrency(1234)).toBe("€1,234");
  });

  it("moves the symbol after the amount and uses a comma decimal in lt-LT", () => {
    // The space before the symbol is a non-breaking space (U+00A0), so a
    // literal comparison with a plain space fails invisibly.
    expect(formatCurrency(10.5, "lt").replace(/[  ]/g, " ")).toBe(
      "10,5 €",
    );
  });

  it("groups lt-LT thousands with a non-breaking space, not a plain space", () => {
    const out = formatCurrency(1234, "lt");
    // Guards against an assertion written with a normal space, which would be
    // an invisible false negative.
    expect(out).not.toBe("1 234 €");
    expect(out.replace(/[  ]/g, " ")).toBe("1 234 €");
  });
});

describe("timeAgo", () => {
  // t is injected, so a spy records exactly which key and vars were requested.
  const spyT = () => vi.fn((key: string, vars?: Record<string, string | number>) =>
    vars ? `${key}:${JSON.stringify(vars)}` : key,
  );

  const at = (systemTime: string, iso: string, prefix?: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(systemTime));
    const t = spyT();
    const out = prefix === undefined ? timeAgo(iso, t) : timeAgo(iso, t, prefix);
    return { out, t };
  };

  it("says just now below one minute", () => {
    const { out } = at("2026-09-01T12:00:59Z", "2026-09-01T12:00:00Z");
    expect(out).toBe("common.timeAgo.justNow");
  });

  it("switches to minutes at exactly 60 seconds", () => {
    const { out } = at("2026-09-01T12:01:00Z", "2026-09-01T12:00:00Z");
    expect(out).toBe('common.timeAgo.minutesAgo:{"minutes":1}');
  });

  it("stays in minutes at 59 minutes", () => {
    const { out } = at("2026-09-01T12:59:59Z", "2026-09-01T12:00:00Z");
    expect(out).toBe('common.timeAgo.minutesAgo:{"minutes":59}');
  });

  it("switches to hours at exactly 3600 seconds", () => {
    const { out } = at("2026-09-01T13:00:00Z", "2026-09-01T12:00:00Z");
    expect(out).toBe('common.timeAgo.hoursAgo:{"hours":1}');
  });

  it("stays in hours at 23 hours", () => {
    const { out } = at("2026-09-02T11:59:59Z", "2026-09-01T12:00:00Z");
    expect(out).toBe('common.timeAgo.hoursAgo:{"hours":23}');
  });

  it("switches to days at exactly 86400 seconds", () => {
    const { out } = at("2026-09-02T12:00:00Z", "2026-09-01T12:00:00Z");
    expect(out).toBe('common.timeAgo.daysAgo:{"days":1}');
  });

  it("clamps a future timestamp to just now instead of going negative", () => {
    // Deliberate: Math.max(0, ...) absorbs client/server clock skew.
    const { out } = at("2026-09-01T12:00:00Z", "2026-09-01T13:00:00Z");
    expect(out).toBe("common.timeAgo.justNow");
  });

  it("uses the collar key namespace when given that prefix", () => {
    const { out } = at("2026-09-01T12:30:00Z", "2026-09-01T12:00:00Z", "appPages.collars");
    expect(out).toBe('appPages.collars.minutesAgo:{"minutes":30}');
  });

  it("produces a leading-dot key when the prefix is empty", () => {
    const { out } = at("2026-09-01T12:00:30Z", "2026-09-01T12:00:00Z", "");
    expect(out).toBe(".justNow");
  });

  // BUG: there is no NaN guard. An unparseable timestamp makes `seconds` NaN,
  // every comparison against NaN is false, so control falls all the way through
  // to the days branch and the user is shown a literal "NaNd ago" (EN) or
  // "prieš NaN d." (LT). Reachable from NotificationBell, the messages list and
  // CollarsPanel, all of which pass a raw database column.
  // Correct behaviour: guard with Number.isNaN and return the justNow key, or
  // return an empty string. Note getActivityBucket in SitterCard/SitterMini
  // DOES have exactly this guard - the two helpers disagree.
  it.each([
    ["an empty string", ""],
    ["a garbage string", "garbage"],
  ])("falls through to a NaN day count for %s (current buggy behaviour)", (_label, iso) => {
    const { out } = at("2026-09-01T12:00:00Z", iso);
    expect(out).toBe('common.timeAgo.daysAgo:{"days":null}');
  });

  it("asks for a translation key rather than returning English text", () => {
    // Pins that the helper never hardcodes copy - all output goes through t.
    const { t } = at("2026-09-01T12:30:00Z", "2026-09-01T12:00:00Z");
    expect(t).toHaveBeenCalledTimes(1);
    expect(t.mock.calls[0][0]).toBe("common.timeAgo.minutesAgo");
  });
});

describe("normaliseCity", () => {
  /**
   * City is a free-text field on the profile form, so whatever someone types is what
   * the database gets. Production ended up holding "kaunas" alongside "Kaunas", and
   * "Mažeikiai " with a trailing space alongside what should have been the same city —
   * three entries for two places. The city filter and the city list both treat them as
   * distinct, and the profile page renders the raw value, so one sitter's page read
   * "kaunas".
   */
  it("capitalises a city typed in lower case", () => {
    expect(normaliseCity("kaunas")).toBe("Kaunas");
  });

  it("strips the trailing space that made a second Mažeikiai", () => {
    expect(normaliseCity("Mažeikiai ")).toBe("Mažeikiai");
  });

  it("leaves an already-correct name untouched", () => {
    expect(normaliseCity("Vilnius")).toBe("Vilnius");
  });

  it.each(["Klaipėda", "Šiauliai", "Panevėžys", "Mažeikiai"])(
    "preserves the Lithuanian letters in %s",
    (city) => {
      expect(normaliseCity(city.toLowerCase())).toBe(city);
    },
  );

  it("lowercases the tail of a shouted city name", () => {
    expect(normaliseCity("VILNIUS")).toBe("Vilnius");
  });

  it("capitalises every word of a two-word city", () => {
    expect(normaliseCity("naujoji akmenė")).toBe("Naujoji Akmenė");
  });

  it("collapses runs of internal whitespace", () => {
    expect(normaliseCity("Naujoji   Akmenė")).toBe("Naujoji Akmenė");
  });

  it.each([["", "empty"], ["   ", "only spaces"], ["\t\n", "only whitespace"]])(
    "treats %s (%s) as no city rather than as a city named nothing",
    (input) => {
      // The column is nullable, and "" would sort and group as its own city.
      expect(normaliseCity(input)).toBeNull();
    },
  );
});
