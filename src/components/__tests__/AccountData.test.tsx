import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AccountData from "@/components/AccountData";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmProvider } from "@/components/ui/Confirm";

/**
 * The "Your data" card on /profile: download everything (GDPR art. 15/20). Rendered without
 * a LanguageProvider, so each string is its key.
 */

const h = vi.hoisted(() => ({
  collect: vi.fn(),
  download: vi.fn(),
  erase: vi.fn(),
  push: vi.fn(),
  profile: { full_name: "Rūta Petraitė" } as { full_name: string | null },
}));

vi.mock("@/lib/data-export", () => ({
  collectMyData: h.collect,
  exportFilename: () => "petbnb-my-data-2026-10-10.json",
}));
vi.mock("@/lib/download", () => ({ downloadFile: h.download }));
vi.mock("@/lib/erase-account", () => ({ eraseMyAccount: h.erase }));
vi.mock("@/hooks/useProfile", () => ({ useProfile: () => ({ profile: h.profile }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push, replace: h.push }) }));
const auth = vi.hoisted(() => ({ user: { id: "u1", email: "owner@example.test" } }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

const renderCard = () =>
  render(
    <ToastProvider>
      <ConfirmProvider>
        <AccountData />
      </ConfirmProvider>
    </ToastProvider>,
  );

beforeEach(() => {
  h.collect.mockReset();
  h.download.mockReset();
  h.erase.mockReset();
  h.push.mockReset();
  h.profile = { full_name: "Rūta Petraitė" };
});

describe("AccountData: download my data", () => {
  it("downloads everything as one JSON file named for the day", async () => {
    h.collect.mockResolvedValue({ format: "petbnb-my-data/1", pets: [] });
    renderCard();
    await userEvent.setup().click(screen.getByRole("button", { name: "appPages.profile.data.downloadButton" }));
    await waitFor(() => expect(h.download).toHaveBeenCalledTimes(1));
    expect(h.collect).toHaveBeenCalledWith(auth.user);
    const [name, text, type] = h.download.mock.calls[0];
    expect(name).toBe("petbnb-my-data-2026-10-10.json");
    expect(JSON.parse(text)).toEqual({ format: "petbnb-my-data/1", pets: [] });
    expect(type).toMatch(/^application\/json/);
  });

  it("says so when the data cannot be gathered, and downloads nothing", async () => {
    h.collect.mockRejectedValue(new Error("permission denied"));
    renderCard();
    await userEvent.setup().click(screen.getByRole("button", { name: "appPages.profile.data.downloadButton" }));
    expect(await screen.findByText("appPages.profile.data.downloadFailed")).toBeInTheDocument();
    expect(h.download).not.toHaveBeenCalled();
  });
});

describe("AccountData: delete my account", () => {
  const open = async () => {
    const user = userEvent.setup();
    renderCard();
    await user.click(screen.getByRole("button", { name: "appPages.profile.data.deleteButton" }));
    await screen.findByRole("dialog", { name: "appPages.profile.data.deleteTitle" });
    return user;
  };
  const confirmButton = () => screen.getByRole("button", { name: "appPages.profile.data.deleteConfirmButton" });
  const field = () => screen.getByLabelText(/appPages\.profile\.data\.deleteTypeName/);

  it("asks for the name typed out before it deletes anything", async () => {
    const user = await open();
    expect(confirmButton()).toBeDisabled();
    await user.type(field(), "Rūta");
    expect(confirmButton()).toBeDisabled();
    await user.clear(field());
    await user.type(field(), "  rūta petraitė ");
    expect(confirmButton()).toBeEnabled();
    expect(h.erase).not.toHaveBeenCalled();
  });

  it("deletes the account and leaves for the home page", async () => {
    h.erase.mockResolvedValue("erased");
    const user = await open();
    await user.type(field(), "Rūta Petraitė");
    await user.click(confirmButton());
    await waitFor(() => expect(h.push).toHaveBeenCalledWith("/"));
    expect(h.erase).toHaveBeenCalledWith("u1", "Rūta Petraitė");
  });

  it("explains a refusal while a booking is open, and stays", async () => {
    h.erase.mockResolvedValue("open-bookings");
    const user = await open();
    await user.type(field(), "Rūta Petraitė");
    await user.click(confirmButton());
    expect(await screen.findByText("appPages.profile.data.deleteOpenBookings")).toBeInTheDocument();
    expect(h.push).not.toHaveBeenCalled();
  });

  it("asks for the confirm word when the profile has no name", async () => {
    h.profile = { full_name: null };
    const user = await open();
    await user.type(field(), "appPages.profile.data.deleteWord");
    expect(confirmButton()).toBeEnabled();
  });
});
