import { describe, it, expect } from "vitest";
import { TIPS } from "@/lib/tips";
import { HERO, SECTION, AUTH } from "@/lib/images";
import { fadeUp, fadeIn, stagger, slideLeft, slideRight } from "@/lib/motion";
import {
  SERVICE_LABELS,
  PET_TYPE_LABELS,
  STATUS_CONFIG,
  type ServiceType,
  type PetType,
  type BookingStatus,
} from "@/lib/types";
import { dictionaries } from "@/lib/i18n";

// Cheap structural invariants over the app's static data. None of these are
// enforced by the type system, and every one of them, if broken, shows up as
// visibly wrong UI rather than as a build error.

type Dict = Record<string, unknown>;

function resolve(dict: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (node, part) =>
      node && typeof node === "object" ? (node as Dict)[part] : undefined,
    dict,
  );
}

const resolvesInBoth = (key: string) =>
  typeof resolve(dictionaries.en as Dict, key) === "string" &&
  typeof resolve(dictionaries.lt as Dict, key) === "string";

describe("TIPS", () => {
  it("has ten entries", () => {
    expect(TIPS).toHaveLength(10);
  });

  it("has unique ids, which are used both as React keys and as stored seen-ids", () => {
    const ids = TIPS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no id containing a dot, which would break the i18n dot-path lookup", () => {
    // TipCard builds `tips.${id}.title`; a dot in the id would silently
    // resolve to the wrong node.
    expect(TIPS.filter((t) => t.id.includes("."))).toEqual([]);
  });

  it("resolves tag, title and body for every id in both languages", () => {
    const missing: string[] = [];
    for (const tip of TIPS) {
      for (const field of ["tag", "title", "body"] as const) {
        if (!resolvesInBoth(`tips.${tip.id}.${field}`)) {
          missing.push(`${tip.id}.${field}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("keeps each hardcoded English tag identical to its English dictionary tag", () => {
    // TipWidget's personalisation matches tip.tag against the hardcoded
    // English strings in SERVICE_TAG/PET_TAG. If the dictionary tag is ever
    // reworded independently, personalisation silently stops matching and
    // every user gets the default order, with no error anywhere.
    const drifted = TIPS.filter(
      (tip) => resolve(dictionaries.en as Dict, `tips.${tip.id}.tag`) !== tip.tag,
    ).map((t) => t.id);
    expect(drifted).toEqual([]);
  });

  it("requests a consistent thumbnail size for every tip image", () => {
    for (const tip of TIPS) {
      expect(tip.image).toContain("w=500");
      expect(tip.image).toContain("h=300");
    }
  });

  it("serves every tip image from the Unsplash CDN over https", () => {
    for (const tip of TIPS) {
      expect(tip.image.startsWith("https://images.unsplash.com/")).toBe(true);
    }
  });
});

describe("image constants", () => {
  const allUrls = [
    ...Object.values(HERO),
    ...Object.values(SECTION),
    ...Object.values(AUTH),
  ];

  it("exposes eight curated URLs", () => {
    // Eight since HERO.wide was added: the landscape crop the hero renders
    // full-bleed, replacing the pinboard that upscaled 128px sitter avatars.
    expect(allUrls).toHaveLength(8);
  });

  it("requests the full-bleed hero photograph large enough not to upscale", () => {
    // The defect this replaced was a 128px source stretched across 460px. Pin the
    // requested width so a future crop cannot quietly reintroduce it.
    const width = Number(new URL(HERO.wide).searchParams.get("w"));
    expect(width).toBeGreaterThanOrEqual(1200);
  });

  it("serves every URL from the Unsplash CDN over https", () => {
    for (const url of allUrls) {
      expect(url.startsWith("https://images.unsplash.com/")).toBe(true);
    }
  });

  it("requests explicit dimensions and format on every URL", () => {
    // Omitting these would ship full-resolution originals to the landing page.
    for (const url of allUrls) {
      expect(url).toMatch(/[?&]w=\d+/);
      expect(url).toMatch(/[?&]h=\d+/);
      expect(url).toContain("auto=format");
      expect(url).toContain("fit=crop");
      expect(url).toContain("q=80");
    }
  });
});

describe("motion variants", () => {
  it("starts fadeUp fully transparent and offset downward", () => {
    expect(fadeUp.hidden).toMatchObject({ opacity: 0, y: 20 });
  });

  it("uses a four-member finite cubic-bezier, which framer rejects if malformed", () => {
    const show = fadeUp.show as unknown as { transition: { ease: number[] } };
    expect(show.transition.ease).toEqual([0.25, 0.46, 0.45, 0.94]);
    expect(show.transition.ease.every(Number.isFinite)).toBe(true);
  });

  it("shares one easing curve across fadeUp, slideLeft and slideRight", () => {
    const easeOf = (v: typeof fadeUp) =>
      (v.show as unknown as { transition: { ease?: number[] } }).transition.ease;
    expect(easeOf(slideLeft)).toEqual(easeOf(fadeUp));
    expect(easeOf(slideRight)).toEqual(easeOf(fadeUp));
  });

  it("gives fadeIn no vertical movement, only opacity", () => {
    expect(fadeIn.hidden).toEqual({ opacity: 0 });
  });

  it("defaults stagger to 80ms between children", () => {
    const v = stagger() as unknown as {
      show: { transition: { staggerChildren: number } };
    };
    expect(v.show.transition.staggerChildren).toBe(0.08);
  });

  it.each([
    // The two values NotificationBell actually passes, plus the degenerate cases.
    [0.012],
    [0.05],
    [0],
    [-0.05],
    [Infinity],
  ])("passes a staggerChildren of %p straight through without validation", (value) => {
    const v = stagger(value) as unknown as {
      show: { transition: { staggerChildren: number } };
    };
    expect(v.show.transition.staggerChildren).toBe(value);
  });

  it("passes NaN through unvalidated as well", () => {
    const v = stagger(NaN) as unknown as {
      show: { transition: { staggerChildren: number } };
    };
    expect(v.show.transition.staggerChildren).toBeNaN();
  });
});

describe("SERVICE_LABELS", () => {
  it("keeps its keys in the order the UI renders them", () => {
    // This object's key order drives the radio-button order on the new-booking
    // page and the checkbox order on the profile page, both via Object.keys.
    expect(Object.keys(SERVICE_LABELS)).toEqual([
      "walking",
      "boarding",
      "daycare",
      "grooming",
    ]);
  });

  it("has a translation for every service in both languages", () => {
    const missing = (Object.keys(SERVICE_LABELS) as ServiceType[]).filter(
      (s) => !resolvesInBoth(`common.services.${s}`),
    );
    expect(missing).toEqual([]);
  });
});

describe("PET_TYPE_LABELS", () => {
  it("covers all seven pet types", () => {
    expect(Object.keys(PET_TYPE_LABELS)).toHaveLength(7);
  });

  it("has a translation for every pet type in both languages", () => {
    const missing = (Object.keys(PET_TYPE_LABELS) as PetType[]).filter(
      (p) => !resolvesInBoth(`common.petTypes.${p}`),
    );
    expect(missing).toEqual([]);
  });
});

describe("STATUS_CONFIG", () => {
  const statuses = Object.keys(STATUS_CONFIG) as BookingStatus[];

  it("covers all five booking statuses", () => {
    expect(statuses.sort()).toEqual([
      "cancelled",
      "completed",
      "declined",
      "pending",
      "signed",
    ]);
  });

  it("gives every status a non-empty colour class", () => {
    // BookingCard interpolates status?.color directly into className.
    for (const s of statuses) {
      expect(STATUS_CONFIG[s].color.trim()).not.toBe("");
    }
  });

  it("has a status translation for every status in both languages", () => {
    const missing = statuses.filter(
      (s) => !resolvesInBoth(`common.bookingStatus.${s}`),
    );
    expect(missing).toEqual([]);
  });

  it("has a genitive translation for every status in both languages", () => {
    // The genitive namespace exists purely for Lithuanian case agreement in
    // the filtered empty-state title. A miss renders a raw dot-path.
    const missing = statuses.filter(
      (s) => !resolvesInBoth(`common.bookingStatusGenitive.${s}`),
    );
    expect(missing).toEqual([]);
  });

  it("returns undefined for an unknown status, which every call site guards with ?.", () => {
    expect(STATUS_CONFIG["expired" as BookingStatus]).toBeUndefined();
  });
});
