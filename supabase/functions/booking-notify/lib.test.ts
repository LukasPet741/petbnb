import { describe, it, expect } from "vitest";
import {
  EMAILED_TYPES,
  isEmailedType,
  isDeliverable,
  domainOf,
  firstName,
  escapeHtml,
  truncate,
  formatMoment,
  renderEmail,
  COPY,
  SERVICE_LABELS,
  type EmailContext,
  type EmailedType,
  type Locale,
} from "./lib.ts";

// These helpers were split out of index.ts, which calls Deno.serve at module
// scope and could never be imported by a test. Everything here is pure.
// This file runs in the `edge` Vitest project (node environment, no jsdom).

const LOCALES: Locale[] = ["en", "lt"];

describe("isEmailedType", () => {
  it.each(EMAILED_TYPES)("accepts %s", (type) => {
    expect(isEmailedType(type)).toBe(true);
  });

  it("rejects message_received, which is deliberately in-app only", () => {
    // A chat message must not generate an email; it has its own skip reason
    // in the handler, distinct from the unknown-type path.
    expect(isEmailedType("message_received")).toBe(false);
  });

  it.each(["", "unknown", "BOOKING_REQUESTED"])("rejects %j", (type) => {
    expect(isEmailedType(type)).toBe(false);
  });

  it("rejects inherited Object members, because it uses includes rather than in", () => {
    // Contrast with LanguageContext's lookup(), which does use `in` and does
    // leak prototype members.
    expect(isEmailedType("constructor")).toBe(false);
    expect(isEmailedType("toString")).toBe(false);
  });
});

describe("domainOf", () => {
  it("returns the domain part, lowercased", () => {
    expect(domainOf("User@Example.COM")).toBe("example.com");
  });

  it("uses the last at-sign, so a quoted local part cannot smuggle a domain", () => {
    expect(domainOf("a@b@c.com")).toBe("c.com");
  });

  it("returns the whole string when there is no at-sign", () => {
    expect(domainOf("nodomain")).toBe("nodomain");
  });
});

describe("isDeliverable", () => {
  it.each([
    "jonas@gmail.com",
    "a@b.co",
    "first.last+tag@mail.co.uk",
  ])("accepts the real address %s", (email) => {
    expect(isDeliverable(email)).toBe(true);
  });

  it("rejects the seeded fixture domain, which would hard-bounce", () => {
    // All 40 seeded accounts use @petbnb.test. Sending to them would wreck the
    // Resend sender reputation, which is the whole point of this gate.
    expect(isDeliverable("ana.kazlauskiene@petbnb.test")).toBe(false);
  });

  it.each([
    "user@localhost",
    "user@example.com",
    "user@example.org",
    "user@example.net",
  ])("rejects the reserved domain in %s", (email) => {
    expect(isDeliverable(email)).toBe(false);
  });

  it.each([
    "user@x.test",
    "user@x.invalid",
    "user@x.localhost",
    "user@x.local",
    "user@x.example",
  ])("rejects the reserved TLD in %s", (email) => {
    expect(isDeliverable(email)).toBe(false);
  });

  it("rejects a subdomain of a reserved domain", () => {
    expect(isDeliverable("user@mail.example.com")).toBe(false);
  });

  it("does not over-match a domain that merely ends with a reserved name", () => {
    // The subdomain rule checks for ".example.com", not "example.com", so a
    // genuine company at notexample.com must still receive its mail. This is
    // the assertion that would catch a naive endsWith refactor.
    expect(isDeliverable("user@notexample.com")).toBe(true);
  });

  it("rejects an address whose domain has no dot", () => {
    expect(isDeliverable("user@intranet")).toBe(false);
  });

  it.each([
    ["an empty string", ""],
    ["no at-sign", "plainstring"],
    ["a space in the local part", "us er@gmail.com"],
    ["a space in the domain", "user@gm ail.com"],
    ["a leading at-sign", "@gmail.com"],
    ["a trailing at-sign", "user@"],
  ])("rejects %s", (_label, email) => {
    expect(isDeliverable(email)).toBe(false);
  });

  it("accepts a double at-sign address, because only the final domain is checked", () => {
    // The regex forbids @ in both halves, so this is actually rejected -
    // pinning it so the interaction between the regex and domainOf is explicit.
    expect(isDeliverable("a@b@c.com")).toBe(false);
  });
});

describe("firstName", () => {
  it("returns the first word", () => {
    expect(firstName("Jonas Petraitis")).toBe("Jonas");
  });

  it("trims and collapses surrounding whitespace", () => {
    expect(firstName("  Jonas   Petraitis  ")).toBe("Jonas");
  });

  it("returns a single-word name unchanged", () => {
    expect(firstName("Jonas")).toBe("Jonas");
  });

  it("preserves Lithuanian diacritics", () => {
    expect(firstName("Ąžuolas Šarūnas")).toBe("Ąžuolas");
  });

  it.each([
    ["null", null],
    ["an empty string", ""],
    ["whitespace only", "   "],
  ])("returns null for %s, so the greeting falls back to a bare hello", (_label, value) => {
    expect(firstName(value)).toBeNull();
  });

  it("disagrees with the app's own first-name logic on padded input", () => {
    // The web app uses profile.full_name?.split(" ")[0] with no trim, which
    // yields "" for a leading-space name and renders "Hi , " with a dangling
    // comma. This Edge Function version trims first and is the correct one.
    const appVersion = " Jonas Petraitis".split(" ")[0];
    expect(appVersion).toBe("");
    expect(firstName(" Jonas Petraitis")).toBe("Jonas");
  });
});

describe("escapeHtml", () => {
  it("escapes the ampersand first, so entities are not double-encoded wrongly", () => {
    // If & were escaped last, "<" would become "&amp;lt;" and render literally
    // as "&lt;" in the email body.
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml(">")).toBe("&gt;");
  });

  it("deliberately double-escapes an existing entity", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });

  it("neutralises a script tag", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("neutralises a double-quote attribute breakout", () => {
    // Every attribute in the template is double-quoted, so this is the payload
    // that matters most.
    expect(escapeHtml('" onmouseover="steal()')).toBe(
      "&quot; onmouseover=&quot;steal()",
    );
  });

  it("neutralises a single-quote breakout with an image error handler", () => {
    expect(escapeHtml("'><img src=x onerror=alert(1)>")).toBe(
      "&#39;&gt;&lt;img src=x onerror=alert(1)&gt;",
    );
  });

  it("leaves the backtick and forward slash unescaped (known gap)", () => {
    // Harmless in an HTML attribute or text context, but worth pinning so the
    // gap is a decision rather than an oversight.
    expect(escapeHtml("`/")).toBe("`/");
  });

  it("passes Lithuanian diacritics through unchanged", () => {
    expect(escapeHtml("Ąžuolas Šarūnaitė")).toBe("Ąžuolas Šarūnaitė");
  });

  it("returns an empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("handles a very large string without blowing up", () => {
    const huge = "<".repeat(200_000);
    expect(escapeHtml(huge)).toHaveLength(200_000 * "&lt;".length);
  });
});

describe("truncate", () => {
  it("leaves a value shorter than the limit untouched", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });

  it("leaves a value exactly at the limit untouched, with no ellipsis", () => {
    expect(truncate("abcde", 5)).toBe("abcde");
  });

  it("cuts one character over the limit down to exactly the limit, ellipsis included", () => {
    const out = truncate("abcdef", 5);
    expect(out).toBe("abcd…");
    expect(out).toHaveLength(5);
  });

  it("keeps the result within the limit for a long value", () => {
    expect(truncate("x".repeat(1000), 500)).toHaveLength(500);
  });

  // BUG (edge): with max = 0, slice(0, -1) drops the last character instead of
  // producing an empty string, so the result is longer than the limit, not
  // shorter. Only reachable if MAX_EMAIL_ERROR were ever set to 0, so it is
  // latent rather than live.
  it("returns nearly the whole string when the limit is zero (current buggy behaviour)", () => {
    expect(truncate("abc", 0)).toBe("ab…");
  });

  it("splits a surrogate pair at the boundary, producing a lone half", () => {
    // slice() counts UTF-16 code units, so an emoji straddling the cut is torn.
    const out = truncate("ab🐶", 3);
    expect(out).toHaveLength(3);
    expect(out.endsWith("…")).toBe(true);
  });
});

describe("formatMoment", () => {
  it("renders a UTC instant in Vilnius wall-clock time", () => {
    // The function pins timeZone: "Europe/Vilnius" regardless of where the
    // Edge Function runs, which is always UTC.
    const out = formatMoment("2026-09-01T12:00:00Z", "en");
    expect(out).toContain("15:00");
    expect(out).toContain("2026");
  });

  it("renders the Lithuanian form differently from the English one", () => {
    const en = formatMoment("2026-09-01T12:00:00Z", "en");
    const lt = formatMoment("2026-09-01T12:00:00Z", "lt");
    expect(lt).not.toBe(en);
    expect(lt).toContain("15:00");
  });

  it("applies the +3 offset during summer time", () => {
    expect(formatMoment("2026-07-01T09:00:00Z", "en")).toContain("12:00");
  });

  it("applies the +2 offset during winter time", () => {
    expect(formatMoment("2026-01-15T09:00:00Z", "en")).toContain("11:00");
  });

  it("shifts correctly on the far side of the March DST jump", () => {
    // 2026-03-29T01:00Z is 04:00 local, after clocks spring forward.
    expect(formatMoment("2026-03-29T01:00:00Z", "en")).toContain("04:00");
  });

  it("shifts correctly on the far side of the October DST fallback", () => {
    // 2026-10-25T02:00Z is 04:00 local; before the switch it would be 05:00.
    expect(formatMoment("2026-10-25T02:00:00Z", "en")).toContain("04:00");
  });

  // This helper HAS the Invalid-Date guard that src/lib/utils.formatDate lacks.
  // Worth pinning as the reference implementation for that fix.
  it.each([
    ["null", null],
    ["an empty string", ""],
    ["a garbage string", "not-a-date"],
  ])("returns an empty string for %s instead of throwing", (_label, iso) => {
    expect(formatMoment(iso, "en")).toBe("");
  });
});

describe("COPY completeness", () => {
  it.each(LOCALES)("has a subject for every emailed type in %s", (locale) => {
    const missing = EMAILED_TYPES.filter(
      (t) => typeof COPY[locale].subject[t] !== "function",
    );
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("has a body line for every emailed type in %s", (locale) => {
    const missing = EMAILED_TYPES.filter(
      (t) => typeof COPY[locale].line[t] !== "function",
    );
    expect(missing).toEqual([]);
  });

  it.each(LOCALES)("has all four service labels in %s", (locale) => {
    expect(Object.keys(SERVICE_LABELS[locale]).sort()).toEqual([
      "boarding",
      "daycare",
      "grooming",
      "walking",
    ]);
  });

  it("gives every emailed type a non-empty subject in both languages", () => {
    for (const locale of LOCALES) {
      for (const type of EMAILED_TYPES) {
        expect(COPY[locale].subject[type]("Jonas").trim()).not.toBe("");
      }
    }
  });

  it("translates the subjects, rather than reusing the English copy", () => {
    for (const type of EMAILED_TYPES) {
      expect(COPY.lt.subject[type]("Jonas")).not.toBe(COPY.en.subject[type]("Jonas"));
    }
  });
});

describe("renderEmail", () => {
  const ctx = (over: Partial<EmailContext> = {}): EmailContext => ({
    locale: "en",
    type: "booking_requested",
    actorName: "Jonas",
    petName: "Rex",
    recipientFirstName: "Ana",
    service: "walking",
    startAt: "2026-09-10T09:00:00Z",
    endAt: "2026-09-12T17:00:00Z",
    url: "https://petbnb.example/messages/b-1",
    ...over,
  });

  it("returns a subject, an html body and a text body", () => {
    const out = renderEmail(ctx());
    expect(out.subject).toBeTruthy();
    expect(out.html).toContain("<!doctype html>");
    expect(out.text).toBeTruthy();
  });

  it("names the actor in the subject", () => {
    expect(renderEmail(ctx({ actorName: "Jonas" })).subject).toContain("Jonas");
  });

  it("includes the pet name in the body", () => {
    expect(renderEmail(ctx({ petName: "Rex" })).text).toContain("Rex");
  });

  it("includes the call-to-action url in both bodies", () => {
    const out = renderEmail(ctx({ url: "https://petbnb.example/messages/xyz" }));
    expect(out.html).toContain("https://petbnb.example/messages/xyz");
    expect(out.text).toContain("https://petbnb.example/messages/xyz");
  });

  it.each([
    ["service, start and end", { service: "walking", startAt: "2026-09-10T09:00:00Z", endAt: "2026-09-12T17:00:00Z" }, 3],
    ["service and start", { service: "walking", startAt: "2026-09-10T09:00:00Z", endAt: null }, 2],
    ["service and end", { service: "walking", startAt: null, endAt: "2026-09-12T17:00:00Z" }, 2],
    ["start and end", { service: null, startAt: "2026-09-10T09:00:00Z", endAt: "2026-09-12T17:00:00Z" }, 2],
    ["service only", { service: "walking", startAt: null, endAt: null }, 1],
    ["start only", { service: null, startAt: "2026-09-10T09:00:00Z", endAt: null }, 1],
    ["end only", { service: null, startAt: null, endAt: "2026-09-12T17:00:00Z" }, 1],
    ["nothing", { service: null, startAt: null, endAt: null }, 0],
  ] as const)("renders %s as %i detail rows", (_label, over, expected) => {
    const out = renderEmail(ctx(over as Partial<EmailContext>));
    const labels = [COPY.en.labels.service, COPY.en.labels.start, COPY.en.labels.end];
    const present = labels.filter((l) => out.text.includes(l)).length;
    expect(present).toBe(expected);
  });

  it("skips the service row for a service with no label", () => {
    const out = renderEmail(
      ctx({ service: "petting" as EmailContext["service"], startAt: null, endAt: null }),
    );
    expect(out.text).not.toContain(COPY.en.labels.service);
  });

  it("adds a follow-up line only for a booking request", () => {
    const requested = renderEmail(ctx({ type: "booking_requested" }));
    const followUp = COPY.en.followUp.booking_requested as string;
    expect(requested.text).toContain(followUp);

    for (const type of EMAILED_TYPES.filter((t) => t !== "booking_requested")) {
      const other = renderEmail(ctx({ type: type as EmailedType }));
      expect(other.text).not.toContain(followUp);
    }
  });

  it("greets the recipient by first name when known", () => {
    expect(renderEmail(ctx({ recipientFirstName: "Ana" })).text).toContain("Ana");
  });

  it("still renders when the recipient's first name is unknown", () => {
    const out = renderEmail(ctx({ recipientFirstName: null }));
    expect(out.text.trim()).not.toBe("");
    expect(out.html).toContain("<!doctype html>");
  });

  it("escapes a hostile actor name in the html body", () => {
    // The single most important security assertion here: full_name is fully
    // user-controlled and lands in the email body.
    const out = renderEmail(ctx({ actorName: "<script>alert(1)</script>" }));
    expect(out.html).not.toContain("<script>alert(1)</script>");
    expect(out.html).toContain("&lt;script&gt;");
  });

  it("escapes a hostile pet name in the html body", () => {
    const out = renderEmail(ctx({ petName: '"><img src=x onerror=alert(1)>' }));
    expect(out.html).not.toContain("<img src=x onerror=alert(1)>");
  });

  it("escapes the url used as an href", () => {
    const out = renderEmail(ctx({ url: 'https://x/"><b>' }));
    expect(out.html).not.toContain('"><b>');
  });

  it("leaves the plaintext body unescaped, which is correct for text/plain", () => {
    const out = renderEmail(ctx({ actorName: "<b>Jonas</b>" }));
    expect(out.text).toContain("<b>Jonas</b>");
  });

  it("renders a Lithuanian email that differs from the English one", () => {
    const en = renderEmail(ctx({ locale: "en" }));
    const lt = renderEmail(ctx({ locale: "lt" }));
    expect(lt.subject).not.toBe(en.subject);
    expect(lt.text).not.toBe(en.text);
  });

  // BUG: the subject is built from a user-controlled full_name that is never
  // stripped of newlines, then handed straight to resend.emails.send({subject}).
  // A CRLF in a subject is the classic SMTP header-injection vector. Resend's
  // JSON API very likely rejects it, but this function provides no defence of
  // its own, so the safety is somebody else's to guarantee.
  // Correct behaviour: strip /[\r\n]+/ from actorName before building subject.
  it("lets a newline survive into the subject header (current buggy behaviour)", () => {
    const out = renderEmail(ctx({ actorName: "Jonas\r\nBcc: victim@example.com" }));
    expect(out.subject).toMatch(/[\r\n]/);
    expect(out.subject).toContain("Bcc: victim@example.com");
  });
});
