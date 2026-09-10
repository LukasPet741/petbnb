import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ReviewList from "@/components/ReviewList";
import { formatDate } from "@/lib/utils";

const { fromMock, selectMock, eqMock, orderMock, limitMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  orderMock: vi.fn(),
  limitMock: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: { from: fromMock } }));

type ReviewRow = {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  author: { id: string; full_name: string | null; avatar_url: string | null } | null;
};

/** Points the mocked query chain at one result, and hands back a deferred
 *  resolver for the tests that need to observe the loading state first. */
function respondWith(rows: ReviewRow[] | null, error: unknown = null) {
  limitMock.mockResolvedValue({ data: rows, error });
  orderMock.mockReturnValue({ limit: limitMock });
  eqMock.mockReturnValue({ eq: eqMock, order: orderMock });
  selectMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ select: selectMock });
}

const review = (overrides: Partial<ReviewRow> = {}): ReviewRow => ({
  id: "r-1",
  rating: 5,
  body: "Jonas sent photos every day.",
  created_at: "2026-09-02T10:00:00Z",
  author: { id: "o-1", full_name: "Rūta Kazlauskienė", avatar_url: null },
  ...overrides,
});

beforeEach(() => {
  for (const m of [fromMock, selectMock, eqMock, orderMock, limitMock]) m.mockReset();
  respondWith([]);
});

describe("ReviewList query", () => {
  it("reads only this sitter's reviews, newest first", async () => {
    respondWith([review()]);
    render(<ReviewList sitterId="s-1" />);

    await waitFor(() => expect(fromMock).toHaveBeenCalledWith("reviews"));
    expect(eqMock).toHaveBeenCalledWith("subject_id", "s-1");
    // Only reviews pointing at the sitter. The same table now also holds reviews of
    // owners, which are not public and must never reach a sitter profile page.
    expect(eqMock).toHaveBeenCalledWith("direction", "owner_to_sitter");
    expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("embeds the author profile, so the list needs no second query per row", async () => {
    respondWith([review()]);
    render(<ReviewList sitterId="s-1" />);

    await waitFor(() => expect(selectMock).toHaveBeenCalled());
    expect(selectMock.mock.calls[0][0]).toContain("author:profiles!reviews_author_id_fkey");
  });
});

describe("ReviewList rendering", () => {
  it("renders the body, the stars and the date of each review", async () => {
    respondWith([review()]);
    const { container } = render(<ReviewList sitterId="s-1" />);

    expect(await screen.findByText("Jonas sent photos every day.")).toBeInTheDocument();
    expect(container.querySelectorAll("[data-star]")).toHaveLength(5);
    expect(screen.getByText(formatDate("2026-09-02T10:00:00Z", "en"))).toBeInTheDocument();
  });

  it("shows only the author's first name, never their surname", async () => {
    // The reviewer is a private individual who booked a sitter, not a listed
    // business. Printing "Rūta Kazlauskienė" publishes a full name next to a
    // location and a service they paid for.
    respondWith([review()]);
    render(<ReviewList sitterId="s-1" />);

    expect(await screen.findByText("Rūta")).toBeInTheDocument();
    expect(screen.queryByText(/Kazlauskienė/)).not.toBeInTheDocument();
  });

  it("renders a rating-only review without an empty quote", async () => {
    // body is nullable: a reviewer may leave stars and no words.
    respondWith([review({ body: null })]);
    const { container } = render(<ReviewList sitterId="s-1" />);

    await waitFor(() => expect(container.querySelectorAll("[data-star]")).toHaveLength(5));
    expect(container.querySelector("blockquote")).toBeNull();
  });

  it("falls back to a placeholder name when the author profile is missing", async () => {
    respondWith([review({ author: null })]);
    render(<ReviewList sitterId="s-1" />);

    expect(await screen.findByText("sitters.reviews.anonymousAuthor")).toBeInTheDocument();
  });

  it("renders one entry per review", async () => {
    respondWith([
      review({ id: "r-1", body: "First review." }),
      review({ id: "r-2", body: "Second review." }),
    ]);
    render(<ReviewList sitterId="s-1" />);

    expect(await screen.findByText("First review.")).toBeInTheDocument();
    expect(screen.getByText("Second review.")).toBeInTheDocument();
  });
});

describe("ReviewList empty and failed states", () => {
  it("says the sitter has no reviews yet rather than rendering an empty box", async () => {
    respondWith([]);
    render(<ReviewList sitterId="s-1" />);

    expect(await screen.findByText("sitters.reviews.emptyDescription")).toBeInTheDocument();
  });

  it("renders nothing at all when the query fails", async () => {
    // Reviews decorate a profile that has to render without them. A failed
    // aggregate must never replace a working page with an error box.
    respondWith(null, { message: "network" });
    const { container } = render(<ReviewList sitterId="s-1" />);

    await waitFor(() => expect(fromMock).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("shows the heading once reviews have loaded", async () => {
    respondWith([review()]);
    render(<ReviewList sitterId="s-1" />);

    expect(await screen.findByText("sitters.reviews.heading")).toBeInTheDocument();
  });
});
