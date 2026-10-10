import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const h = vi.hoisted(() => ({ calls: [] as [string, string | null][], fail: false }));

vi.mock("@/lib/oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/oauth")>()),
  signInWithProvider: (provider: string, next: string | null) => {
    h.calls.push([provider, next]);
    return h.fail ? Promise.reject(new Error("provider is not enabled")) : new Promise(() => {});
  },
}));

import SocialLogin from "@/components/SocialLogin";

// Rendered without a LanguageProvider: every string is its dictionary key.

beforeEach(() => {
  h.calls = [];
  h.fail = false;
});

describe("SocialLogin", () => {
  it("shows nothing at all until a provider is switched on", () => {
    const { container } = render(<SocialLogin providers={[]} next={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offers each provider, Google first, then the 'or' before the email form", () => {
    render(<SocialLogin providers={["google", "facebook"]} next={null} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.getAttribute("data-provider"))).toEqual(["google", "facebook"]);
    expect(screen.getByText("auth.social.or")).toBeInTheDocument();
  });

  it("starts the provider's sign-in with the page's next, and waits", async () => {
    render(<SocialLogin providers={["facebook"]} next="/bookings" />);
    const fb = screen.getByRole("button", { name: /auth\.social\.continueWith/ });
    await userEvent.setup().click(fb);
    expect(h.calls).toEqual([["facebook", "/bookings"]]);
    expect(fb).toHaveAttribute("aria-busy", "true");
  });

  it("says so when the provider cannot be reached", async () => {
    h.fail = true;
    render(<SocialLogin providers={["google"]} next={null} />);
    await userEvent.setup().click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("auth.social.failed"));
    expect(screen.getByRole("button")).not.toBeDisabled();
  });
});
