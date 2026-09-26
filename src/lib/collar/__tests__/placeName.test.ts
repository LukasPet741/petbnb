import { describe, it, expect, vi } from "vitest";
import { createPlaceLookup, PLACE_MIN_INTERVAL_MS } from "@/lib/collar/placeName";

const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response;

function setup(body: unknown = { name: "Vingio parkas", address: { city: "Vilnius" } }, ok = true) {
  let now = 1_000_000;
  const fetchImpl = vi.fn(async () => answer(body, ok));
  const lookup = createPlaceLookup(fetchImpl as unknown as typeof fetch, () => now);
  return { fetchImpl, lookup, advance: (ms: number) => { now += ms; } };
}

describe("createPlaceLookup", () => {
  it("asks Nominatim in the page's language and returns the place name", async () => {
    const { fetchImpl, lookup } = setup();
    expect(await lookup(54.683, 25.233, "lt")).toBe("Vingio parkas");
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect(url).toContain("accept-language=lt");
  });

  it("does not ask again within a minute", async () => {
    const { fetchImpl, lookup, advance } = setup();
    await lookup(54.683, 25.233, "en");
    advance(PLACE_MIN_INTERVAL_MS - 1);
    expect(await lookup(54.70, 25.30, "en")).toBe("Vingio parkas");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not ask again after a minute if the collar moved under 150 m", async () => {
    const { fetchImpl, lookup, advance } = setup();
    await lookup(54.683, 25.233, "en");
    advance(PLACE_MIN_INTERVAL_MS + 1);
    await lookup(54.6835, 25.2335, "en");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("asks again after a minute and more than 150 m", async () => {
    const { fetchImpl, lookup, advance } = setup();
    await lookup(54.683, 25.233, "en");
    advance(PLACE_MIN_INTERVAL_MS + 1);
    await lookup(54.686, 25.233, "en");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to the neighbourhood when the place has no name", async () => {
    const { lookup } = setup({ name: "", address: { neighbourhood: "Žvėrynas" } });
    expect(await lookup(54.69, 25.25, "lt")).toBe("Žvėrynas");
  });

  it("returns null on failure and backs off instead of retrying at once", async () => {
    const { fetchImpl, lookup } = setup({}, false);
    expect(await lookup(54.683, 25.233, "en")).toBeNull();
    expect(await lookup(54.683, 25.233, "en")).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
