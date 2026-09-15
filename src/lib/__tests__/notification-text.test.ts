import { describe, it, expect } from "vitest";
import { dictionaries, type Locale } from "@/lib/i18n";
import { interpolate, lookup } from "@/context/LanguageContext";
import { notificationActor, notificationContext, notificationMeta, notificationSentence } from "@/lib/notification-text";
import type { AppNotification, NotificationType } from "@/lib/types";

/**
 * What a notification reads as, in the bell and on the dashboard.
 *
 * The sentence names only who did what, with the actor as its subject. Pet and service go on
 * the line under it. Lithuanian is why: a name or a service slotted into the middle of a
 * sentence needs a grammatical case the data does not have ("pateikė Dienos priežiūra
 * užklausą", "pažymėjo Rudis užsakymą" were both wrong), while a subject stays nominative.
 */

const tFor = (locale: Locale) => (key: string, vars?: Record<string, string | number>) => {
  const value = lookup(dictionaries[locale], key);
  return typeof value === "string" ? interpolate(value, vars) : key;
};

const TYPES: NotificationType[] = [
  "booking_requested",
  "booking_accepted",
  "booking_declined",
  "booking_cancelled",
  "booking_completed",
  "message_received",
];

function note(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: "n-1",
    user_id: "u-1",
    actor_id: "a-1",
    booking_id: "b-1",
    type: "booking_requested",
    read_at: null,
    created_at: new Date().toISOString(),
    email_status: "sent",
    email_error: null,
    actor: { full_name: "Emilija Ambrazevičiūtė" },
    booking: { service: "daycare", pet: { name: "Rudis" } },
    ...overrides,
  } as AppNotification;
}

describe("notificationSentence", () => {
  it.each([
    ["booking_requested", "Emilija Ambrazevičiūtė atsiuntė jums užklausą"],
    ["booking_accepted", "Emilija Ambrazevičiūtė patvirtino jūsų užsakymą"],
    ["booking_declined", "Emilija Ambrazevičiūtė atmetė jūsų užklausą"],
    ["booking_cancelled", "Emilija Ambrazevičiūtė atšaukė užsakymą"],
    ["booking_completed", "Emilija Ambrazevičiūtė pažymėjo užsakymą kaip įvykdytą"],
    ["message_received", "Emilija Ambrazevičiūtė atsiuntė jums žinutę"],
  ])("reads %s in Lithuanian with the actor as the only name in it", (type, expected) => {
    expect(notificationSentence(note({ type: type as NotificationType }), tFor("lt"))).toBe(expected);
  });

  it.each([
    ["booking_requested", "Emilija Ambrazevičiūtė sent you a booking request"],
    ["booking_accepted", "Emilija Ambrazevičiūtė confirmed your booking"],
    ["booking_declined", "Emilija Ambrazevičiūtė declined your request"],
    ["booking_cancelled", "Emilija Ambrazevičiūtė cancelled a booking"],
    ["booking_completed", "Emilija Ambrazevičiūtė marked a booking as completed"],
    ["message_received", "Emilija Ambrazevičiūtė sent you a message"],
  ])("reads %s in English", (type, expected) => {
    expect(notificationSentence(note({ type: type as NotificationType }), tFor("en"))).toBe(expected);
  });

  it.each(TYPES)("never puts the pet or the service into the %s sentence", (type) => {
    for (const locale of ["en", "lt"] as const) {
      const text = notificationSentence(note({ type }), tFor(locale));
      expect(text).not.toContain("Rudis");
      expect(text).not.toMatch(/priežiūr|Daycare/i);
      expect(text).not.toContain("{");
      expect(text).not.toContain("  ");
    }
  });
});

describe("notificationActor", () => {
  it("falls back to the unknown-person copy for a missing, empty or blank name", () => {
    for (const actor of [undefined, { full_name: null }, { full_name: "" }, { full_name: "   " }]) {
      expect(notificationActor(note({ actor } as unknown as Partial<AppNotification>), tFor("en"))).toBe("Someone");
    }
  });

  it("trims the name it shows", () => {
    expect(notificationActor(note({ actor: { full_name: " Tomas " } } as unknown as Partial<AppNotification>), tFor("en"))).toBe("Tomas");
  });
});

describe("notificationContext", () => {
  it("names the pet and the service, in that order", () => {
    expect(notificationContext(note(), tFor("lt"))).toBe("Rudis · Dienos priežiūra");
  });

  it("leaves out whatever the booking join did not bring", () => {
    expect(notificationContext(note({ booking: { service: "walking", pet: null } } as unknown as Partial<AppNotification>), tFor("lt"))).toBe("Šunų vedžiojimas");
    expect(notificationContext(note({ booking: undefined }), tFor("lt"))).toBe("");
  });
});

describe("notificationMeta", () => {
  it("puts the context before the time", () => {
    expect(notificationMeta(note(), tFor("lt"))).toMatch(/^Rudis · Dienos priežiūra · /);
  });

  it("is just the time when there is no booking", () => {
    const meta = notificationMeta(note({ booking: undefined }), tFor("en"));
    expect(meta).not.toContain("·");
    expect(meta.length).toBeGreaterThan(0);
  });
});
