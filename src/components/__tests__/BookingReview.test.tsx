import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BookingReview from "@/components/BookingReview";
import type { Review } from "@/lib/types";

// No LanguageProvider, so `t` is the identity function and visible strings are the
// translation keys themselves.

const LEAVE = "sitters.reviews.form.leave";
const EDIT = "sitters.reviews.form.edit";
const POST = "sitters.reviews.form.post";
const CANCEL = "sitters.reviews.form.cancel";

const target = { bookingId: "b-1", sitterId: "sitter-1", ownerId: "owner-1" };

function existingReview(over: Partial<Review> = {}): Review {
  return {
    id: "r-1",
    booking_id: "b-1",
    owner_id: "owner-1",
    sitter_id: "sitter-1",
    rating: 4,
    body: "He was great with Rex.",
    created_at: "2026-09-01T10:00:00Z",
    ...over,
  };
}

// onSave reports whether the review reached the database. The form closes only on
// true — useMyReviews records a failure in state rather than throwing, so a promise
// that merely resolved would close the form over a review that was never saved.
function renderReview(props: Partial<React.ComponentProps<typeof BookingReview>> = {}) {
  const onSave = vi.fn().mockResolvedValue(true);
  render(<BookingReview target={target} review={undefined} onSave={onSave} error={null} {...props} />);
  return { onSave };
}

describe("BookingReview — nothing written yet", () => {
  it("invites a review rather than showing an empty form", async () => {
    // A form open on every completed booking would bury the list under textareas.
    renderReview();
    expect(screen.getByRole("button", { name: LEAVE })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens the form when the invitation is taken", async () => {
    renderReview();
    await userEvent.click(screen.getByRole("button", { name: LEAVE }));
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("goes back to the invitation when the form is cancelled", async () => {
    renderReview();
    await userEvent.click(screen.getByRole("button", { name: LEAVE }));
    await userEvent.click(screen.getByRole("button", { name: CANCEL }));

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("button", { name: LEAVE })).toBeTruthy();
  });

  it("saves against the booking it belongs to", async () => {
    // The bookings list renders many of these. Sending the wrong booking id would
    // attach a review to somebody else's stay, which RLS would reject — but only
    // after the user watched it appear to work.
    const { onSave } = renderReview();

    await userEvent.click(screen.getByRole("button", { name: LEAVE }));
    await userEvent.click(screen.getAllByRole("radio")[4]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSave).toHaveBeenCalledWith(target, { rating: 5, body: null });
  });

  it("closes the form once the review is saved", async () => {
    const { onSave } = renderReview();

    await userEvent.click(screen.getByRole("button", { name: LEAVE }));
    await userEvent.click(screen.getAllByRole("radio")[4]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });

  it("keeps the form open when the write was refused", async () => {
    // Closing it would throw away what they wrote and leave no sign of the failure.
    // This is the shape useMyReviews actually returns on an RLS refusal: a resolved
    // promise carrying false, not a rejection.
    const onSave = vi.fn().mockResolvedValue(false);
    render(<BookingReview target={target} review={undefined} onSave={onSave} error="sitters.reviews.form.error" />);

    await userEvent.click(screen.getByRole("button", { name: LEAVE }));
    await userEvent.click(screen.getAllByRole("radio")[0]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("keeps the form open when the save throws outright", async () => {
    // Belt and braces: a network error inside the client rejects rather than
    // resolving false, and must not be mistaken for success either.
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    render(<BookingReview target={target} review={undefined} onSave={onSave} error="sitters.reviews.form.error" />);

    await userEvent.click(screen.getByRole("button", { name: LEAVE }));
    await userEvent.click(screen.getAllByRole("radio")[0]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(screen.getByRole("textbox")).toBeTruthy();
  });
});

describe("BookingReview — already reviewed", () => {
  it("shows the review instead of inviting another one", () => {
    // booking_id is UNIQUE: there is no second review to leave.
    renderReview({ review: existingReview() });

    expect(screen.queryByRole("button", { name: LEAVE })).toBeNull();
    expect(screen.getByText("He was great with Rex.")).toBeTruthy();
  });

  it("offers to edit it", () => {
    renderReview({ review: existingReview() });
    expect(screen.getByRole("button", { name: EDIT })).toBeTruthy();
  });

  it("never offers to delete it", () => {
    // Deliberate product decision: a sitter who asks nicely must not be able to get
    // a bad review removed. The RLS permits DELETE; this UI does not expose it.
    renderReview({ review: existingReview() });
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons.some((label) => label?.includes("delete"))).toBe(false);
  });

  it("reopens the form prefilled with what was written", async () => {
    renderReview({ review: existingReview({ rating: 2, body: "Late twice." }) });

    await userEvent.click(screen.getByRole("button", { name: EDIT }));

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Late twice.");
    const checked = (screen.getAllByRole("radio") as HTMLInputElement[]).filter((r) => r.checked);
    expect(Number(checked[0].value)).toBe(2);
  });

  it("renders a review that has stars but no words", () => {
    // body is nullable and a rating alone is a complete review.
    renderReview({ review: existingReview({ body: null }) });
    expect(screen.getByRole("button", { name: EDIT })).toBeTruthy();
  });
});
