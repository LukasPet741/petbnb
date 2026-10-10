/**
 * An agreed booking as an iCalendar (.ics) file, so a stay lands in the owner's and the
 * sitter's own calendar app. Built in the browser: the session lives in the Supabase
 * client, so a server route could not tell whose booking it was being asked for.
 *
 * RFC 5545 in the parts calendars actually check: CRLF line endings, lines folded at 75
 * octets (bytes, not characters: "š" is two), TEXT values escaped, times in UTC.
 */

import { toDateTimeLocalValue } from "./booking-duration";

export interface CalendarEvent {
  /** Stable per booking, so adding it again updates the event instead of doubling it. */
  uid: string;
  start: string | Date;
  end: string | Date;
  summary: string;
  description?: string;
  location?: string;
  url?: string;
}

const encoder = new TextEncoder();

/** "2026-10-12T12:00:00+03:00" → "20261012T090000Z". */
function utc(value: string | Date): string {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?|\n/g, "\\n");
}

/** Splits at 75 octets; each continuation starts with the one space that unfolding removes. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = encoder.encode(char).length;
    if (size + n > 75) {
      parts.push(current);
      current = " ";
      size = 1;
    }
    current += char;
    size += n;
  }
  parts.push(current);
  return parts.join("\r\n");
}

export function buildIcs(event: CalendarEvent, now: Date): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//petbnb//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${utc(now)}`,
    `DTSTART:${utc(event.start)}`,
    `DTEND:${utc(event.end)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    ...(event.location ? [`LOCATION:${escapeText(event.location)}`] : []),
    ...(event.description ? [`DESCRIPTION:${escapeText(event.description)}`] : []),
    ...(event.url ? [`URL:${event.url}`] : []),
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

interface BookingForCalendar {
  id: string;
  start_at: string;
  end_at: string;
  address: string | null;
  notes: string | null;
  pet: { name: string } | null;
}

interface CalendarWords {
  /** The service in the viewer's language, e.g. "Dog Walking". */
  serviceLabel: string;
  /** Who the viewer meets, already worded: "Sitter: Jonas Petraitis". */
  counterpart: string | null;
  /** Where the chat link points: petbnb.lt on prod, localhost in dev. */
  origin: string;
}

export function bookingIcs(booking: BookingForCalendar, words: CalendarWords, now: Date): string {
  const chat = `${words.origin}/messages/${booking.id}`;
  return buildIcs(
    {
      uid: `booking-${booking.id}@petbnb.lt`,
      start: booking.start_at,
      end: booking.end_at,
      summary: [words.serviceLabel, booking.pet?.name, "petbnb"].filter(Boolean).join(" · "),
      location: booking.address ?? undefined,
      description: [words.counterpart, booking.notes, chat].filter(Boolean).join("\n"),
      url: chat,
    },
    now,
  );
}

/** "petbnb-2026-10-13.ics", dated by the LOCAL start day. */
export function icsFilename(startAt: string): string {
  return `petbnb-${toDateTimeLocalValue(new Date(startAt)).slice(0, 10)}.ics`;
}

/** Hands the file to the browser: phones offer to add it to the calendar, desktops save it. */
export function downloadIcs(filename: string, ics: string): void {
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoking straight after the click can cancel the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
