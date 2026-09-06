import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PetForm, { EMPTY_PET_FORM, type PetFormValues } from "@/components/PetForm";

// No LanguageProvider, so t is the identity function and every label below IS
// its translation key -- the same convention as PetCard.test.tsx.

const setup = (props: Partial<React.ComponentProps<typeof PetForm>> = {}) => {
  const onSubmit = vi.fn<(v: PetFormValues) => Promise<void>>().mockResolvedValue(undefined);
  const view = render(
    <PetForm
      userId="u-1"
      submitLabel="Save"
      cancelHref="/pets"
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, ...view };
};

const filled = (over: Partial<PetFormValues> = {}): PetFormValues => ({
  ...EMPTY_PET_FORM,
  name: "Rex",
  ...over,
});

describe("initial state", () => {
  it("starts empty when no initial values are given", () => {
    setup();
    expect(screen.getByLabelText(/nameLabel/)).toHaveValue("");
    expect(screen.getByLabelText(/weightLabel/)).toHaveValue(null);
    expect(screen.getByLabelText(/bioLabel/)).toHaveValue("");
  });

  it("defaults a new pet to a dog of unknown sex", () => {
    setup();
    expect(screen.getByLabelText(/typeLabel/)).toHaveValue("dog");
    expect(screen.getByLabelText(/sexLabel/)).toHaveValue("unknown");
  });

  it("prefills every field from initial values, which is the whole point of the edit route", () => {
    setup({
      initial: {
        name: "Mira",
        type: "cat",
        sex: "female",
        weight_kg: "4.2",
        bio: "Naps a lot.",
        photo_url: null,
      },
    });
    expect(screen.getByLabelText(/nameLabel/)).toHaveValue("Mira");
    expect(screen.getByLabelText(/typeLabel/)).toHaveValue("cat");
    expect(screen.getByLabelText(/sexLabel/)).toHaveValue("female");
    expect(screen.getByLabelText(/weightLabel/)).toHaveValue(4.2);
    expect(screen.getByLabelText(/bioLabel/)).toHaveValue("Naps a lot.");
  });

  it("shows the existing photo when the pet has one", () => {
    const { container } = setup({ initial: filled({ photo_url: "https://x/mira.jpg" }) });
    expect(container.querySelector("img")).toHaveAttribute("src", "https://x/mira.jpg");
  });

  it("falls back to the species tile when the pet has no photo", () => {
    const { container } = setup({ initial: filled({ type: "bird" }) });
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".bg-sky-50")).toBeInTheDocument();
  });

  it("retints the photo placeholder when the species changes", async () => {
    const user = userEvent.setup();
    const { container } = setup();
    expect(container.querySelector(".bg-amber-50")).toBeInTheDocument(); // dog
    await user.selectOptions(screen.getByLabelText(/typeLabel/), "cat");
    expect(container.querySelector(".bg-violet-50")).toBeInTheDocument();
    expect(container.querySelector(".bg-amber-50")).toBeNull();
  });
});

describe("submitting", () => {
  it("hands the caller exactly what was typed", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();

    await user.type(screen.getByLabelText(/nameLabel/), "Rex");
    await user.selectOptions(screen.getByLabelText(/typeLabel/), "cat");
    await user.selectOptions(screen.getByLabelText(/sexLabel/), "male");
    await user.type(screen.getByLabelText(/weightLabel/), "12.5");
    await user.type(screen.getByLabelText(/bioLabel/), "Good boy.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      name: "Rex",
      type: "cat",
      sex: "male",
      weight_kg: "12.5",
      bio: "Good boy.",
      photo_url: null,
    });
  });

  it("keeps weight as a string, leaving the numeric conversion to the caller", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ initial: filled({ weight_kg: "8" }) });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].weight_kg).toBe("8");
  });

  it("carries an unchanged photo url through an edit", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup({ initial: filled({ photo_url: "https://x/rex.jpg" }) });
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][0].photo_url).toBe("https://x/rex.jpg");
  });

  it("will not submit without a name, which the database requires as NOT NULL", async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows the caller's error and stays on the form", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("duplicate key value"));
    render(
      <PetForm userId="u-1" initial={filled()} submitLabel="Save" cancelHref="/pets" onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("duplicate key value");
    expect(screen.getByLabelText(/nameLabel/)).toHaveValue("Rex");
  });

  it("re-enables the submit button after a failure, so the user can retry", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <PetForm userId="u-1" initial={filled()} submitLabel="Save" cancelHref="/pets" onSubmit={onSubmit} />,
    );

    const button = screen.getByRole("button", { name: "Save" });
    await user.click(button);
    await screen.findByRole("alert");
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("clears a previous error when a retry succeeds", async () => {
    const user = userEvent.setup();
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(undefined);
    render(
      <PetForm userId="u-1" initial={filled()} submitLabel="Save" cancelHref="/pets" onSubmit={onSubmit} />,
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("survives a non-Error rejection without rendering [object Object]", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockRejectedValue("plain string failure");
    render(
      <PetForm userId="u-1" initial={filled()} submitLabel="Save" cancelHref="/pets" onSubmit={onSubmit} />,
    );
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("plain string failure");
  });
});

describe("cancel", () => {
  it("links back to where the caller says, not to a hardcoded route", () => {
    setup({ cancelHref: "/somewhere-else" });
    expect(screen.getByRole("link", { name: /cancelButton/ })).toHaveAttribute(
      "href",
      "/somewhere-else",
    );
  });
});
