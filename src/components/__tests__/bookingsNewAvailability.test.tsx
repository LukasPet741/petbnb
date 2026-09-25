import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import NewBookingPage from "@/app/(app)/bookings/new/page";

/**
 * The booking form says a sitter is not free before the request is sent: a day off blocks
 * (the database would refuse it), a booked day only warns (the database compares hours).
 * A clash that slips through anyway is named from the database hint, not the generic error.
 *
 * Rendered without a LanguageProvider, so `t` is the identity function.
 */

const h = vi.hoisted(() => ({
  busy: [] as { day: string; kind: string }[],
  createError: null as null | { message: string; hint: string },
  push: vi.fn(),
  params: new URLSearchParams("sitter=s1"),
  sitter: {
    id: "s1", full_name: "Rūta K.", city: "Kaunas", avatar_url: null, is_sitter: true,
    verification_method: "seed", services: { walking: true }, prices: { walking: { amount: 10, days: 1 } },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
  useSearchParams: () => h.params,
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "o1" } }) }));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    rpc: (name: string) =>
      Promise.resolve(
        name === "sitter_busy_days"
          ? { data: h.busy, error: null }
          : { data: null, error: h.createError },
      ),
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "profiles"
            ? { maybeSingle: () => Promise.resolve({ data: h.sitter, error: null }) }
            : Promise.resolve({ data: [{ id: "p1", name: "Rex" }], error: null }),
      }),
    }),
  },
}));

const submit = () => screen.getByRole("button", { name: /appPages\.bookingsNew\.sendRequestButton/ });

async function typeStay() {
  render(<NewBookingPage />);
  // Wait for the only service to be preselected and the pet to load, or typing races them.
  await waitFor(() => expect(screen.getByRole("radio", { name: /common.services.walking/ })).toBeChecked());
  await screen.findByDisplayValue("Rex");
  fireEvent.change(screen.getByLabelText(/appPages\.bookingsNew\.startLabel/), { target: { value: "2026-10-12T10:00" } });
  fireEvent.change(screen.getByLabelText(/appPages\.bookingsNew\.endLabel/), { target: { value: "2026-10-13T10:00" } });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-10-10T12:00:00+03:00"));
  h.busy = [];
  h.createError = null;
  h.push.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("/bookings/new availability", () => {
  it("blocks a stay touching a day off", async () => {
    h.busy = [{ day: "2026-10-12", kind: "off" }];
    await typeStay();
    expect(await screen.findByRole("alert")).toHaveTextContent("appPages.bookingsNew.sitterUnavailable");
    expect(submit()).toBeDisabled();
  });

  it("only warns about a booked day", async () => {
    h.busy = [{ day: "2026-10-12", kind: "booked" }];
    await typeStay();
    expect(await screen.findByText("appPages.bookingsNew.busyWarning")).not.toHaveAttribute("role", "alert");
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("names a clash the database found", async () => {
    h.createError = { message: "The sitter is not free for these dates", hint: "already_booked" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await typeStay();
    await waitFor(() => expect(submit()).toBeEnabled());
    fireEvent.click(submit());
    expect(await screen.findByText("appPages.bookingsNew.alreadyBooked")).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });
});
