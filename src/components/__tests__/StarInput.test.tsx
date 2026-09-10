import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StarInput from "@/components/StarInput";

// StarInput touches no Supabase and no router — only useLanguage, for the labels.
// Rendered without a LanguageProvider the default context's `t` is the identity
// function, so every star's label collapses to the same key. That is why the tests
// below address stars by position and value rather than by accessible name.
//
// The stars are native radio inputs. Arrow-key navigation inside a radio group is
// the browser's job, not this component's, so there is no test for it here: jsdom
// does not implement it, and writing one would only prove that a hand-rolled
// keyboard handler I should not be writing works.

describe("StarInput", () => {
  it("offers exactly the five ratings the column allows", () => {
    render(<StarInput value={0} onChange={vi.fn()} />);
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("is a group, so a screen reader announces it as one question", () => {
    render(<StarInput value={0} onChange={vi.fn()} />);
    expect(screen.getByRole("radiogroup")).toBeTruthy();
  });

  it("checks nothing at all when no rating has been chosen", () => {
    // Zero is the unset value, not a rating. A form that opens with one star
    // pre-selected would collect a one-star review from anyone who only wanted to
    // write a comment.
    render(<StarInput value={0} onChange={vi.fn()} />);
    const chosen = screen.getAllByRole("radio").filter((r) => (r as HTMLInputElement).checked);
    expect(chosen).toHaveLength(0);
  });

  it.each([1, 2, 3, 4, 5])("checks star %i and only star %i when that is the value", (value) => {
    render(<StarInput value={value} onChange={vi.fn()} />);
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    const checked = radios.filter((r) => r.checked);
    expect(checked).toHaveLength(1);
    expect(Number(checked[0].value)).toBe(value);
  });

  it("reports the rating the user picked", async () => {
    const onChange = vi.fn();
    render(<StarInput value={0} onChange={onChange} />);

    await userEvent.click(screen.getAllByRole("radio")[3]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(4);
  });

  it("reports a number, not the string a form control natively carries", async () => {
    // input.value is always a string. Passing "4" through to a smallint column is
    // the kind of thing PostgREST accepts until one day it does not.
    const onChange = vi.fn();
    render(<StarInput value={0} onChange={onChange} />);

    await userEvent.click(screen.getAllByRole("radio")[0]);

    expect(onChange).toHaveBeenCalledWith(1);
    expect(typeof onChange.mock.calls[0][0]).toBe("number");
  });

  it("lets the rating be changed after one is already chosen", async () => {
    const onChange = vi.fn();
    render(<StarInput value={5} onChange={onChange} />);

    await userEvent.click(screen.getAllByRole("radio")[2]);

    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("accepts nothing while the review is being saved", async () => {
    // Without this a second click during the round trip posts a different rating
    // than the one the user watched being submitted.
    const onChange = vi.fn();
    render(<StarInput value={3} onChange={onChange} disabled />);

    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.every((r) => r.disabled)).toBe(true);

    await userEvent.click(radios[4]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps two forms on one page from sharing a radio group", () => {
    // The bookings list can show several completed bookings at once. Native radios
    // group by name attribute, so a shared name would make choosing 4 stars for one
    // booking silently clear the rating on another.
    const { unmount } = render(<StarInput value={0} onChange={vi.fn()} name="booking-a" />);
    const first = (screen.getAllByRole("radio")[0] as HTMLInputElement).name;
    unmount();

    render(<StarInput value={0} onChange={vi.fn()} name="booking-b" />);
    const second = (screen.getAllByRole("radio")[0] as HTMLInputElement).name;

    expect(first).not.toBe(second);
  });
});
