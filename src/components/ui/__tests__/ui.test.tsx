import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import Button, { ButtonLink, buttonClasses } from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import Chip from "@/components/ui/Chip";
import StatusPill from "@/components/ui/StatusPill";
import Promise_ from "@/components/ui/Promise";
import Field, { Input } from "@/components/ui/Field";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { ConfirmProvider, useConfirm } from "@/components/ui/Confirm";
import Dialog from "@/components/ui/Dialog";
import Skeleton from "@/components/ui/Skeleton";
import MoonLoader from "@/components/ui/MoonLoader";

// Rendered without a LanguageProvider, so t() returns its key: the assertions name the
// exact strings each block asks for.

afterEach(() => {
  vi.useRealTimers();
});

describe("Button", () => {
  it("is a real button that does not submit by accident", () => {
    render(<Button>Siųsti</Button>);
    const b = screen.getByRole("button", { name: "Siųsti" });
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveClass("pb-press", "rounded-full", "bg-brand");
  });

  it("names its variants and sizes once, for links too", () => {
    expect(buttonClasses({ variant: "danger" })).toContain("bg-danger");
    expect(buttonClasses({ variant: "secondary" })).toContain("bg-surface");
    expect(buttonClasses({ size: "lg" })).toContain("h-13");
    render(<ButtonLink href="/browse" variant="secondary">Ieškoti</ButtonLink>);
    expect(screen.getByRole("link", { name: "Ieškoti" })).toHaveClass("bg-surface", "rounded-full");
  });

  it("keeps its label while loading, and cannot be pressed twice", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Siųsti</Button>);
    const b = screen.getByRole("button", { name: /Siųsti/ });
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toBeDisabled();
    await userEvent.setup().click(b);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("always carries a name", () => {
    render(<IconButton label="Uždaryti"><svg /></IconButton>);
    expect(screen.getByRole("button", { name: "Uždaryti" })).toHaveClass("w-11", "h-11");
  });
});

describe("Chip", () => {
  it("is a toggle: selected is brand green with a check, never black", async () => {
    function Harness() {
      const [on, setOn] = useState(false);
      return <Chip pressed={on} onClick={() => setOn(!on)} count={17}>Šunų vedžiojimas</Chip>;
    }
    render(<Harness />);
    const chip = screen.getByRole("button", { name: /Šunų vedžiojimas/ });
    expect(chip).toHaveAttribute("aria-pressed", "false");
    await userEvent.setup().click(chip);
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveClass("bg-brand");
    expect(chip).not.toHaveClass("bg-ink");
    expect(chip.querySelector("svg")).not.toBeNull();
  });
});

describe("StatusPill and Promise", () => {
  it("words a booking status in the dictionary's terms", () => {
    render(<StatusPill status="signed" />);
    expect(screen.getByText("common.bookingStatus.signed")).toBeInTheDocument();
  });

  it("names each promise with its fixed /brand name", () => {
    render(<><Promise_ kind="smartId" /><Promise_ kind="live" /><Promise_ kind="agreed" /></>);
    for (const k of ["smartId", "live", "agreed"]) {
      expect(screen.getByText(`brand.signatures.${k}.name`)).toBeInTheDocument();
    }
  });
});

describe("Field", () => {
  it("ties the label, the hint and the error to the control", () => {
    render(
      <Field label="Svoris" hint="kilogramais" error="Turi būti daugiau už nulį.">
        {(p) => <Input {...p} defaultValue="-4" />}
      </Field>,
    );
    const input = screen.getByLabelText("Svoris");
    expect(input).toHaveAttribute("aria-invalid", "true");
    const described = input.getAttribute("aria-describedby") ?? "";
    expect(described.split(" ")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Turi būti daugiau už nulį.");
    expect(input).toHaveClass("border-danger");
  });

  it("stays quiet when all is well", () => {
    render(<Field label="Vardas">{(p) => <Input {...p} />}</Field>);
    const input = screen.getByLabelText("Vardas");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Toast", () => {
  function Shower({ action }: { action?: () => void }) {
    const toast = useToast();
    return (
      <button
        type="button"
        onClick={() => toast({ message: "Karolis pašalintas.", action: action ? { label: "Grąžinti", onAction: action } : undefined })}
      >
        show
      </button>
    );
  }

  it("says what happened, and Undo really undoes", async () => {
    const undo = vi.fn();
    const user = userEvent.setup();
    render(<ToastProvider><Shower action={undo} /></ToastProvider>);
    await user.click(screen.getByRole("button", { name: "show" }));
    expect(screen.getByText("Karolis pašalintas.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Grąžinti" }));
    expect(undo).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Karolis pašalintas.")).toBeNull());
  });

  it("leaves on its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ToastProvider><Shower /></ToastProvider>);
    await act(async () => screen.getByRole("button", { name: "show" }).click());
    expect(screen.getByText("Karolis pašalintas.")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(4000); });
    await waitFor(() => expect(screen.queryByText("Karolis pašalintas.")).toBeNull());
  });
});

describe("Confirm", () => {
  function Asker({ onAnswer }: { onAnswer: (v: boolean) => void }) {
    const confirm = useConfirm();
    return (
      <button
        type="button"
        onClick={async () =>
          onAnswer(await confirm({ title: "Atšaukti viešnagę?", body: "Karolis gaus laišką.", confirmLabel: "Atšaukti viešnagę", tone: "danger" }))
        }
      >
        ask
      </button>
    );
  }

  it("names the consequence, starts on the safe choice, and answers yes", async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmProvider><Asker onAnswer={onAnswer} /></ConfirmProvider>);
    await user.click(screen.getByRole("button", { name: "ask" }));
    const dialog = screen.getByRole("dialog", { name: "Atšaukti viešnagę?" });
    expect(dialog).toHaveTextContent("Karolis gaus laišką.");
    expect(screen.getByRole("button", { name: "common.ui.keep" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Atšaukti viešnagę" }));
    expect(onAnswer).toHaveBeenCalledWith(true);
  });

  it("answers no on Escape", async () => {
    const onAnswer = vi.fn();
    const user = userEvent.setup();
    render(<ConfirmProvider><Asker onAnswer={onAnswer} /></ConfirmProvider>);
    await user.click(screen.getByRole("button", { name: "ask" }));
    await user.keyboard("{Escape}");
    expect(onAnswer).toHaveBeenCalledWith(false);
  });
});

describe("Dialog", () => {
  it("keeps Tab inside and closes on Escape", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Dialog open onClose={onClose} title="Prašymas">
        <button type="button">vienas</button>
        <button type="button">du</button>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog", { name: "Prašymas" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Focus starts on the content, not on the close button.
    expect(screen.getByRole("button", { name: "vienas" })).toHaveFocus();
    const close = screen.getByRole("button", { name: "common.ui.close" });
    close.focus();
    await user.tab();
    await user.tab();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("Skeleton and MoonLoader", () => {
  it("hides the skeleton from screen readers and names the wait", () => {
    const { container } = render(<><Skeleton className="h-4 w-24" /><MoonLoader label="Ieškome…" /></>);
    expect(container.querySelector(".pb-skeleton")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Ieškome…");
  });
});
