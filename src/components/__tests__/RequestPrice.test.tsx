import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import RequestPrice, { requestPriceValid, type PriceChoice } from "@/components/RequestPrice";

/**
 * The price section of the request form: send at the asking price, or open with an offer.
 * Rendered without a LanguageProvider, so labels are their translation keys.
 */

function Harness({ asking, service = "boarding", onChoice }: { asking: number | null; service?: "boarding" | "grooming" | "walking"; onChoice?: (c: PriceChoice) => void }) {
  const [choice, setChoice] = useState<PriceChoice>({ mode: "asking", amount: "", note: "" });
  return (
    <RequestPrice
      asking={asking}
      service={service}
      choice={choice}
      onChange={(c) => { setChoice(c); onChoice?.(c); }}
    />
  );
}

describe("RequestPrice", () => {
  it("offers to send at the asking price, selected by default", () => {
    render(<Harness asking={125} />);
    const asking = screen.getByRole("radio", { name: /appPages\.bookingsNew\.sendAtAsking/ });
    expect(asking).toBeChecked();
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("opens a bounded amount and a note when the owner makes an offer", () => {
    const onChoice = vi.fn();
    render(<Harness asking={125} onChoice={onChoice} />);
    fireEvent.click(screen.getByRole("radio", { name: /appPages\.bookingsNew\.makeOffer/ }));
    const amount = screen.getByRole("spinbutton", { name: "appPages.bookingsNew.offerAmountLabel" });
    expect(amount).toHaveAttribute("min", "63");
    expect(amount).toHaveAttribute("max", "124");
    fireEvent.change(amount, { target: { value: "100" } });
    expect(onChoice).toHaveBeenLastCalledWith({ mode: "offer", amount: "100", note: "" });
    expect(screen.getByRole("textbox", { name: "appPages.bookingsNew.offerNoteLabel" })).toHaveAttribute("maxLength", "280");
  });

  it("says when the typed offer is out of range", () => {
    render(<Harness asking={125} />);
    fireEvent.click(screen.getByRole("radio", { name: /appPages\.bookingsNew\.makeOffer/ }));
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "40" } });
    expect(screen.getByRole("alert")).toHaveTextContent("appPages.bookingsNew.offerOutOfRange");
  });

  it("explains that grooming has a fixed price and offers no choice", () => {
    render(<Harness asking={36} service="grooming" />);
    expect(screen.getByText("appPages.bookingsNew.groomingFixedPrice")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("says the service has no price instead of offering anything", () => {
    render(<Harness asking={null} service="walking" />);
    expect(screen.getByText("appPages.bookingsNew.unpricedService")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });
});

describe("requestPriceValid", () => {
  it("accepts the asking price whenever there is one", () => {
    expect(requestPriceValid({ mode: "asking", amount: "", note: "" }, 125, "boarding")).toBe(true);
    expect(requestPriceValid({ mode: "asking", amount: "", note: "" }, null, "boarding")).toBe(false);
  });

  it("accepts an offer only inside the bounds, and never for grooming", () => {
    expect(requestPriceValid({ mode: "offer", amount: "63", note: "" }, 125, "boarding")).toBe(true);
    expect(requestPriceValid({ mode: "offer", amount: "62", note: "" }, 125, "boarding")).toBe(false);
    expect(requestPriceValid({ mode: "offer", amount: "125", note: "" }, 125, "boarding")).toBe(false);
    expect(requestPriceValid({ mode: "offer", amount: "70.5", note: "" }, 125, "boarding")).toBe(false);
    expect(requestPriceValid({ mode: "offer", amount: "30", note: "" }, 36, "grooming")).toBe(false);
  });
});
