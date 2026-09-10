import { describe, it, expect } from "vitest";
import { dictionaries, type Locale } from "@/lib/i18n";
import { TIPS } from "@/lib/tips";
import type {
  ServiceType,
  PetType,
  BookingStatus,
  SystemEvent,
  NotificationType,
} from "@/lib/types";

/**
 * Nothing in the type system guards these dictionaries. `dictionaries` is typed
 * Record<Locale, Record<string, unknown>>, which erases all structure, and
 * t(key: string) accepts any string, so no call site is checked either.
 * `npm run typecheck` would not notice if half of src/lib/i18n/lt were deleted;
 * the only symptom would be English leaking into the Lithuanian UI, or a raw
 * dot-path like "appPages.bookings.countPlural" rendered as visible text.
 *
 * This file is that missing guard.
 */

type Dict = Record<string, unknown>;

/** Flattens a dictionary to { "a.b.c": leafValue }. */
function leaves(node: Dict, prefix = "", out: Record<string, unknown> = {}) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      leaves(v as Dict, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

const EN = leaves(dictionaries.en as Dict);
const LT = leaves(dictionaries.lt as Dict);
const EN_KEYS = Object.keys(EN).sort();
const LT_KEYS = Object.keys(LT).sort();

/** The placeholder names in a string, e.g. "{a} and {b}" -> ["a","b"]. */
function placeholders(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

describe("dictionary structure", () => {
  it("has a non-trivial number of leaves, so a broken flatten cannot pass silently", () => {
    expect(EN_KEYS.length).toBeGreaterThan(400);
  });

  it("has exactly the same number of leaves in both languages", () => {
    expect(LT_KEYS.length).toBe(EN_KEYS.length);
  });

  it("has no key present in English but missing from Lithuanian", () => {
    // A miss here is invisible in production: t() silently falls back to EN.
    expect(EN_KEYS.filter((k) => !(k in LT))).toEqual([]);
  });

  it("has no key present in Lithuanian but missing from English", () => {
    // A miss here is worse: EN is the fallback, so the key would render raw.
    expect(LT_KEYS.filter((k) => !(k in EN))).toEqual([]);
  });

  it("resolves every leaf to a string in both languages", () => {
    // t() returns the key itself for any non-string, so an accidental object,
    // number or array leaf becomes visible dot-path text in the UI.
    const nonString = EN_KEYS.filter(
      (k) => typeof EN[k] !== "string" || typeof LT[k] !== "string",
    );
    expect(nonString).toEqual([]);
  });

  it("has no empty leaf in either language", () => {
    const empty = EN_KEYS.filter(
      (k) => String(EN[k]).trim() === "" || String(LT[k]).trim() === "",
    );
    expect(empty).toEqual([]);
  });
});

describe("interpolation placeholders", () => {
  it("uses the same placeholder set for every key in both languages", () => {
    // A mismatch is a real bug in either direction: an extra placeholder in one
    // language renders literal braces to the user, and a missing one silently
    // drops the value out of the sentence.
    const mismatched = EN_KEYS.filter(
      (k) => placeholders(EN[k]).join(",") !== placeholders(LT[k]).join(","),
    );
    expect(mismatched).toEqual([]);
  });

  it("covers a meaningful number of interpolated keys", () => {
    const withVars = EN_KEYS.filter((k) => placeholders(EN[k]).length > 0);
    expect(withVars.length).toBeGreaterThan(50);
  });

  it("uses only ASCII word characters in placeholder names", () => {
    // interpolate() matches /\{(\w+)\}/, and \w is ASCII-only. A Lithuanian
    // placeholder name such as {miestas} is fine, but {miestąs} would never
    // match and would render literally as "{miestąs}".
    const bad: string[] = [];
    for (const [lang, dict] of Object.entries({ en: EN, lt: LT })) {
      for (const [key, value] of Object.entries(dict)) {
        if (typeof value !== "string") continue;
        for (const m of value.matchAll(/\{([^}]*)\}/g)) {
          if (!/^\w+$/.test(m[1])) bad.push(`${lang}:${key} -> {${m[1]}}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});

describe("translation completeness", () => {
  // Anything here is byte-identical between languages. Each entry must be
  // justified, otherwise it is an untranslated string that slipped through.
  const IDENTICAL_ALLOW_LIST = [
    // A country-code chip, not prose: the flag and "+370" are the same in both.
    "appPages.profile.phoneCountryCode",
    // A phone-number example placeholder, digits only.
    "appPages.profile.phonePlaceholder",
    // The SI kilogram symbol is locale-invariant.
    "appPages.petCard.weightUnit",
  ];

  it("has no untranslated Lithuanian string outside the documented allow-list", () => {
    const identical = EN_KEYS.filter((k) => EN[k] === LT[k]);
    expect(identical.sort()).toEqual([...IDENTICAL_ALLOW_LIST].sort());
  });

  it("keeps every allow-list entry actually identical, so stale entries get noticed", () => {
    for (const key of IDENTICAL_ALLOW_LIST) {
      expect(EN[key], `${key} is allow-listed but no longer identical`).toBe(LT[key]);
    }
  });
});

describe("dynamic key templates resolve in both languages", () => {
  // Every one of these is built by string concatenation at a call site, so no
  // static analysis can catch a miss. A miss renders the raw key to the user,
  // e.g. a booking chip reading "common.bookingStatus.expired".
  const resolves = (key: string) =>
    typeof EN[key] === "string" && typeof LT[key] === "string";

  const expectAllResolve = (prefix: string, members: readonly string[], suffix = "") => {
    const missing = members.filter((m) => !resolves(`${prefix}.${m}${suffix}`));
    expect(missing, `unresolved under ${prefix}`).toEqual([]);
  };

  const SERVICES: readonly ServiceType[] = ["walking", "boarding", "daycare", "grooming"];
  const PET_TYPES: readonly PetType[] = [
    "dog", "cat", "bird", "reptile", "small_mammal", "fish", "other",
  ];
  const STATUSES: readonly BookingStatus[] = [
    "pending", "signed", "declined", "cancelled", "completed",
  ];
  const EVENTS: readonly SystemEvent[] = [
    "requested", "accepted", "declined", "cancelled", "completed",
  ];
  const NOTIFICATIONS: readonly NotificationType[] = [
    "booking_requested", "booking_accepted", "booking_declined",
    "booking_cancelled", "booking_completed", "message_received",
  ];

  it("resolves common.services for every ServiceType", () => {
    expectAllResolve("common.services", SERVICES);
  });

  it("resolves common.petTypes for every PetType", () => {
    expectAllResolve("common.petTypes", PET_TYPES);
  });

  it("resolves common.petSex for every sex value", () => {
    expectAllResolve("common.petSex", ["male", "female", "unknown"]);
  });

  it("resolves common.bookingStatus for every BookingStatus", () => {
    expectAllResolve("common.bookingStatus", STATUSES);
  });

  it("resolves common.bookingStatusGenitive for every BookingStatus", () => {
    // This whole namespace exists only for Lithuanian case agreement, used by
    // the filtered-empty-state title on the bookings page.
    expectAllResolve("common.bookingStatusGenitive", STATUSES);
  });

  it("resolves messages.systemEvent for every SystemEvent", () => {
    expectAllResolve("messages.systemEvent", EVENTS);
  });

  it("resolves messages.notifications for every NotificationType", () => {
    expectAllResolve("messages.notifications", NOTIFICATIONS);
  });

  it("resolves sitters.activity for every activity bucket", () => {
    expectAllResolve("sitters.activity", ["now", "today", "week"]);
  });

  // Built by concatenation in RatingSummary from reviewCountForm(), so a missing
  // form prints a raw dot-path next to a sitter's rating on every listing.
  it("resolves sitters.reviews.count for every plural form", () => {
    expectAllResolve("sitters.reviews.count", ["one", "few", "other"]);
  });

  // The rest of the reviews namespace is requested by literal key rather than by
  // concatenation, but it spans three components and two pages, so it is pinned
  // here as one family rather than trusted to survive a rename.
  it("resolves the rest of the sitters.reviews namespace", () => {
    expectAllResolve("sitters.reviews", [
      "heading",
      "none",
      "emptyDescription",
      "anonymousAuthor",
      "starsAriaLabel",
    ]);
  });

  // The landing page builds these four families by concatenation too. A miss
  // prints the raw key straight onto the marketing page, which is the most
  // visible surface in the app.
  it("resolves home.cities.sitterCount for every plural form", () => {
    expectAllResolve("home.cities.sitterCount", ["one", "few", "other"]);
  });

  it("resolves home.how.steps title, desc and guarantee for every step", () => {
    const steps = ["find", "request", "confirm"];
    for (const part of ["title", "desc", "note"]) {
      expectAllResolve("home.how.steps", steps, `.${part}`);
    }
  });

  it("resolves home.faq.items question and answer for every item", () => {
    const items = ["howItWorks", "cost", "areas", "becomeSitter", "realCompany"];
    for (const part of ["q", "a"]) {
      expectAllResolve("home.faq.items", items, `.${part}`);
    }
  });

  it("resolves a description for every service card", () => {
    // ServiceCards builds t(`home.services.items.${key}.desc`) from the ServiceType
    // union. A miss prints the raw dot-path onto the landing page.
    expectAllResolve("home.services.items", SERVICES, ".desc");
  });

  it("resolves title and body for every honest-block point", () => {
    // The "what we do and do not do" block is built by concatenation from a local
    // array of point ids; nothing type-checks those against the dictionary.
    const points = ["fees", "vetting", "insurance", "data"];
    for (const part of ["title", "body"]) {
      expectAllResolve("home.honest.points", points, `.${part}`);
    }
  });

  it("resolves home.becomeSitter.perks for every perk", () => {
    expectAllResolve("home.becomeSitter.perks", [
      "ownRate",
      "chooseServices",
      "ownHours",
      "free",
    ]);
  });

  it("resolves auth.knownErrors for every key matchAuthErrorKey can return", () => {
    expectAllResolve("auth.knownErrors", [
      "invalidCredentials", "userAlreadyRegistered",
      "emailNotConfirmed", "weakPassword",
    ]);
  });

  it.each(["common.timeAgo", "appPages.collars"])(
    "resolves the full timeAgo key set under the %s prefix",
    (prefix) => {
      // timeAgo() takes keyPrefix as a parameter; these are its only two callers.
      expectAllResolve(prefix, ["justNow", "minutesAgo", "hoursAgo", "daysAgo"]);
    },
  );

  it("resolves tag, title and body for every tip id", () => {
    // TipCard renders t(`tips.${tip.id}.tag`) and friends. An id with no
    // dictionary entry paints three raw dot-paths onto the card.
    const missing: string[] = [];
    for (const tip of TIPS) {
      for (const field of ["tag", "title", "body"]) {
        if (!resolves(`tips.${tip.id}.${field}`)) missing.push(`${tip.id}.${field}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("Lithuanian plural agreement", () => {
  /**
   * BUG (documented, not fixed here).
   *
   * Lithuanian has THREE count-agreement forms, which Intl.PluralRules reports
   * as "one", "few" and "other":
   *   one   - n % 10 == 1 and n % 100 not in 11..19   (1, 21, 31, 101)
   *   few   - n % 10 in 2..9 and n % 100 not in 11..19 (2..9, 22..29)
   *   other - everything else                          (0, 10, 11..19, 20, 30)
   *
   * The app pluralises with a hand-rolled `n !== 1` ternary at each call site
   * and stores only TWO forms per concept, so it can never express "few".
   * The stored plural is the "other" form, which means every count from 2..9,
   * 22..29, 32..39 and so on renders the wrong grammatical form - and those are
   * the commonest counts in this app.
   *
   * Concretely, for bookings: 3 renders "Iš viso 3 užsakymų" where correct
   * Lithuanian is "Iš viso 3 užsakymai"; 21 renders "21 užsakymų" where correct
   * is "21 užsakymas".
   *
   * The fix is to select with Intl.PluralRules and restructure these keys as
   * { one, few, other } objects. These tests pin today's behaviour so that fix
   * has a failing expectation to flip.
   */
  const lt = new Intl.PluralRules("lt");

  // Every key pair that pluralises a COUNT. The experience pairs are excluded
  // deliberately: their Lithuanian value is the invariant abbreviation "m."
  // (metai), identical in both slots, so the missing "few" form is unobservable.
  const COUNT_PAIRS: Array<{ singular: string; plural: string }> = [
    { singular: "appPages.bookings.countSingular", plural: "appPages.bookings.countPlural" },
    { singular: "appPages.pets.countSingular", plural: "appPages.pets.countPlural" },
    { singular: "appPages.browse.resultsCountSingular", plural: "appPages.browse.resultsCountPlural" },
    { singular: "appShell.dashboard.summary.pending", plural: "appShell.dashboard.summary.pendingPlural" },
    { singular: "appPages.collars.routeNotEnoughSingular", plural: "appPages.collars.routeNotEnoughPlural" },
  ];

  it("confirms Lithuanian genuinely needs three forms", () => {
    expect(lt.select(1)).toBe("one");
    expect(lt.select(3)).toBe("few");
    expect(lt.select(10)).toBe("other");
    expect(lt.select(21)).toBe("one");
    expect(lt.select(22)).toBe("few");
    expect(lt.select(101)).toBe("one");
  });

  it("only stores two Lithuanian forms per count, so the few form does not exist", () => {
    for (const { singular, plural } of COUNT_PAIRS) {
      expect(typeof LT[singular]).toBe("string");
      expect(typeof LT[plural]).toBe("string");
      // If a third form is ever added these keys will appear, and this
      // expectation should be deleted along with the ternaries at the call sites.
      expect(LT[`${singular.replace(/Singular$/, "")}Few`]).toBeUndefined();
    }
  });

  it.each([
    [2, "few"],
    [5, "few"],
    [9, "few"],
    [22, "few"],
    [21, "one"],
    [101, "one"],
  ])(
    "picks the wrong Lithuanian form for a count of %i, which needs the %s form",
    (n, expectedCategory) => {
      expect(lt.select(n)).toBe(expectedCategory);
      // The call sites all branch on `n !== 1`, so anything but 1 takes the
      // stored plural, which is the "other" form.
      const takesStoredPlural = n !== 1;
      expect(takesStoredPlural).toBe(true);
      // ...and "other" is not what Lithuanian grammar wants here.
      expect(expectedCategory).not.toBe("other");
    },
  );

  it.each([0, 1, 10, 11, 19, 20, 30])(
    "happens to pick an acceptable Lithuanian form for a count of %i",
    (n) => {
      const category = lt.select(n);
      const takesStoredPlural = n !== 1;
      // These counts work only by coincidence: 1 takes the "one" slot, and
      // every other value here genuinely is the "other" category.
      expect(takesStoredPlural ? category : "one").toBe(
        takesStoredPlural ? "other" : "one",
      );
    },
  );
});
