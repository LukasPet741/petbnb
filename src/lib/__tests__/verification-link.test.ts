import { describe, it, expect } from "vitest";
import { verificationLinkCopy } from "@/lib/verification-link";

/**
 * The Smart-ID link on /profile. A sitter who has not verified cannot be booked
 * (enforce_sitter_verified), so for them the link is the step that makes them bookable,
 * not an optional demo to try.
 */

const KEY = "appPages.smartIdDemo";

describe("verificationLinkCopy", () => {
  it("tells an unverified sitter that verifying is what makes them bookable", () => {
    expect(verificationLinkCopy("none", true)).toEqual({
      title: `${KEY}.profileLinkNeededTitle`,
      text: `${KEY}.profileLinkNeededText`,
    });
  });

  it("offers the demo to someone who is not a sitter", () => {
    expect(verificationLinkCopy("none", false)).toEqual({
      title: `${KEY}.profileLinkTitle`,
      text: `${KEY}.profileLinkText`,
    });
  });

  it("offers the demo to a seeded sitter, who is already bookable", () => {
    expect(verificationLinkCopy("seed", true)).toEqual({
      title: `${KEY}.profileLinkTitle`,
      text: `${KEY}.profileLinkText`,
    });
  });

  it("says a demo verification is done", () => {
    expect(verificationLinkCopy("smart_id_demo", true)).toEqual({
      title: `${KEY}.profileLinkVerifiedTitle`,
      text: `${KEY}.profileLinkVerifiedText`,
    });
  });

  it("does not nag while the profile is still loading", () => {
    expect(verificationLinkCopy(undefined, true)).toEqual({
      title: `${KEY}.profileLinkTitle`,
      text: `${KEY}.profileLinkText`,
    });
  });
});
