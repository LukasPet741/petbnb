import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BottomNav from "@/components/BottomNav";

// Rendered without a LanguageProvider: every label is its dictionary key.

function renderNav(props: Partial<React.ComponentProps<typeof BottomNav>> = {}) {
  return render(<BottomNav pathname="/bookings" unread={0} onMore={() => {}} {...props} />);
}

describe("BottomNav", () => {
  it("puts the four places a phone needs most under the thumb, in order", () => {
    renderNav();
    const nav = screen.getByRole("navigation", { name: "appShell.sidebar.tabs" });
    expect(within(nav).getAllByRole("link").map((a) => a.getAttribute("href"))).toEqual([
      "/dashboard",
      "/browse",
      "/bookings",
      "/messages",
    ]);
  });

  it("marks the section you are in, nested pages included", () => {
    renderNav({ pathname: "/browse/abc" });
    const current = screen.getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page");
    expect(current.map((a) => a.getAttribute("href"))).toEqual(["/browse"]);
  });

  it("opens everything else from More", async () => {
    const onMore = vi.fn();
    renderNav({ onMore });
    await userEvent.setup().click(screen.getByRole("button", { name: "appShell.sidebar.more" }));
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("counts unread messages on the messages tab, capped at 9+", () => {
    renderNav({ unread: 12 });
    const messages = screen.getByRole("link", { name: /appShell\.sidebar\.nav\.messages/ });
    expect(within(messages).getByText("9+")).toBeInTheDocument();
  });
});
