import { describe, it, expect } from "vitest";
import { SERVICE_PHOTO_ID, SERVICE_PHOTO_FOCUS, SERVICE_PHOTO_POOL, servicePhoto, sitterCoverPhoto, coverService, spreadCoverPhotos, rememberCovers, coverPhotoFor } from "@/lib/images";
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

describe("SERVICE_PHOTO_POOL and sitterCoverPhoto", () => {
  // Found in the 2026-09-15 visual review of /browse: most sitters offer walking first, so a
  // grid where every card used SERVICE_PHOTO_ID showed the same two dogs seventeen times.
  // Each service now has a small pool, and a sitter always gets the same photo from it.

  it("starts each pool with the service's own photo, so the landing tiles still match", () => {
    for (const service of SERVICES) expect(SERVICE_PHOTO_POOL[service][0], service).toBe(SERVICE_PHOTO_ID[service]);
  });

  it("never shares a photo between two services, and uses only free photos", () => {
    const all = SERVICES.flatMap((service) => [...SERVICE_PHOTO_POOL[service]]);
    expect(new Set(all).size).toBe(all.length);
    for (const id of all) expect(id).toMatch(/^photo-\d+-[0-9a-f]+$/);
  });

  it("gives a sitter the same photo every time", () => {
    expect(sitterCoverPhoto("740b5962-4f41-4871-9c4e-333d7680325b", "walking", 640)).toBe(
      sitterCoverPhoto("740b5962-4f41-4871-9c4e-333d7680325b", "walking", 640),
    );
  });

  it("spreads a grid of sitters across the pool instead of repeating one photo", () => {
    const ids = Array.from({ length: 17 }, (_, i) => `sitter-${i}-${(i * 7919).toString(16)}`);
    const used = new Set(ids.map((id) => sitterCoverPhoto(id, "walking", 640)));
    expect(used.size).toBe(SERVICE_PHOTO_POOL.walking.length);
  });
});

describe("spreadCoverPhotos", () => {
  // Found in the 2026-09-15 review of /browse: with pools of two to four photos, a per-sitter
  // hash still put the same ginger cat on two cards side by side (4 of 25 neighbours at 3
  // columns). Only the grid knows which cards end up next to each other, so it spreads them.
  const walker = (id: string) => ({ id, services: { walking: true } });
  const boarder = (id: string) => ({ id, services: { boarding: true } });
  const groomer = (id: string) => ({ id, services: { grooming: true } });
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `sitter-${i}-${(i * 7919).toString(16)}`);

  it("never repeats a photo within three cards when the pool has four or more", () => {
    const covers = ids(17).map(walker);
    const picks = covers.map((s) => spreadCoverPhotos(covers).get(s.id));
    picks.forEach((pick, i) => {
      expect(picks.slice(Math.max(0, i - 3), i), `card ${i}`).not.toContain(pick);
    });
  });

  it("never puts the same photo on two neighbours or two cards apart, even from a pool of three", () => {
    const covers = ids(12).map(boarder);
    const map = spreadCoverPhotos(covers);
    const picks = covers.map((s) => map.get(s.id));
    picks.forEach((pick, i) => {
      if (i >= 1) expect(pick, `card ${i}`).not.toBe(picks[i - 1]);
      if (i >= 2) expect(pick, `card ${i}`).not.toBe(picks[i - 2]);
    });
  });

  it("alternates a pool of two", () => {
    const covers = ids(6).map(groomer);
    const map = spreadCoverPhotos(covers);
    const picks = covers.map((s) => map.get(s.id));
    picks.forEach((pick, i) => { if (i >= 1) expect(pick).not.toBe(picks[i - 1]); });
  });

  it("only picks from the pool of the sitter's own first service", () => {
    const covers = [walker("a"), boarder("b"), groomer("c"), walker("d")];
    const map = spreadCoverPhotos(covers);
    expect(SERVICE_PHOTO_POOL.walking).toContain(map.get("a"));
    expect(SERVICE_PHOTO_POOL.boarding).toContain(map.get("b"));
    expect(SERVICE_PHOTO_POOL.grooming).toContain(map.get("c"));
    expect(SERVICE_PHOTO_POOL.walking).toContain(map.get("d"));
  });

  it("does not count other services' cards as neighbours worth avoiding", () => {
    // Different pools never share a photo, so a lone walker between boarders keeps its own pick.
    const lone = walker("740b5962-4f41-4871-9c4e-333d7680325b");
    const map = spreadCoverPhotos([boarder("x"), lone, boarder("y")]);
    expect(sitterCoverPhoto(lone.id, "walking", 640)).toContain(map.get(lone.id)!);
  });

  it("gives the same grid the same photos every time", () => {
    const covers = ids(10).map(walker);
    expect([...spreadCoverPhotos(covers)]).toEqual([...spreadCoverPhotos(covers)]);
  });

  it("leaves out sitters who offer nothing", () => {
    expect(spreadCoverPhotos([{ id: "z", services: {} }]).has("z")).toBe(false);
  });
});

describe("rememberCovers and coverPhotoFor", () => {
  // Opening a card is a client-side navigation, so the profile can reuse the grid's pick and
  // keep the picture the visitor just clicked; a direct visit falls back to the sitter's own hash.
  it("returns the photo the grid picked for a sitter", () => {
    const pick = SERVICE_PHOTO_POOL.walking[2];
    rememberCovers(new Map([["remembered-sitter", pick]]));
    expect(coverPhotoFor("remembered-sitter", "walking", 1600)).toContain(pick);
  });

  it("falls back to the sitter's own hash when nothing was remembered", () => {
    expect(coverPhotoFor("never-seen", "walking", 1600)).toBe(sitterCoverPhoto("never-seen", "walking", 1600));
  });

  it("ignores a remembered photo from another service's pool", () => {
    rememberCovers(new Map([["changed-services", SERVICE_PHOTO_POOL.boarding[1]]]));
    expect(coverPhotoFor("changed-services", "walking", 1600)).toBe(sitterCoverPhoto("changed-services", "walking", 1600));
  });
});
