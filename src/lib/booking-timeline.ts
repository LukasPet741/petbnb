/**
 * Where a booking is on its way from request to done, as four steps for BookingTimeline.
 *
 * "current" is the step the booking is waiting on, not the last one reached: a pending request
 * waits on acceptance, so "accepted" is current. A signed booking whose end has passed waits on
 * the sitter's "mark completed" (enforce_completion_timing allows it only after the end), so
 * "completed" is current.
 *
 * Cancelled and declined return null, as does any status this file does not know: the status
 * badge already says so, and a track stopped halfway reads as a bug.
 */
export type TimelineStepKey = "requested" | "accepted" | "inProgress" | "completed";
export type StepState = "done" | "current" | "todo";
export interface TimelineStep {
  key: TimelineStepKey;
  state: StepState;
}

const KEYS: TimelineStepKey[] = ["requested", "accepted", "inProgress", "completed"];

function withCurrent(current: number): TimelineStep[] {
  return KEYS.map((key, i) => ({ key, state: i < current ? "done" : i === current ? "current" : "todo" }));
}

export function timelineSteps(status: string, endAt: string, now: number): TimelineStep[] | null {
  if (status === "pending") return withCurrent(1);
  if (status === "completed") return withCurrent(KEYS.length);
  if (status !== "signed") return null;
  return withCurrent(now >= Date.parse(endAt) ? 3 : 2);
}
