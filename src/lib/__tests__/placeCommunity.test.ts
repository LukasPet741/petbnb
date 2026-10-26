import { describe, it, expect, vi } from "vitest";
import { fetchCommunity, parseCommunity, reportContent, saveReview, type CommunityClient } from "@/lib/placeCommunity";

/** The stand-ins below carry just what each test touches. */
const asClient = (c: unknown) => c as CommunityClient;

const raw = {
  place_id: "pl-1",
  rating: { average: "4.5", count: 2 },
  reviews: [{ id: "r1", rating: 5, body: "Puiki vieta", created_at: "2026-10-20T10:00:00Z", author: "Emilija A.", mine: true }],
  posts: [{ id: "p1", body: "Reksas was here", created_at: "2026-10-21T10:00:00Z", author: "Jonas", mine: false, pet_name: "Reksas", pet_type: "dog", pet_id: null }],
  pets: [{ id: "pet-1", name: "Reksas", type: "dog", photo_url: null }],
};

describe("parseCommunity", () => {
  it("reads the function's JSON into the panel's shape", () => {
    const c = parseCommunity(raw);
    expect(c.placeId).toBe("pl-1");
    expect(c.average).toBe(4.5);
    expect(c.count).toBe(2);
    expect(c.reviews[0]).toEqual({ id: "r1", rating: 5, body: "Puiki vieta", createdAt: "2026-10-20T10:00:00Z", author: "Emilija A.", mine: true });
    expect(c.posts[0]).toMatchObject({ petName: "Reksas", petId: null, mine: false });
    expect(c.pets[0]).toEqual({ id: "pet-1", name: "Reksas", type: "dog", photoUrl: null });
  });

  it("has no average before the first review", () => {
    expect(parseCommunity({ ...raw, rating: { average: null, count: 0 }, reviews: [] }).average).toBeNull();
  });
});

const rpcClient = (answer: { data: unknown; error: { code?: string; message: string } | null }) => ({ rpc: vi.fn(() => Promise.resolve(answer)), from: vi.fn() });

describe("fetchCommunity", () => {
  it("answers null when the community tables are not live yet", async () => {
    expect(await fetchCommunity(asClient(rpcClient({ data: null, error: { code: "PGRST202", message: "missing" } })), "dogiday")).toBeNull();
  });

  it("answers null for a place the function does not know", async () => {
    expect(await fetchCommunity(asClient(rpcClient({ data: null, error: null })), "nope")).toBeNull();
  });

  it("parses what the function returns", async () => {
    const client = rpcClient({ data: raw, error: null });
    expect((await fetchCommunity(asClient(client), "dogiday"))?.count).toBe(2);
    expect(client.rpc).toHaveBeenCalledWith("place_community", { p_slug: "dogiday" });
  });
});

/** A table stand-in that records what was written. */
function tableClient(result: { error: { code?: string; message: string } | null } = { error: null }) {
  const calls: unknown[][] = [];
  type Filter = PromiseLike<typeof result> & { eq: (c: string, v: string) => Filter };
  const filter = (): Filter =>
    Object.assign(Promise.resolve(result), { eq: (c: string, v: string) => (calls.push(["eq", c, v]), filter()) });
  const table = {
    insert: (row: object) => (calls.push(["insert", row]), Promise.resolve(result)),
    update: (row: object) => (calls.push(["update", row]), filter()),
    delete: () => (calls.push(["delete"]), filter()),
    select: () => filter(),
  };
  return { calls, client: { rpc: vi.fn(), from: vi.fn((name: string) => (calls.push(["from", name]), table)) } };
}

describe("saveReview", () => {
  it("adds a first review with the place's id", async () => {
    const { calls, client } = tableClient();
    await saveReview(asClient(client), { placeId: "pl-1", rating: 4, body: "  Gera  " });
    expect(calls).toContainEqual(["insert", { place_id: "pl-1", rating: 4, body: "Gera" }]);
  });

  it("changes only the rating and words of one already written", async () => {
    const { calls, client } = tableClient();
    await saveReview(asClient(client), { placeId: "pl-1", rating: 2, body: "", reviewId: "r1" });
    expect(calls).toContainEqual(["update", { rating: 2, body: null }]);
    expect(calls).toContainEqual(["eq", "id", "r1"]);
  });
});

describe("reportContent", () => {
  it("counts a second report of the same thing as already reported", async () => {
    const { client } = tableClient({ error: { code: "23505", message: "duplicate" } });
    expect(await reportContent(asClient(client), { targetType: "place_review", targetId: "r1", reason: "spam" })).toBe("already");
  });

  it("files a report", async () => {
    const { calls, client } = tableClient();
    expect(await reportContent(asClient(client), { targetType: "place_post", targetId: "p1", reason: "offensive", details: " rude " })).toBe("sent");
    expect(calls).toContainEqual(["insert", { target_type: "place_post", target_id: "p1", reason: "offensive", details: "rude" }]);
  });
});
