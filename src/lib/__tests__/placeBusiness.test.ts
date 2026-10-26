import { describe, it, expect, vi } from "vitest";
import { claimPlace, earliestRequestDate, fetchOwnerRequests, updateOwnedPlace } from "@/lib/placeBusiness";
import type { CommunityClient } from "@/lib/placeCommunity";

type Err = { code?: string; message: string } | null;

/** A client stand-in: every write answers `error`, every function call answers `rpc`. */
function client(error: Err = null, rpc: { data: unknown; error: Err } = { data: null, error: null }) {
  const writes: unknown[] = [];
  type Filter = PromiseLike<{ error: Err }> & { eq: () => Filter };
  const filter = (): Filter => Object.assign(Promise.resolve({ error }), { eq: () => filter() });
  const c = {
    rpc: vi.fn(() => Promise.resolve(rpc)),
    from: () => ({
      insert: (row: unknown) => (writes.push(row), Promise.resolve({ error })),
      update: (row: unknown) => (writes.push(row), filter()),
      delete: () => filter(),
      select: () => filter(),
    }),
  };
  return { writes, c: c as unknown as CommunityClient };
}

describe("claimPlace", () => {
  it("sends a claim", async () => {
    const { writes, c } = client();
    expect(await claimPlace(c, { placeId: "pl-1", role: "owner", message: "  " })).toBe("sent");
    expect(writes[0]).toEqual({ place_id: "pl-1", role: "owner", message: null });
  });

  it("knows a second claim from the same person", async () => {
    expect(await claimPlace(client({ code: "23505", message: "dup" }).c, { placeId: "pl-1", role: "owner", message: "" })).toBe("already");
  });

  it("knows a place that already has an owner", async () => {
    expect(await claimPlace(client({ code: "42501", message: "rls" }).c, { placeId: "pl-1", role: "owner", message: "" })).toBe("owned");
  });
});

describe("updateOwnedPlace", () => {
  const fields = { descriptionLt: "Aprašas", descriptionEn: " ", hoursLt: "", hoursEn: "", website: "", accepts: ["dog"] };

  it("clears empty fields rather than saving blanks", async () => {
    const { writes, c } = client();
    await updateOwnedPlace(c, "pl-1", fields);
    expect(writes[0]).toMatchObject({ description_lt: "Aprašas", description_en: null, website_url: null, accepts: ["dog"] });
  });

  it("refuses a website that is not https before it reaches the database", async () => {
    const { writes, c } = client();
    expect((await updateOwnedPlace(c, "pl-1", { ...fields, website: "http://example.lt" }))?.code).toBe("website");
    expect(writes).toHaveLength(0);
  });
});

describe("fetchOwnerRequests", () => {
  it("answers null when the business tables are not live", async () => {
    expect(await fetchOwnerRequests(client(null, { data: null, error: { code: "PGRST202", message: "missing" } }).c)).toBeNull();
  });

  it("reads the owner's view of each request", async () => {
    const rows = [{ id: "b1", place_slug: "dogiday", place_name: "Dogiday", service_name: "Grooming", preferred_date: "2026-11-02",
      preferred_time: "morning", note: null, status: "requested", response_note: null, created_at: "2026-10-26T10:00:00Z",
      requester: "Jonas J.", pet_name: "Murka", pet_type: "cat", pet_weight_kg: "4.0" }];
    const [r] = (await fetchOwnerRequests(client(null, { data: rows, error: null }).c))!;
    expect(r).toMatchObject({ placeName: "Dogiday", requester: "Jonas J.", petName: "Murka", petWeightKg: 4, preferredTime: "morning" });
  });
});

describe("earliestRequestDate", () => {
  it("is tomorrow, in local time, across a month's end", () => {
    expect(earliestRequestDate(new Date(2026, 9, 31, 23, 30))).toBe("2026-11-01");
  });
});
