import { describe, it, expect } from "vitest";
import { sitterBlocker } from "@/lib/sitter-blocker";

/**
 * Whether the sitter named in /bookings/new?sitter=… can be booked by this user at all.
 *
 * The form used to take the id from the URL on trust: a stale link, a link to somebody
 * who is not a sitter, or a sitter's link to their own profile all produced the full form,
 * and the user found out only after filling it in, from the generic submit error. The
 * database refuses every one of those inserts, so the page's job is to say so first.
 */

const sitter = { id: "sitter-1", is_sitter: true };

describe("sitterBlocker", () => {
  it("says nothing while the profile is still loading", () => {
    // undefined is "not fetched yet"; flashing "not found" before the fetch lands would
    // be a lie for every valid link.
    expect(sitterBlocker(undefined, "owner-1")).toBeNull();
  });

  it("reports a sitter that does not exist", () => {
    expect(sitterBlocker(null, "owner-1")).toBe("sitterNotFound");
  });

  it("lets a real sitter be booked", () => {
    expect(sitterBlocker(sitter, "owner-1")).toBeNull();
  });

  it("refuses your own profile", () => {
    expect(sitterBlocker(sitter, "sitter-1")).toBe("ownProfile");
  });

  it("names your own profile even when you are not a sitter", () => {
    // Both are true; "this is you" is the one that explains it.
    expect(sitterBlocker({ id: "owner-1", is_sitter: false }, "owner-1")).toBe("ownProfile");
  });

  it("refuses a profile that is not a sitter", () => {
    expect(sitterBlocker({ id: "owner-2", is_sitter: false }, "owner-1")).toBe("notASitter");
  });

  it("fails closed when is_sitter is anything but true", () => {
    expect(sitterBlocker({ id: "x", is_sitter: null } as unknown as typeof sitter, "owner-1")).toBe(
      "notASitter",
    );
  });

  it("refuses a sitter who has not verified their identity yet", () => {
    // enforce_sitter_verified refuses the insert; a sitter who just signed up is listed in
    // browse but was answered only by the generic submit error.
    expect(sitterBlocker({ ...sitter, verification_method: "none" }, "owner-1")).toBe("notVerified");
  });

  it("lets a seeded or Smart-ID-verified sitter be booked", () => {
    expect(sitterBlocker({ ...sitter, verification_method: "seed" }, "owner-1")).toBeNull();
    expect(sitterBlocker({ ...sitter, verification_method: "smart_id_demo" }, "owner-1")).toBeNull();
  });

  it("names your own profile before your verification", () => {
    expect(sitterBlocker({ ...sitter, verification_method: "none" }, "sitter-1")).toBe("ownProfile");
  });

  it("does not match a signed-out user to a profile", () => {
    // The (app) layout gates on auth, but an undefined id must never equal anything.
    expect(sitterBlocker(sitter, undefined)).toBeNull();
  });
});
