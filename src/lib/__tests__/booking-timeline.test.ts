import { describe, it, expect } from "vitest";
import { timelineSteps } from "@/lib/booking-timeline";

const END = "2026-10-03T09:00:00+03:00";
const at = (iso: string) => Date.parse(iso);
const states = (steps: ReturnType<typeof timelineSteps>) => steps?.map((s) => s.state);

describe("timelineSteps", () => {
  it("pending: the request is sent and acceptance is what it waits on", () => {
    expect(states(timelineSteps("pending", END, at("2026-09-22T12:00:00+03:00")))).toEqual(["done", "current", "todo", "todo"]);
  });

  it("signed before the stay: accepted, the stay is next", () => {
    expect(states(timelineSteps("signed", END, at("2026-09-30T12:00:00+03:00")))).toEqual(["done", "done", "current", "todo"]);
  });

  it("signed during the stay: in progress", () => {
    expect(states(timelineSteps("signed", END, at("2026-10-02T12:00:00+03:00")))).toEqual(["done", "done", "current", "todo"]);
  });

  it("signed at or after the end: waiting for the sitter to mark it completed", () => {
    expect(states(timelineSteps("signed", END, at(END)))).toEqual(["done", "done", "done", "current"]);
    expect(states(timelineSteps("signed", END, at("2026-10-04T12:00:00+03:00")))).toEqual(["done", "done", "done", "current"]);
  });

  it("completed: every step done", () => {
    expect(states(timelineSteps("completed", END, at("2026-10-05T12:00:00+03:00")))).toEqual(["done", "done", "done", "done"]);
  });

  it("cancelled, declined and unknown statuses have no timeline, since the badge already says it", () => {
    for (const status of ["cancelled", "declined", "something-new"]) {
      expect(timelineSteps(status, END, at("2026-09-22T12:00:00+03:00"))).toBeNull();
    }
  });

  it("keeps the step order fixed", () => {
    expect(timelineSteps("pending", END, 0)?.map((s) => s.key)).toEqual(["requested", "accepted", "inProgress", "completed"]);
  });
});
