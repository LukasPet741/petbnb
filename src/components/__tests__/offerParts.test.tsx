import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OfferCard, OfferForm, PriceBar } from "@/components/OfferParts";

/**
 * The chat's price pieces (2026-09-15): the bar under the header, an offer in the log, and the
 * form for a new offer. Presentational; MessageThread decides who may do what (lib/pricing).
 * Rendered without a LanguageProvider, so labels are their translation keys.
 */

describe("OfferCard", () => {
  it("shows the amount, the note and, for the other side, accept and counter", () => {
    const onAccept = vi.fn();
    const onCounter = vi.fn();
    render(<OfferCard amount={115} note="Du pasivaikščiojimai" own={false} time="12:04" replaced={false} acceptLabel="Accept €115" onAccept={onAccept} onCounter={onCounter} />);
    expect(screen.getByText("€115")).toBeInTheDocument();
    expect(screen.getByText("Du pasivaikščiojimai")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept €115" }));
    fireEvent.click(screen.getByRole("button", { name: "messages.offer.counter" }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onCounter).toHaveBeenCalledOnce();
  });

  it("labels your own offer and gives it no buttons", () => {
    render(<OfferCard amount={100} note={null} own time="12:00" replaced={false} />);
    expect(screen.getByText("messages.offer.yours")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("marks a replaced offer and offers nothing on it", () => {
    render(<OfferCard amount={90} note={null} own={false} time="11:00" replaced />);
    expect(screen.getByText("messages.offer.replaced")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("PriceBar", () => {
  it("shows the line, what is left, and the actions it is given", () => {
    const onAccept = vi.fn();
    const onOffer = vi.fn();
    render(<PriceBar line="Asking €125" sub="You have 3 offers left" acceptLabel="Accept at €125" onAccept={onAccept} offerLabel="Make an offer" onOffer={onOffer} error={null} />);
    expect(screen.getByText("Asking €125")).toBeInTheDocument();
    expect(screen.getByText("You have 3 offers left")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Accept at €125" }));
    fireEvent.click(screen.getByRole("button", { name: "Make an offer" }));
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onOffer).toHaveBeenCalledOnce();
  });

  it("shows an error as an alert", () => {
    render(<PriceBar line="Agreed €115" error="The price just changed." />);
    expect(screen.getByRole("alert")).toHaveTextContent("The price just changed.");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("OfferForm", () => {
  it("sends a whole amount inside the bounds with its note", () => {
    const onSubmit = vi.fn();
    render(<OfferForm bounds={{ min: 91, max: 124 }} onSubmit={onSubmit} onCancel={() => {}} busy={false} />);
    const amount = screen.getByRole("spinbutton", { name: "messages.offer.amountLabel" });
    expect(amount).toHaveAttribute("min", "91");
    expect(amount).toHaveAttribute("max", "124");
    fireEvent.change(amount, { target: { value: "110" } });
    fireEvent.change(screen.getByRole("textbox", { name: "messages.offer.noteLabel" }), { target: { value: "  Du pasivaikščiojimai  " } });
    fireEvent.click(screen.getByRole("button", { name: "messages.offer.submit" }));
    expect(onSubmit).toHaveBeenCalledWith(110, "Du pasivaikščiojimai");
  });

  it("will not send an amount outside the bounds", () => {
    const onSubmit = vi.fn();
    render(<OfferForm bounds={{ min: 91, max: 124 }} onSubmit={onSubmit} onCancel={() => {}} busy={false} />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "90" } });
    expect(screen.getByRole("button", { name: "messages.offer.submit" })).toBeDisabled();
  });
});
