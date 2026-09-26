import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PairingWizard from "@/components/collar/PairingWizard";
import { EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({ live: null as unknown as CollarLiveValue, pets: ["Reksas", "Mica"] }));

vi.mock("@/context/CollarLiveContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/CollarLiveContext")>();
  return { ...actual, useCollarLive: () => h.live };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("@/lib/collar/api", () => ({ loadPetNames: async () => h.pets }));

const NOW = Date.parse("2026-09-26T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const paired = (over: Partial<CollarDevice> = {}): CollarDevice => ({
  id: "c9", label: null, is_demo: false, claimed_at: ago(5_000), created_at: ago(5_000),
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

function live(over: Partial<CollarLiveValue> = {}): CollarLiveValue {
  return {
    ...EMPTY_COLLAR_LIVE,
    now: NOW,
    pair: vi.fn(async () => ({ deviceId: "c9", result: "paired" as const })),
    rename: vi.fn(async () => {}),
    startReplay: vi.fn(async () => {}),
    selected: paired(),
    state: "waiting",
    ...over,
  };
}

async function toCodeStep() {
  fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.on.next" }));
  return screen.getByLabelText("appPages.collar.wizard.code.label");
}

async function toChecklist() {
  const input = await toCodeStep();
  fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
  fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
  fireEvent.click(await screen.findByRole("button", { name: "appPages.collar.wizard.name.submit" }));
  await screen.findByText("appPages.collar.wizard.connect.paired");
}

beforeEach(() => {
  h.live = live();
  h.pets = ["Reksas", "Mica"];
});

afterEach(() => vi.useRealTimers());

describe("PairingWizard — the code", () => {
  it("cleans what is typed and pairs with the clean code", async () => {
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7k3q 9d2o" } });
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    await waitFor(() => expect(h.live.pair).toHaveBeenCalledWith("7K3Q9D20"));
  });

  it("keeps the button off until eight characters are in", async () => {
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7K3Q" } });
    expect((screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ["not_found", "appPages.collar.wizard.code.notFound"],
    ["taken", "appPages.collar.wizard.code.taken"],
  ] as const)("explains a %s code", async (result, message) => {
    h.live = live({ pair: vi.fn(async () => ({ deviceId: null, result })) });
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });

  it("keeps the code after a network error", async () => {
    h.live = live({ pair: vi.fn(async () => { throw new Error("Failed to fetch"); }) });
    render(<PairingWizard onClose={() => {}} />);
    const input = (await toCodeStep()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    expect((await screen.findByRole("alert")).textContent).toBe("appPages.collar.wizard.code.network");
    expect(input.value).toBe("7K3Q-9D2M");
  });
});

describe("PairingWizard — who wears it", () => {
  it("offers the user's pets and saves the pick as the collar's name", async () => {
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mica" }));
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.name.submit" }));
    await waitFor(() => expect(h.live.rename).toHaveBeenCalledWith("c9", "Mica"));
  });
});

describe("PairingWizard — connecting", () => {
  it("ticks online as soon as the collar has checked in, and counts satellites", async () => {
    h.live = live({ selected: paired({ last_seen_at: ago(10_000), gps_satellites: 3 }), state: "searching" });
    render(<PairingWizard onClose={() => {}} />);
    await toChecklist();
    expect(screen.getByText("appPages.collar.wizard.connect.online")).toBeTruthy();
    expect(screen.getByText("appPages.collar.wizard.connect.satellitesCount")).toBeTruthy();
  });

  it("says the signal is too weak when it sees four or more satellites without a fix", async () => {
    h.live = live({ selected: paired({ last_seen_at: ago(10_000), gps_satellites: 9 }), state: "searching" });
    render(<PairingWizard onClose={() => {}} />);
    await toChecklist();
    expect(screen.getByText("appPages.collar.wizard.connect.satellitesWeak")).toBeTruthy();
  });

  it("warns after 90 s without a check-in, and can keep waiting", async () => {
    h.live = live({ selected: paired({ claimed_at: ago(91_000) }) });
    render(<PairingWizard onClose={() => {}} />);
    await toChecklist();
    expect(screen.getByText("appPages.collar.wizard.connect.slowTitle")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.connect.keepWaiting" }));
    expect(screen.queryByText("appPages.collar.wizard.connect.slowTitle")).toBeNull();
  });

  it("plays the recorded walk instead, and closes", async () => {
    const onClose = vi.fn();
    render(<PairingWizard onClose={onClose} />);
    await toChecklist();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.connect.playInstead" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.live.startReplay).toHaveBeenCalled();
  });

  it("closes onto the map once the first position arrives", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<PairingWizard onClose={onClose} />);
    await toChecklist();
    vi.useFakeTimers();
    h.live = live({ selected: paired({ last_seen_at: ago(1_000), gps_satellites: 7 }), state: "live" });
    rerender(<PairingWizard onClose={onClose} />);
    expect(screen.getByText("appPages.collar.wizard.connect.done")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1200));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<PairingWizard onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
