import type { VerificationMethod } from "@/lib/types";

const KEY = "appPages.smartIdDemo";

/**
 * The title and text keys of the Smart-ID link on /profile. For a sitter who has not verified,
 * the demo is what makes them bookable (enforce_sitter_verified), so the link says so.
 */
export function verificationLinkCopy(
  method: VerificationMethod | null | undefined,
  isSitter: boolean,
): { title: string; text: string } {
  if (method === "smart_id_demo") {
    return { title: `${KEY}.profileLinkVerifiedTitle`, text: `${KEY}.profileLinkVerifiedText` };
  }
  if (method === "none" && isSitter) {
    return { title: `${KEY}.profileLinkNeededTitle`, text: `${KEY}.profileLinkNeededText` };
  }
  return { title: `${KEY}.profileLinkTitle`, text: `${KEY}.profileLinkText` };
}
