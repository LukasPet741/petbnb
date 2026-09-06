import { describe, it, expect } from "vitest";
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  PHOTO_BUCKET,
  storageObjectPath,
  storagePathFromPublicUrl,
  validateImageFile,
} from "@/lib/upload";

const file = (over: Partial<{ type: string; size: number }> = {}) => ({
  type: "image/jpeg",
  size: 1024,
  ...over,
});

describe("validateImageFile", () => {
  it.each(ACCEPTED_IMAGE_TYPES)("accepts %s", (type) => {
    expect(validateImageFile(file({ type }))).toEqual({ ok: true });
  });

  it.each([
    ["a PDF", "application/pdf"],
    ["a video", "video/mp4"],
    ["an SVG, which can carry script", "image/svg+xml"],
    ["a HEIC that canvas cannot decode", "image/heic"],
    ["an empty type, as some pickers report", ""],
  ])("rejects %s", (_label, type) => {
    expect(validateImageFile(file({ type }))).toEqual({
      ok: false,
      errorKey: "appPages.imageUpload.errorWrongType",
    });
  });

  it("accepts a file exactly at the size limit", () => {
    expect(validateImageFile(file({ size: MAX_UPLOAD_BYTES }))).toEqual({ ok: true });
  });

  it("rejects a file one byte over the limit", () => {
    expect(validateImageFile(file({ size: MAX_UPLOAD_BYTES + 1 }))).toEqual({
      ok: false,
      errorKey: "appPages.imageUpload.errorTooLarge",
    });
  });

  it("rejects a zero-byte file, which uploads 'successfully' as a broken image", () => {
    expect(validateImageFile(file({ size: 0 }))).toEqual({
      ok: false,
      errorKey: "appPages.imageUpload.errorEmpty",
    });
  });

  it("checks the type before the size, so a huge PDF reports the useful error", () => {
    expect(validateImageFile(file({ type: "application/pdf", size: 99e6 }))).toEqual({
      ok: false,
      errorKey: "appPages.imageUpload.errorWrongType",
    });
  });

  it("returns an i18n key rather than prose, so the message can be localised", () => {
    const result = validateImageFile(file({ size: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errorKey).toMatch(/^appPages\./);
  });
});

describe("storageObjectPath", () => {
  // The bucket policy is `(storage.foldername(name))[1] = auth.uid()::text`.
  // Any path not starting with the uid folder is refused by Postgres, not by
  // the client, so this is the single most important property here.
  it("puts the object in a folder named for the user, as the RLS policy requires", () => {
    const path = storageObjectPath("user-123", "avatar");
    expect(path.startsWith("user-123/")).toBe(true);
    expect(path.split("/")[0]).toBe("user-123");
  });

  it("nests exactly one level, so foldername()[1] is the uid", () => {
    expect(storageObjectPath("user-123", "pet").split("/")).toHaveLength(2);
  });

  it.each(["avatar", "pet"] as const)("tags the object with its %s kind", (kind) => {
    expect(storageObjectPath("u", kind, { now: 1, random: "abc" })).toBe(`u/${kind}-1-abc.jpg`);
  });

  it("always ends in .jpg, matching the re-encode every upload goes through", () => {
    expect(storageObjectPath("u", "avatar")).toMatch(/\.jpg$/);
  });

  // A stable name like `<uid>/avatar.jpg` would be served stale from the CDN
  // after a replacement, showing the user their previous photo.
  it("produces a different path on every call, so a new photo gets a new URL", () => {
    const paths = new Set(
      Array.from({ length: 50 }, () => storageObjectPath("u", "avatar")),
    );
    expect(paths.size).toBe(50);
  });

  it("stays unique within the same millisecond via the random segment", () => {
    const a = storageObjectPath("u", "avatar", { now: 1000 });
    const b = storageObjectPath("u", "avatar", { now: 1000 });
    expect(a).not.toBe(b);
  });

  it("contains no characters that would need escaping in a URL", () => {
    expect(storageObjectPath("u", "avatar")).toMatch(/^[A-Za-z0-9/_.-]+$/);
  });
});

describe("storagePathFromPublicUrl", () => {
  const publicUrl = (path: string) =>
    `https://proj.supabase.co/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;

  it("recovers the object path from one of our own public URLs", () => {
    expect(storagePathFromPublicUrl(publicUrl("u-1/avatar-1-abc.jpg"))).toBe(
      "u-1/avatar-1-abc.jpg",
    );
  });

  it("drops a cache-busting query string", () => {
    expect(storagePathFromPublicUrl(publicUrl("u-1/pet-2-xyz.jpg") + "?t=999")).toBe(
      "u-1/pet-2-xyz.jpg",
    );
  });

  it("decodes a percent-escaped path so the delete targets the real object", () => {
    expect(storagePathFromPublicUrl(publicUrl("u-1/pet%20photo.jpg"))).toBe(
      "u-1/pet photo.jpg",
    );
  });

  // Seed rows point at Unsplash and older rows may hold anything at all.
  // Returning null means "not ours" — the caller must skip the delete, not
  // treat it as a failure.
  it.each([
    ["an Unsplash seed URL", "https://images.unsplash.com/photo-123?w=800"],
    ["a bucket that is not ours", "https://proj.supabase.co/storage/v1/object/public/other/u/a.jpg"],
    ["a signed (non-public) URL", "https://proj.supabase.co/storage/v1/object/sign/photos/u/a.jpg"],
    ["arbitrary text", "not a url at all"],
    ["an empty string", ""],
  ])("returns null for %s", (_label, url) => {
    expect(storagePathFromPublicUrl(url)).toBeNull();
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
  ])("returns null for %s rather than throwing", (_label, url) => {
    expect(storagePathFromPublicUrl(url)).toBeNull();
  });

  it("returns null when the URL ends at the bucket with no object path", () => {
    expect(
      storagePathFromPublicUrl(`https://proj.supabase.co/storage/v1/object/public/${PHOTO_BUCKET}/`),
    ).toBeNull();
  });

  it("round-trips a path built by storageObjectPath", () => {
    const path = storageObjectPath("u-1", "pet");
    expect(storagePathFromPublicUrl(publicUrl(path))).toBe(path);
  });
});
