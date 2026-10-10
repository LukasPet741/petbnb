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
}));

vi.mock("@/lib/data-export", () => ({
  collectMyData: h.collect,
  exportFilename: () => "petbnb-my-data-2026-10-10.json",
}));
vi.mock("@/lib/download", () => ({ downloadFile: h.download }));
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
