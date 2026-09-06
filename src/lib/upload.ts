/**
 * Photo uploads for profile avatars and pet pictures.
 *
 * Both land in the public `photos` bucket created by
 * supabase/migrations/20260621121732_create_photos_storage.sql, whose RLS
 * allows a signed-in user to write only under a folder named for their own
 * uid. Every path this module builds therefore starts with `<uid>/` — get that
 * wrong and the insert is rejected by the policy, not by us.
 */

export const PHOTO_BUCKET = "photos";

/** Anything larger is rejected before we spend time decoding it. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * What the file picker accepts. HEIC is deliberately absent: Safari hands it
 * over happily but canvas cannot decode it, so it would fail after the upload
 * had visibly started.
 */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

/**
 * Longest edge kept after downscaling. The largest slot either photo appears
 * in is the 80px xl avatar, so 800 leaves generous headroom for retina and for
 * a future larger layout while keeping objects to tens of kilobytes.
 */
export const MAX_IMAGE_DIMENSION = 800;

/** JPEG quality for the re-encode. Visually lossless at these dimensions. */
export const JPEG_QUALITY = 0.85;

export type UploadKind = "avatar" | "pet";

export type ImageValidation =
  | { ok: true }
  | { ok: false; errorKey: string };

/**
 * Checks a picked file before any decoding or network work.
 *
 * Returns an i18n key rather than a message so the caller renders it in the
 * user's language.
 */
export function validateImageFile(file: { type: string; size: number }): ImageValidation {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, errorKey: "appPages.imageUpload.errorWrongType" };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, errorKey: "appPages.imageUpload.errorTooLarge" };
  }
  if (file.size === 0) {
    return { ok: false, errorKey: "appPages.imageUpload.errorEmpty" };
  }
  return { ok: true };
}

/**
 * Builds the object path for a new upload: `<uid>/<kind>-<time>-<rand>.jpg`.
 *
 * The name is always unique rather than a stable `avatar.jpg`, because the
 * bucket is public and therefore CDN-cached: overwriting one path would leave
 * users looking at their old picture until the edge cache expired. A fresh
 * name changes the URL, so the new photo appears immediately. The old object
 * is deleted separately by the caller.
 *
 * The extension is always .jpg because every upload is re-encoded to JPEG by
 * `resizeImageToJpeg` before it gets here.
 */
export function storageObjectPath(
  userId: string,
  kind: UploadKind,
  seed: { now?: number; random?: string } = {},
): string {
  const now = seed.now ?? Date.now();
  const random = seed.random ?? Math.random().toString(36).slice(2, 8);
  return `${userId}/${kind}-${now}-${random}.jpg`;
}

/**
 * Recovers the in-bucket object path from a public photo URL, so a replaced
 * photo can be deleted instead of orphaned.
 *
 * Returns null for anything that is not one of our own public photo URLs —
 * seed data points at Unsplash, and older rows may hold arbitrary strings.
 * A null here means "not ours, leave it alone", never an error.
 */
export function storagePathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split("?")[0];
  return path ? decodeURIComponent(path) : null;
}

/**
 * Downscales an image to fit MAX_IMAGE_DIMENSION and re-encodes it as JPEG.
 *
 * This is what keeps a 12 megapixel phone photo from being stored at full size
 * and then shrunk to 80px in the browser on every page view. Canvas-based, so
 * it only runs in a real browser; the pure helpers above are the parts under
 * unit test.
 */
export async function resizeImageToJpeg(
  file: Blob,
  maxDimension = MAX_IMAGE_DIMENSION,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file; // No 2d context: upload the original rather than fail.

    // A transparent PNG would otherwise flatten to black once encoded as JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
    );
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}
