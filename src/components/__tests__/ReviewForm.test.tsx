import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewForm from "@/components/ReviewForm";

// Like the rest of the review components this renders without a LanguageProvider,
// so the default `t` is the identity function and every visible string is the
// translation key it asked for. Buttons are therefore addressed by role and key.
//
// ReviewForm owns no data access. It is handed a submit callback and reports what
// the user entered; whether that becomes an INSERT or an UPDATE is useMyReviews's
// problem. That split is what makes these tests free of Supabase mocks.

const POST = "sitters.reviews.form.post";
const CANCEL = "sitters.reviews.form.cancel";

function renderForm(props: Partial<React.ComponentProps<typeof ReviewForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onCancel = vi.fn();
  render(<ReviewForm onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  return { onSubmit, onCancel };
}

describe("ReviewForm", () => {
  it("cannot be posted before a rating is chosen", async () => {
    // rating is NOT NULL with a 1-5 CHECK, so an unrated submit is a guaranteed
    // round trip to a 400. The body is the optional half, not the rating.
    const { onSubmit } = renderForm();

    const post = screen.getByRole("button", { name: POST });
    expect((post as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(post);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("can be posted once a rating is chosen, with nothing written", async () => {
    // A star with no words is a complete review. Requiring text would cost most of
    // them.
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[4]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ rating: 5, body: null });
  });

  it("sends an untouched textarea as null, never as an empty string", async () => {
    // `check (body is null or char_length(btrim(body)) between 1 and 2000)` rejects
    // "" outright. This is the rule that keeps a blank review legal.
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[2]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 3, body: null });
  });

  it("sends whitespace-only text as null too", async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[2]);
    await userEvent.type(screen.getByRole("textbox"), "   ");
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 3, body: null });
  });

  it("sends what was written, trimmed", async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[3]);
    await userEvent.type(screen.getByRole("textbox"), "  Lovely with our dog.  ");
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, body: "Lovely with our dog." });
  });

  it("opens prefilled when an existing review is being edited", async () => {
    // The edit path reopens this same form. Starting it empty would look like the
    // previous review had been thrown away.
    renderForm({ initialRating: 2, initialBody: "Late twice." });

    const checked = (screen.getAllByRole("radio") as HTMLInputElement[]).filter((r) => r.checked);
    expect(Number(checked[0].value)).toBe(2);
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Late twice.");
  });

  it("can be posted immediately when editing, without touching the stars again", async () => {
    const { onSubmit } = renderForm({ initialRating: 2, initialBody: "Late twice." });

    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 2, body: "Late twice." });
  });

  it("lets an existing review's text be cleared back to null", async () => {
    // Changing your mind about the words while keeping the stars has to be
    // expressible, and the way to express it is NULL rather than "".
    const { onSubmit } = renderForm({ initialRating: 4, initialBody: "Some words." });

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, body: null });
  });

  it("abandons the form without submitting when cancelled", async () => {
    const { onSubmit, onCancel } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[0]);
    await userEvent.click(screen.getByRole("button", { name: CANCEL }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("refuses a second submit while the first is still in flight", async () => {
    // booking_id is UNIQUE, so a double-post races itself and the loser comes back
    // as 23505. Not sending it twice is cheaper than explaining that.
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));
    render(<ReviewForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await userEvent.click(screen.getAllByRole("radio")[4]);
    const post = screen.getByRole("button", { name: POST });
    await userEvent.click(post);
    await userEvent.click(post);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows a failure without emptying the form", async () => {
    // Losing what somebody wrote because the network blinked is the one outcome
    // that guarantees they do not write it again.
    renderForm({ initialRating: 3, initialBody: "Worth keeping.", error: "sitters.reviews.form.error" });

    expect(screen.getByText("sitters.reviews.form.error")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Worth keeping.");
  });
});
