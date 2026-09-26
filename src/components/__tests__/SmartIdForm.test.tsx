import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SmartIdForm from "@/components/SmartIdForm";

const code = () => screen.getByLabelText("appPages.smartIdDemo.personalCodeLabel") as HTMLInputElement;
const submit = () => fireEvent.click(screen.getByRole("button", { name: "appPages.smartIdDemo.start" }));

describe("SmartIdForm", () => {
  it("fills the code from a test person and starts with their identity", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.click(screen.getByRole("button", { name: /identities\.wrongCode/ }));
    expect(code().value).toBe("30403039972");
    submit();
    expect(onStart).toHaveBeenCalledWith("PNOLT-30403039972");
  });

  it("accepts a test person's code typed by hand", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.change(code(), { target: { value: "404 040 40009" } });
    expect(code().value).toBe("40404040009");
    submit();
    expect(onStart).toHaveBeenCalledWith("PNOLT-40404040009");
  });

  it("refuses a real personal code without calling SK", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.change(code(), { target: { value: "38901011234" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("appPages.smartIdDemo.notTestPerson");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("asks for eleven digits", () => {
    const onStart = vi.fn();
    render(<SmartIdForm starting={false} onStart={onStart} />);
    fireEvent.change(code(), { target: { value: "3890101" } });
    submit();
    expect(screen.getByRole("alert").textContent).toBe("appPages.smartIdDemo.codeFormat");
    expect(onStart).not.toHaveBeenCalled();
  });

  it("offers Lithuania, with Latvia and Estonia listed but unavailable", () => {
    render(<SmartIdForm starting={false} onStart={() => {}} />);
    const options = screen.getAllByRole("option") as HTMLOptionElement[];
    expect(options.map((o) => o.value)).toEqual(["LT", "LV", "EE"]);
    expect(options.map((o) => o.disabled)).toEqual([false, true, true]);
  });

  it("marks the chip whose code is in the field", () => {
    render(<SmartIdForm starting={false} onStart={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /identities\.ok/ }));
    expect(screen.getByRole("button", { name: /identities\.ok/ }).getAttribute("aria-pressed")).toBe("true");
  });
});
