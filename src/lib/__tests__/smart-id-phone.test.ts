import { describe, it, expect } from "vitest";
import { phoneScreen, NOTIFICATION_MS, PIN_DIGIT_MS } from "@/lib/smart-id-phone";

const waiting = { name: "waiting" as const, code: "4127" };

describe("phoneScreen", () => {
  it("shows the lock screen before a session starts", () => {
    expect(phoneScreen({ name: "idle" }, 0)).toEqual({ kind: "lock" });
    expect(phoneScreen({ name: "starting" }, 0)).toEqual({ kind: "lock" });
  });

  it("shows the notification the moment the code appears", () => {
    expect(phoneScreen(waiting, 0)).toEqual({ kind: "notification" });
    expect(phoneScreen(waiting, NOTIFICATION_MS - 1)).toEqual({ kind: "notification" });
  });

  it("opens the app with the same code and fills one PIN dot every 0.4 s", () => {
    expect(phoneScreen(waiting, NOTIFICATION_MS)).toEqual({ kind: "pin", code: "4127", filled: 0 });
    expect(phoneScreen(waiting, NOTIFICATION_MS + PIN_DIGIT_MS)).toEqual({ kind: "pin", code: "4127", filled: 1 });
    expect(phoneScreen(waiting, NOTIFICATION_MS + 3 * PIN_DIGIT_MS)).toEqual({ kind: "pin", code: "4127", filled: 3 });
  });

  it("waits on 'confirming' once the PIN is in, until SK answers", () => {
    expect(phoneScreen(waiting, NOTIFICATION_MS + 4 * PIN_DIGIT_MS)).toEqual({ kind: "confirming", code: "4127" });
    expect(phoneScreen(waiting, 60_000)).toEqual({ kind: "confirming", code: "4127" });
  });

  it.each([
    ["ok", "confirmed"],
    ["refused", "cancelled"],
    ["wrong_code", "wrong_code"],
    ["timeout", "expired"],
  ] as const)("ends %s as %s", (outcome, ending) => {
    expect(phoneScreen({ name: "done", outcome }, 0)).toEqual({ kind: "ending", ending });
  });

  it("an answer skips the animation, whenever it comes", () => {
    expect(phoneScreen({ name: "done", outcome: "ok" }, NOTIFICATION_MS + 1)).toEqual({ kind: "ending", ending: "confirmed" });
  });

  it("errors leave the lock screen: the phone never heard of the request", () => {
    expect(phoneScreen({ name: "done", outcome: "error" }, 5_000)).toEqual({ kind: "lock" });
  });
});
