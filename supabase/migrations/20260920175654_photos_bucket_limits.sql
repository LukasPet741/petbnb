-- Applied to production 2026-09-20 as 20260920175654.
-- From the 2026-09-20 security scan; see docs/security/2026-09-20-hardening.sql §2.
--
-- src/lib/upload.ts refuses anything over 5 MB and anything that is not a JPEG/PNG/WebP,
-- then re-encodes to JPEG. None of that binds: the upload is a direct storage call, so a
-- script skips the browser entirely and posts a 2 GB .svg. The bucket has carried no
-- limit since it was created (20260621121732). These numbers mirror MAX_UPLOAD_BYTES and
-- ACCEPTED_IMAGE_TYPES in src/lib/upload.ts -- change both together.
update storage.buckets
   set file_size_limit    = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'photos';
