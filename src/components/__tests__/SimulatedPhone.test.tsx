import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SimulatedPhone from "@/components/SimulatedPhone";
import type { PhoneScreen } from "@/lib/smart-id-phone";

const show = (s: PhoneScreen) => render(<SimulatedPhone screen={s} clock="14:05" date="Saturday, 26 September" />);

describe("SimulatedPhone", () => {
  it("is always captioned as simulated", () => {
    show({ kind: "lock" });
    expect(screen.getByText("appPages.smartIdDemo.phoneCaption")).toBeTruthy();
    expect(screen.getAllByText("14:05").length).toBeGreaterThan(0);
  });

  it("shows the notification with SK's display text", () => {
    show({ kind: "notification" });
    expect(screen.getByText("Prisijungimas prie PetBnB (demo)")).toBeTruthy();
    expect(screen.getByText("appPages.smartIdDemo.phone.tapToConfirm")).toBeTruthy();
  });

  it("shows the same code and fills the PIN dots", () => {
    const { container } = show({ kind: "pin", code: "4127", filled: 3 });
    expect(screen.getByText("4127")).toBeTruthy();
    expect(screen.getByText("appPages.smartIdDemo.phone.enterPin")).toBeTruthy();
    expect(container.querySelectorAll("[data-pin-dot='filled']")).toHaveLength(3);
    expect(container.querySelectorAll("[data-pin-dot]")).toHaveLength(4);
  });

  it("says confirming once the PIN is in", () => {
    show({ kind: "confirming", code: "4127" });
    expect(screen.getByText("appPages.smartIdDemo.phone.confirming")).toBeTruthy();
  });

  it.each([
    ["confirmed", "appPages.smartIdDemo.phone.confirmed"],
    ["cancelled", "appPages.smartIdDemo.phone.cancelled"],
    ["wrong_code", "appPages.smartIdDemo.phone.wrongCode"],
    ["expired", "appPages.smartIdDemo.phone.expired"],
  ] as const)("shows the %s ending", (ending, title) => {
    show({ kind: "ending", ending });
    expect(screen.getByText(title)).toBeTruthy();
  });
});
