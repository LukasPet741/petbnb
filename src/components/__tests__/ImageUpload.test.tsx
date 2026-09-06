import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ImageUpload from "@/components/ImageUpload";
import { MAX_UPLOAD_BYTES, PHOTO_BUCKET } from "@/lib/upload";

const mocks = vi.hoisted(() => ({
  upload: vi.fn(),
  remove: vi.fn(),
  getPublicUrl: vi.fn(),
  from: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {
    storage: {
      from: (bucket: string) => {
        mocks.from(bucket);
        return { upload: mocks.upload, remove: mocks.remove, getPublicUrl: mocks.getPublicUrl };
      },
    },
  },
}));

// jsdom ships neither createImageBitmap nor a canvas backend. Stubbing the
// decode is enough: with no 2d context, resizeImageToJpeg falls back to
// uploading the original blob, which is the documented degradation.
//
// These mocks live at module scope, so `restoreMocks` in vitest.config.mts
// does not touch them and their call history would otherwise accumulate
// across tests. Clearing here is what keeps each "called once" honest.
beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://cdn/photos/u-1/avatar-1-a.jpg" } });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() })),
  );
  // Spied rather than assigned, so restoreMocks puts the real one back. Returning
  // null exercises the no-canvas branch deliberately instead of relying on
  // jsdom's "Not implemented" console noise to produce the same result.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

function imageFile({ type = "image/png", size = 1024, name = "pic.png" } = {}) {
  const file = new File(["binary"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

const setup = (props: Partial<React.ComponentProps<typeof ImageUpload>> = {}) => {
  const onChange = vi.fn();
  const view = render(
    <ImageUpload
      userId="u-1"
      kind="avatar"
      value={null}
      onChange={onChange}
      fallback={<span data-testid="fallback">RX</span>}
      {...props}
    />,
  );
  const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
  return { onChange, input, ...view };
};

describe("rendering", () => {
  it("shows the fallback when there is no photo", () => {
    setup();
    expect(screen.getByTestId("fallback")).toBeInTheDocument();
  });

  it("shows the photo instead of the fallback once one is set", () => {
    const { container } = setup({ value: "https://cdn/photos/u-1/a.jpg" });
    expect(container.querySelector("img")).toHaveAttribute("src", "https://cdn/photos/u-1/a.jpg");
    expect(screen.queryByTestId("fallback")).toBeNull();
  });

  it("offers to add a photo when empty and to change it when set", () => {
    const empty = setup();
    expect(screen.getAllByText(/imageUpload\.addPhoto/).length).toBeGreaterThan(0);
    empty.unmount();

    setup({ value: "https://cdn/photos/u-1/a.jpg" });
    expect(screen.getAllByText(/imageUpload\.changePhoto/).length).toBeGreaterThan(0);
  });

  it("offers removal only when there is something to remove", () => {
    const empty = setup();
    expect(screen.queryByText(/imageUpload\.removePhoto/)).toBeNull();
    empty.unmount();

    setup({ value: "https://cdn/photos/u-1/a.jpg" });
    expect(screen.getByText(/imageUpload\.removePhoto/)).toBeInTheDocument();
  });

  // Two ways in on purpose: the frame itself (the obvious target, but a bare
  // image without an accessible name) and an explicit text button underneath,
  // which is the only affordance on touch, where there is no hover.
  it("gives the picker an accessible name on both the frame and the text button", () => {
    setup();
    expect(screen.getAllByRole("button", { name: /imageUpload\.addPhoto/ })).toHaveLength(2);
  });

  it("accepts only the image types canvas can decode", () => {
    const { input } = setup();
    expect(input.accept).toBe("image/jpeg,image/png,image/webp,image/gif");
  });

  it("disables its controls when told to", () => {
    setup({ disabled: true, value: "https://cdn/photos/u-1/a.jpg" });
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });
});

describe("rejecting a bad file", () => {
  it("refuses a file of the wrong type without touching storage", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input, onChange } = setup();

    await user.upload(input, imageFile({ type: "application/pdf", name: "cv.pdf" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("imageUpload.errorWrongType");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses a file over the size limit without spending an upload on it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input, onChange } = setup();

    await user.upload(input, imageFile({ size: MAX_UPLOAD_BYTES + 1 }));

    expect(await screen.findByRole("alert")).toHaveTextContent("imageUpload.errorTooLarge");
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("refuses a zero-byte file", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup();

    await user.upload(input, imageFile({ size: 0 }));

    expect(await screen.findByRole("alert")).toHaveTextContent("imageUpload.errorEmpty");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});

describe("uploading", () => {
  it("uploads into the photos bucket under the user's own folder", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup();

    await user.upload(input, imageFile());

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(mocks.from).toHaveBeenCalledWith(PHOTO_BUCKET);
    const [path, , options] = mocks.upload.mock.calls[0];
    // The bucket policy keys on foldername(name)[1] = auth.uid().
    expect(path).toMatch(/^u-1\/avatar-\d+-[a-z0-9]+\.jpg$/);
    expect(options).toMatchObject({ contentType: "image/jpeg", upsert: false });
  });

  it("tags a pet upload distinctly from an avatar upload", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup({ kind: "pet" });

    await user.upload(input, imageFile());

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^u-1\/pet-/);
  });

  it("reports the resulting public URL upward and writes to no table itself", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input, onChange } = setup();

    await user.upload(input, imageFile());

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith("https://cdn/photos/u-1/avatar-1-a.jpg"),
    );
  });

  it("deletes the photo it replaced, so the bucket does not grow without bound", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup({
      value: "https://proj.supabase.co/storage/v1/object/public/photos/u-1/avatar-old.jpg",
    });

    await user.upload(input, imageFile());

    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["u-1/avatar-old.jpg"]));
  });

  // Seed rows point at Unsplash. Trying to delete those would be a no-op at
  // best and is not ours to attempt.
  it("leaves a photo it does not own alone when replacing it", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup({ value: "https://images.unsplash.com/photo-123" });

    await user.upload(input, imageFile());

    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("surfaces a storage error and does not report a URL", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "row-level security policy" } });
    const user = userEvent.setup({ applyAccept: false });
    const { input, onChange } = setup();

    await user.upload(input, imageFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("row-level security policy");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reports a friendly error when the image cannot be decoded", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("corrupt"); }));
    const user = userEvent.setup({ applyAccept: false });
    const { input, onChange } = setup();

    await user.upload(input, imageFile());

    expect(await screen.findByRole("alert")).toHaveTextContent("imageUpload.errorFailed");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears a previous error on a successful retry", async () => {
    mocks.upload.mockResolvedValueOnce({ error: { message: "boom" } });
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup();

    await user.upload(input, imageFile());
    await screen.findByRole("alert");

    await user.upload(input, imageFile());
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  // The handler blanks input.value so the same file can be chosen twice; a
  // browser fires no change event otherwise, and re-picking would look broken.
  it("resets the input so re-picking the same file still fires", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { input } = setup();
    await user.upload(input, imageFile());
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
    expect(input.value).toBe("");
  });
});

describe("removing", () => {
  it("clears the value and deletes the stored object", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({
      value: "https://proj.supabase.co/storage/v1/object/public/photos/u-1/avatar-old.jpg",
    });

    await user.click(screen.getByText(/imageUpload\.removePhoto/));

    expect(onChange).toHaveBeenCalledWith(null);
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith(["u-1/avatar-old.jpg"]));
  });

  it("clears a foreign photo url without attempting a delete", async () => {
    const user = userEvent.setup();
    const { onChange } = setup({ value: "https://images.unsplash.com/photo-123" });

    await user.click(screen.getByText(/imageUpload\.removePhoto/));

    expect(onChange).toHaveBeenCalledWith(null);
    await waitFor(() => expect(mocks.remove).not.toHaveBeenCalled());
  });
});
