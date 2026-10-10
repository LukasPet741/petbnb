import { describe, it, expect, vi, afterEach } from "vitest";
import { buildIcs, bookingIcs, icsFilename, downloadIcs } from "@/lib/booking-ics";

const NOW = new Date("2026-10-10T08:30:15Z");

const EVENT = {
  uid: "booking-b-1@petbnb.lt",
  start: "2026-10-12T09:00:00Z",
  end: "2026-10-14T17:30:00Z",
  summary: "Dog Walking · Rex · petbnb",
};

/** Physical lines, without the final empty string after the closing CRLF. */
function lines(ics: string): string[] {
  return ics.split("\r\n").slice(0, -1);
}

/** RFC 5545 §3.1: a CRLF followed by one space is a fold, removed on reading. */
function unfold(ics: string): string[] {
  return lines(ics.replace(/\r\n /g, ""));
}

const bytes = (s: string) => new TextEncoder().encode(s).length;

describe("buildIcs", () => {
  it("wraps one event in a calendar, every line ending in CRLF", () => {
    const ics = buildIcs(EVENT, NOW);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    expect(unfold(ics)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//petbnb//Bookings//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:booking-b-1@petbnb.lt",
      "DTSTAMP:20261010T083015Z",
      "DTSTART:20261012T090000Z",
      "DTEND:20261014T173000Z",
      "SUMMARY:Dog Walking · Rex · petbnb",
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ]);
  });

  it("writes times in UTC whatever offset they arrive with", () => {
    const ics = buildIcs({ ...EVENT, start: "2026-10-12T12:00:00+03:00", end: new Date("2026-10-12T15:45:00+03:00") }, NOW);
    expect(unfold(ics)).toContain("DTSTART:20261012T090000Z");
    expect(unfold(ics)).toContain("DTEND:20261012T124500Z");
  });

  it("adds location, description and url only when given", () => {
    const ics = buildIcs(
      { ...EVENT, location: "Gedimino pr. 1, Vilnius", description: "Sitter: Jonas", url: "https://petbnb.lt/messages/b-1" },
      NOW,
    );
    const body = unfold(ics);
    expect(body).toContain("LOCATION:Gedimino pr. 1\\, Vilnius");
    expect(body).toContain("DESCRIPTION:Sitter: Jonas");
    expect(body).toContain("URL:https://petbnb.lt/messages/b-1");
    expect(unfold(buildIcs(EVENT, NOW)).some((l) => /^(LOCATION|DESCRIPTION|URL):/.test(l))).toBe(false);
  });

  it("escapes backslashes, semicolons, commas and newlines in text", () => {
    const ics = buildIcs({ ...EVENT, description: "a\\b;c,d\ne\r\nf" }, NOW);
    expect(unfold(ics)).toContain("DESCRIPTION:a\\\\b\\;c\\,d\\ne\\nf");
  });

  it("folds long lines at 75 octets without splitting a Lithuanian letter", () => {
    const description = "Šuo mėgsta ilgus pasivaikščiojimus parke, žaidimus su kamuoliu ir skanėstus. ".repeat(4);
    const ics = buildIcs({ ...EVENT, description }, NOW);
    for (const line of lines(ics)) expect(bytes(line)).toBeLessThanOrEqual(75);
    expect(lines(ics).some((l) => l.startsWith(" "))).toBe(true);
    // Unfolding gives back the escaped text exactly: no letter was cut in two.
    expect(unfold(ics)).toContain(`DESCRIPTION:${description.replace(/,/g, "\\,")}`);
  });
});

describe("bookingIcs", () => {
  const BOOKING = {
    id: "b-1",
    start_at: "2026-10-12T09:00:00Z",
    end_at: "2026-10-14T17:30:00Z",
    address: "Gedimino pr. 1, Vilnius",
    notes: "Feed twice a day",
    pet: { name: "Rex" },
  };
  const WORDS = { serviceLabel: "Dog Walking", counterpart: "Sitter: Jonas Petraitis", origin: "https://petbnb.lt" };

  it("names the service and the pet, and links back to the booking's chat", () => {
    const body = unfold(bookingIcs(BOOKING, WORDS, NOW));
    expect(body).toContain("UID:booking-b-1@petbnb.lt");
    expect(body).toContain("SUMMARY:Dog Walking · Rex · petbnb");
    expect(body).toContain("LOCATION:Gedimino pr. 1\\, Vilnius");
    expect(body).toContain("DESCRIPTION:Sitter: Jonas Petraitis\\nFeed twice a day\\nhttps://petbnb.lt/messages/b-1");
    expect(body).toContain("URL:https://petbnb.lt/messages/b-1");
  });

  it("leaves out what the booking does not have", () => {
    const body = unfold(bookingIcs({ ...BOOKING, address: null, notes: null, pet: null }, { ...WORDS, counterpart: null }, NOW));
    expect(body).toContain("SUMMARY:Dog Walking · petbnb");
    expect(body).toContain("DESCRIPTION:https://petbnb.lt/messages/b-1");
    expect(body.some((l) => l.startsWith("LOCATION:"))).toBe(false);
  });
});

describe("icsFilename", () => {
  it("names the file after the local start date", () => {
    // 22:30 UTC is already the next day in Vilnius (the suite pins TZ).
    expect(icsFilename("2026-10-12T22:30:00Z")).toBe("petbnb-2026-10-13.ics");
  });
});

describe("downloadIcs", () => {
  // jsdom has no object URLs, so there is nothing to spy on: swap them in, put them back.
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    vi.useRealTimers();
  });

  it("hands the browser a text/calendar file under the given name, then frees it", async () => {
    vi.useFakeTimers();
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((b: Blob) => { blobs.push(b); return "blob:petbnb/1"; });
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    let clicked: HTMLAnchorElement | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) { clicked = this; });

    downloadIcs("petbnb-2026-10-12.ics", "BEGIN:VCALENDAR\r\n");

    expect(clicked!.download).toBe("petbnb-2026-10-12.ics");
    expect(clicked!.href).toBe("blob:petbnb/1");
    expect(clicked!.isConnected).toBe(false);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:petbnb/1");

    // jsdom's Blob has no text(); FileReader does, and needs the real timers back.
    vi.useRealTimers();
    expect(blobs[0].type).toBe("text/calendar;charset=utf-8");
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(blobs[0]);
    });
    expect(text).toBe("BEGIN:VCALENDAR\r\n");
  });
});
