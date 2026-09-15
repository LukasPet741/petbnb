import { describe, it, expect } from "vitest";
import { SERVICE_PHOTO_ID, SERVICE_PHOTO_FOCUS, servicePhoto, coverService } from "@/lib/images";
import { SERVICE_LABELS, type ServiceType } from "@/lib/types";

/**
 * One photograph per service, and which one a sitter's profile cover shows.
 *
 * Sitters upload an avatar, never a cover, so the photo-backed profile illustrates WHAT
 * the sitter does rather than pretending to show them. That only stays honest if every
 * service has its own picture and the choice is predictable.
 */

const SERVICES = Object.keys(SERVICE_LABELS) as ServiceType[];

describe("SERVICE_PHOTO_ID", () => {
  it("has a photo for every service", () => {
    for (const service of SERVICES) {
      expect(SERVICE_PHOTO_ID[service], service).toMatch(/^photo-\d+-[0-9a-f]+$/);
    }
  });

  it("gives each service a different photo", () => {
    // Two services sharing a picture would make the cover's caption the only clue.
    expect(new Set(Object.values(SERVICE_PHOTO_ID)).size).toBe(SERVICES.length);
  });

  it("uses only free Unsplash photos, never Unsplash+", () => {
    // Unsplash+ ids are served as premium_photo-…, and are licensed differently.
    for (const id of Object.values(SERVICE_PHOTO_ID)) expect(id).not.toMatch(/^premium_/);
  });
});

describe("servicePhoto", () => {
  it("requests the photo at its own 3:2 aspect, leaving the band crop to CSS", () => {
    // A server-side crop to the band's shape is what cut the walking dogs' ears off.
    const url = servicePhoto("walking", 1200);
    expect(url).toContain(`images.unsplash.com/${SERVICE_PHOTO_ID.walking}?`);
    expect(url).toContain("w=1200");
    expect(url).toContain("h=800");
  });
});

describe("SERVICE_PHOTO_FOCUS", () => {
  it("gives every service an object-position in percentages", () => {
    for (const service of SERVICES) {
      expect(SERVICE_PHOTO_FOCUS[service], service).toMatch(/^\d{1,3}% \d{1,3}%$/);
    }
  });
});

describe("coverService", () => {
  it("picks the first offered service in the site's service order", () => {
    // Not the JSON key order, which is whatever Postgres was given.
    expect(coverService({ grooming: true, walking: true })).toBe("walking");
    expect(coverService({ daycare: true, boarding: true })).toBe("boarding");
  });

  it("skips services that are not offered", () => {
    expect(coverService({ walking: false, boarding: false, daycare: true })).toBe("daycare");
  });

  it("returns null for a sitter who offers nothing", () => {
    expect(coverService({})).toBeNull();
    expect(coverService(null)).toBeNull();
    expect(coverService(undefined)).toBeNull();
  });
});
