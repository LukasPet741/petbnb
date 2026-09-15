import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NotFound from "@/app/not-found";
import ErrorPage from "@/app/error";

/**
 * An unknown URL or a crash used to show Next's unstyled default page, with no way back into
 * the site. Rendered without a LanguageProvider, so `t` returns the key it was asked for.
 */

describe("not-found page", () => {
  it("says the page does not exist and links home", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "common.notFound.title" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "common.notFound.home" }).getAttribute("href")).toBe("/");
  });
});

describe("error page", () => {
  it("offers to try again, which re-renders the segment", () => {
    const retry = vi.fn();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={new Error("boom")} unstable_retry={retry} />);
    expect(screen.getByRole("heading", { name: "common.error.title" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "common.error.retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "common.error.home" }).getAttribute("href")).toBe("/");
    log.mockRestore();
  });

  it("logs the error for whoever is debugging, without showing its message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new Error("relation \"profiles\" does not exist");
    render(<ErrorPage error={error} unstable_retry={() => {}} />);
    expect(log).toHaveBeenCalledWith(error);
    expect(screen.queryByText(/relation/)).toBeNull();
    log.mockRestore();
  });
});
