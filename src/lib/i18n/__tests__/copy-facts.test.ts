import { describe, it, expect } from "vitest";
import { dictionaries } from "@/lib/i18n";
import { PROMOTE_PLAN } from "@/lib/promote";

/**
 * Copy that states a fact about the system, pinned to the fact.
 *
 * Each of these was true when written and went false when the system changed around it:
 * per-period prices (2026-09-15) retired the hourly rate, and the Smart-ID demo badge
 * (2026-09-15) made the demo store a verification and made verifying the step that lets a
 * new sitter be booked (enforce_sitter_verified).
 */

type Dict = Record<string, unknown>;

function resolve(dict: Dict, key: string): unknown {
  return key.split(".").reduce<unknown>(
    (node, part) => (node && typeof node === "object" && part in (node as Dict) ? (node as Dict)[part] : undefined),
    dict,
  );
}

const text = (lang: "en" | "lt", key: string) => {
  const value = resolve(dictionaries[lang] as Dict, key);
  if (typeof value !== "string") throw new Error(`${lang}:${key} is not a string`);
  return value;
};

describe("landing FAQ", () => {
  it("does not quote an hourly rate, since sitters price by period", () => {
    expect(text("en", "home.faq.items.cost.a")).not.toMatch(/hour|\/hr/i);
    expect(text("lt", "home.faq.items.cost.a")).not.toMatch(/valand|\/val/i);
  });

  it("tells a new sitter that a Smart-ID check comes before bookings", () => {
    expect(text("en", "home.faq.items.becomeSitter.a")).not.toMatch(/no approval/i);
    expect(text("lt", "home.faq.items.becomeSitter.a")).not.toMatch(/laukti patvirtinimo/i);
    expect(text("en", "home.faq.items.becomeSitter.a")).toMatch(/Smart-ID/);
    expect(text("lt", "home.faq.items.becomeSitter.a")).toMatch(/Smart-ID/);
  });

  it("does not ask a new sitter for a rate", () => {
    expect(text("en", "home.faq.items.becomeSitter.a")).not.toMatch(/\brate\b/i);
    expect(text("lt", "home.faq.items.becomeSitter.a")).not.toMatch(/įkain/i);
  });
});

describe("Smart-ID demo page", () => {
  it("does not claim that nothing is stored", () => {
    expect(text("en", "appPages.smartIdDemo.subtitle")).not.toMatch(/nothing is stored/i);
    expect(text("lt", "appPages.smartIdDemo.subtitle")).not.toMatch(/nieko nesaugo|niekas ne(iš)?saugoma/i);
  });

  it("says a successful check adds the demo badge", () => {
    expect(text("en", "appPages.smartIdDemo.subtitle")).toMatch(/badge/i);
    expect(text("lt", "appPages.smartIdDemo.subtitle")).toMatch(/ženklel/i);
  });
});

describe("booking blockers", () => {
  it("has a message in both languages for every reason a sitter cannot be booked", () => {
    for (const lang of ["en", "lt"] as const) {
      for (const blocker of ["sitterNotFound", "ownProfile", "notASitter", "notVerified"]) {
        expect(() => text(lang, `appPages.bookingsNew.${blocker}`)).not.toThrow();
      }
    }
  });

  it("does not send the owner to message a sitter they cannot book, since a chat needs a booking", () => {
    for (const key of ["notVerified", "noServicesOffered", "unpricedService"]) {
      expect(text("en", `appPages.bookingsNew.${key}`)).not.toMatch(/message/i);
      expect(text("lt", `appPages.bookingsNew.${key}`)).not.toMatch(/parašykite/i);
    }
  });
});

describe("error pages", () => {
  it("has the not-found and error page copy in both languages", () => {
    const keys = [
      "common.notFound.title",
      "common.notFound.body",
      "common.notFound.home",
      "common.error.title",
      "common.error.body",
      "common.error.retry",
      "common.error.home",
    ];
    for (const lang of ["en", "lt"] as const) {
      for (const key of keys) expect(() => text(lang, key)).not.toThrow();
    }
  });
});

describe("payments copy, once businesses can pay for Promoted placement", () => {
  it("no longer says PetBnB takes no money at all, and names the one thing it sells", () => {
    expect(text("en", "legal.terms.sections.payments.body")).not.toMatch(/processes no payments|charges no fees/i);
    expect(text("lt", "legal.terms.sections.payments.body")).not.toMatch(/neapdoroja mokėjimų|netaiko jokių mokesčių/i);
    for (const lang of ["en", "lt"] as const) {
      expect(text(lang, "legal.terms.sections.payments.body")).toMatch(/Stripe/);
    }
  });

  it("still promises owners and sitters that they pay PetBnB nothing", () => {
    expect(text("en", "legal.terms.sections.payments.body")).toMatch(/owners and sitters[^.]*nothing/i);
    expect(text("lt", "legal.terms.sections.payments.body")).toMatch(/nieko nemoka/i);
  });

  it("no longer says, in the same terms, that nothing is sold", () => {
    expect(text("en", "legal.terms.sections.aboutProject.body")).not.toMatch(/not a commercial service|no legal entity/i);
    expect(text("lt", "legal.terms.sections.aboutProject.body")).not.toMatch(/nėra komercinė|joks juridinis asmuo/i);
  });

  it("tells readers of the privacy policy who handles business payments", () => {
    expect(text("en", "legal.privacy.sections.whereItLives.body")).toMatch(/Stripe/);
    expect(text("lt", "legal.privacy.sections.whereItLives.body")).toMatch(/Stripe/);
  });

  it("quotes the price the checkout charges in the advertiser terms", () => {
    expect(text("en", "legal.advertising.sections.price.body")).toContain(`€${PROMOTE_PLAN.priceEur}`);
    expect(text("lt", "legal.advertising.sections.price.body")).toContain(`${PROMOTE_PLAN.priceEur} €`);
  });

  it("promises visibility, never bookings", () => {
    expect(text("en", "legal.advertising.sections.results.body")).toMatch(/no promise/i);
    expect(text("lt", "legal.advertising.sections.results.body")).toMatch(/nežada/i);
  });
});
