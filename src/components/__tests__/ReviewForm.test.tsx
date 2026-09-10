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
  render(<ReviewForm direction="owner_to_sitter" onSubmit={onSubmit} onCancel={onCancel} {...props} />);
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
    expect(onSubmit).toHaveBeenCalledWith({ rating: 5, body: null, dimensions: {} });
  });

  it("sends an untouched textarea as null, never as an empty string", async () => {
    // `check (body is null or char_length(btrim(body)) between 1 and 2000)` rejects
    // "" outright. This is the rule that keeps a blank review legal.
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[2]);
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 3, body: null, dimensions: {} });
  });

  it("sends whitespace-only text as null too", async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[2]);
    await userEvent.type(screen.getByRole("textbox"), "   ");
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 3, body: null, dimensions: {} });
  });

  it("sends what was written, trimmed", async () => {
    const { onSubmit } = renderForm();

    await userEvent.click(screen.getAllByRole("radio")[3]);
    await userEvent.type(screen.getByRole("textbox"), "  Lovely with our dog.  ");
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, body: "Lovely with our dog.", dimensions: {} });
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

    expect(onSubmit).toHaveBeenCalledWith({ rating: 2, body: "Late twice.", dimensions: {} });
  });

  it("lets an existing review's text be cleared back to null", async () => {
    // Changing your mind about the words while keeping the stars has to be
    // expressible, and the way to express it is NULL rather than "".
    const { onSubmit } = renderForm({ initialRating: 4, initialBody: "Some words." });

    await userEvent.clear(screen.getByRole("textbox"));
    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({ rating: 4, body: null, dimensions: {} });
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
    render(<ReviewForm direction="owner_to_sitter" onSubmit={onSubmit} onCancel={vi.fn()} />);

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

const DETAIL = "sitters.reviews.form.detailToggle";

describe("ReviewForm — optional dimensions", () => {
  /**
   * The dimensions live behind a disclosure. One tap on the overall star has to remain
   * a complete review: a form that opens with four rating questions is a form people
   * abandon, and the schema agrees — every dimension column is nullable.
   */
  it("keeps the dimensions out of the way until they are asked for", () => {
    renderForm();
    // Five overall stars and nothing else.
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.getByRole("button", { name: DETAIL })).toBeTruthy();
  });

  it("asks an owner about the pet, the messages and the sitter turning up", async () => {
    renderForm({ direction: "owner_to_sitter" });

    await userEvent.click(screen.getByRole("button", { name: DETAIL }));

    const groups = screen.getAllByRole("radiogroup");
    const labels = groups.map((g) => g.getAttribute("aria-label"));
    expect(labels).toContain("sitters.reviews.form.dimension.petWellbeing");
    expect(labels).toContain("sitters.reviews.form.dimension.communication");
    expect(labels).toContain("sitters.reviews.form.dimension.reliability");
  });

  it("asks a sitter about the messages, the pet as described and the handover", async () => {
    renderForm({ direction: "sitter_to_owner" });

    await userEvent.click(screen.getByRole("button", { name: DETAIL }));

    const labels = screen.getAllByRole("radiogroup").map((g) => g.getAttribute("aria-label"));
    expect(labels).toContain("sitters.reviews.form.dimension.communication");
    expect(labels).toContain("sitters.reviews.form.dimension.petAsDescribed");
    expect(labels).toContain("sitters.reviews.form.dimension.handover");
  });

  it("never offers a dimension the CHECK constraint would reject for this direction", async () => {
    // reviews_dimensions_match_direction turns a mismatched column into a 23514 the
    // user can do nothing about.
    renderForm({ direction: "owner_to_sitter" });
    await userEvent.click(screen.getByRole("button", { name: DETAIL }));

    const labels = screen.getAllByRole("radiogroup").map((g) => g.getAttribute("aria-label"));
    expect(labels).not.toContain("sitters.reviews.form.dimension.petAsDescribed");
    expect(labels).not.toContain("sitters.reviews.form.dimension.handover");
  });

  it("sends only the dimensions that were actually answered", async () => {
    // An unanswered dimension is absent, not zero. useMyReviews fills the rest with
    // null; a 0 would fail the 1..5 CHECK.
    const { onSubmit } = renderForm({ direction: "owner_to_sitter" });

    await userEvent.click(screen.getAllByRole("radio")[4]);
    await userEvent.click(screen.getByRole("button", { name: DETAIL }));

    const petWellbeing = screen
      .getAllByRole("radiogroup")
      .find((g) => g.getAttribute("aria-label") === "sitters.reviews.form.dimension.petWellbeing")!;
    await userEvent.click(petWellbeing.querySelectorAll("label")[3]);

    await userEvent.click(screen.getByRole("button", { name: POST }));

    expect(onSubmit).toHaveBeenCalledWith({
      rating: 5,
      body: null,
      dimensions: { pet_wellbeing: 4 },
    });
  });

  it("reopens with the dimensions the review already carries", async () => {
    renderForm({
      direction: "owner_to_sitter",
      initialRating: 3,
      initialDimensions: { communication: 2, pet_wellbeing: null, reliability: 5 },
    });

    await userEvent.click(screen.getByRole("button", { name: DETAIL }));

    const communication = screen
      .getAllByRole("radiogroup")
      .find((g) => g.getAttribute("aria-label") === "sitters.reviews.form.dimension.communication")!;
    const checked = [...communication.querySelectorAll("input")].find((i) => i.checked);
    expect(Number(checked!.value)).toBe(2);
  });
});
