import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";

type ProfileRow = Database["public"]["Views"]["my_profile"]["Row"];
type SingleResult = { data: ProfileRow | null; error: unknown };

// The hook is a thin wrapper over one query, so everything interesting lives in
// the effect's branching and in the derived `isComplete` / `loading` values.
// Both the auth context and the supabase client are stubbed so each branch can
// be driven deterministically, including the resolution ORDER of two in-flight
// requests.
const h = vi.hoisted(() => {
  const maybeSingle = vi.fn<() => Promise<SingleResult>>(async () => ({
    data: null,
    error: null,
  }));
  const select = vi.fn((_columns: string) => ({ maybeSingle }));
  const from = vi.fn((_table: string) => ({ select }));
  const auth = { user: null as User | null, loading: false };
  return { maybeSingle, select, from, auth };
});

vi.mock("@/lib/supabase", () => ({ supabase: { from: h.from } }));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ session: null, user: h.auth.user, loading: h.auth.loading }),
}));

const userA = { id: "user-a" } as unknown as User;
const userB = { id: "user-b" } as unknown as User;

function makeProfile(over: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "user-a",
    full_name: "Jonas Petraitis",
    phone: "+37060000000",
    city: "Vilnius",
    is_sitter: false,
    rate_per_hour: null,
    experience_years: null,
    services: null,
    about_me: null,
    avatar_url: null,
    last_active_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    // Columns the hand-written Database type never mentioned. A profile row from
    // the database always carries them, so a fixture that omits them is not one.
    locale: "lt",
    is_verified: false,
    verified_at: null,
    verified_full_name: null,
    smart_id_session_id: null,
    ...over,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  h.auth.user = null;
  h.auth.loading = false;
  h.maybeSingle.mockReset();
  h.maybeSingle.mockResolvedValue({ data: null, error: null });
  h.from.mockClear();
  h.select.mockClear();
});

/** Renders the hook with `profile` already fetched and settled. */
async function renderLoaded(profile: ProfileRow | null) {
  h.auth.user = userA;
  h.maybeSingle.mockResolvedValue({ data: profile, error: null });
  const view = renderHook(() => useProfile());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe("effect branching", () => {
  it("issues no query and stays loading while auth is still resolving", () => {
    h.auth.loading = true;
    h.auth.user = null;

    const { result } = renderHook(() => useProfile());

    expect(h.from).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    expect(result.current.profile).toBeNull();
  });

  it("issues no query even when auth is loading and a user is already present", () => {
    // authLoading wins: the early return happens before the !user check.
    h.auth.loading = true;
    h.auth.user = userA;

    const { result } = renderHook(() => useProfile());

    expect(h.from).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("finishes loading with a null profile and no query for a signed-out visitor", async () => {
    h.auth.user = null;

    const { result } = renderHook(() => useProfile());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.from).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
    expect(result.current.isComplete).toBe(false);
  });

  it("fetches the signed-in user's own row and exposes it once resolved", async () => {
    const profile = makeProfile({ id: "user-a" });
    const { result } = await renderLoaded(profile);

    // Reading the view rather than the table is the point: the authenticated
    // grant on profiles excludes phone, so a regression back to from("profiles")
    // would quietly break isComplete for everyone.
    expect(h.from).toHaveBeenCalledWith("my_profile");
    expect(h.select).toHaveBeenCalledWith("*");
    expect(result.current.profile).toEqual(profile);
    expect(result.current.isComplete).toBe(true);
  });

  it("refetches when the signed-in user changes", async () => {
    const { result, rerender } = await renderLoaded(makeProfile({ id: "user-a" }));

    h.auth.user = userB;
    h.maybeSingle.mockResolvedValue({
      data: makeProfile({ id: "user-b", full_name: "Rita" }),
      error: null,
    });
    rerender();

    await waitFor(() => expect(result.current.profile?.id).toBe("user-b"));
    // No id to assert on any more -- my_profile is scoped by auth.uid() inside the
    // view, so what identifies a refetch is that the query ran a second time.
    expect(h.from).toHaveBeenLastCalledWith("my_profile");
    expect(h.maybeSingle).toHaveBeenCalledTimes(2);
  });
});

describe("error handling", () => {
  // BUG: the `.then` callback destructures only `data` and never inspects
  // `error`. A PGRST116 "no rows returned" from .single() is therefore handled
  // exactly like a transport failure, an RLS denial or a 500: profile becomes
  // null and loading becomes false, with nothing logged and nothing surfaced.
  // The app layout reads `!isComplete` to bounce the user to /profile, so a
  // brand-new user with no row and a user whose fetch simply failed both get
  // redirected to the profile page forever, with no way to tell them apart.
  // Correct behaviour would be to surface an `error` alongside the profile and
  // treat "no row" separately from "fetch failed".
  it("silently reports a null profile when the row is genuinely missing (current buggy behaviour)", async () => {
    h.auth.user = userA;
    h.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" },
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toBeNull();
    expect(result.current.isComplete).toBe(false);
  });

  it("is indistinguishable from a hard fetch failure (current buggy behaviour)", async () => {
    h.auth.user = userA;
    h.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: "500", message: "upstream connect error" },
    });

    const { result } = renderHook(() => useProfile());

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Same observable shape as the missing-row case above: nothing in the
    // returned value distinguishes "you have no profile yet" from "we could
    // not reach the database".
    expect(result.current.profile).toBeNull();
    expect(result.current.isComplete).toBe(false);
  });
});

describe("request races", () => {
  // BUG: the effect has no `active` / AbortController guard (FavoritesContext,
  // by contrast, does). If the user switches accounts while the first request
  // is still in flight, whichever request resolves LAST wins. A slow response
  // for the previous account therefore overwrites the correct one, and the
  // signed-in user sees somebody else's name, phone and city on /profile.
  // Correct behaviour would be a cleanup flag that drops stale responses.
  it("lets an older request overwrite a newer one when it resolves last (current buggy behaviour)", async () => {
    const first = deferred<SingleResult>();
    const second = deferred<SingleResult>();
    h.maybeSingle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    h.auth.user = userA;
    const { result, rerender } = renderHook(() => useProfile());

    h.auth.user = userB;
    rerender();
    expect(h.maybeSingle).toHaveBeenCalledTimes(2);

    // The NEW user's request comes back first — correct state, briefly.
    await act(async () => {
      second.resolve({ data: makeProfile({ id: "user-b", full_name: "Rita" }), error: null });
    });
    expect(result.current.profile?.id).toBe("user-b");

    // Then the OLD user's request lands and clobbers it.
    await act(async () => {
      first.resolve({ data: makeProfile({ id: "user-a", full_name: "Jonas Petraitis" }), error: null });
    });
    expect(result.current.profile?.id).toBe("user-a");
    expect(result.current.profile?.full_name).toBe("Jonas Petraitis");
  });

  // BUG: on sign-out the effect re-runs, takes the `!user` branch and only
  // calls setLoading(false). setProfile(null) is never called, so the previous
  // account's full name, phone and city stay in state and keep rendering.
  // Correct behaviour would be to clear the profile in the no-user branch,
  // exactly as FavoritesContext clears its set.
  it("keeps the previous account's profile after sign-out (current buggy behaviour)", async () => {
    const { result, rerender } = await renderLoaded(makeProfile({ id: "user-a" }));

    h.auth.user = null;
    h.from.mockClear();
    rerender();

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(h.from).not.toHaveBeenCalled();
    expect(result.current.profile?.id).toBe("user-a");
    // Worse: the stale profile still reads as complete, so nothing downstream
    // can notice that there is no signed-in user any more.
    expect(result.current.isComplete).toBe(true);
  });
});

describe("refresh", () => {
  it("does nothing at all when there is no signed-in user", async () => {
    h.auth.user = null;
    const { result } = renderHook(() => useProfile());
    await waitFor(() => expect(result.current.loading).toBe(false));
    h.from.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(h.from).not.toHaveBeenCalled();
    expect(result.current.profile).toBeNull();
  });

  it("replaces the profile with the freshly fetched row", async () => {
    const { result } = await renderLoaded(makeProfile({ full_name: "Jonas Petraitis" }));

    h.maybeSingle.mockResolvedValue({ data: makeProfile({ full_name: "Jonas Naujas" }), error: null });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.profile?.full_name).toBe("Jonas Naujas");
  });

  it("never flips loading back on while refetching", async () => {
    const pending = deferred<SingleResult>();
    const { result } = await renderLoaded(makeProfile());

    h.maybeSingle.mockReturnValueOnce(pending.promise);
    let refreshing!: Promise<void>;
    act(() => {
      refreshing = result.current.refresh();
    });

    // A refetch is in flight but nothing tells the UI, so consumers keep
    // rendering the stale profile with no spinner.
    expect(result.current.loading).toBe(false);

    await act(async () => {
      pending.resolve({ data: makeProfile(), error: null });
      await refreshing;
    });
    expect(result.current.loading).toBe(false);
  });

  // BUG: refresh() destructures only `data` too, so a failed refetch wipes a
  // perfectly good profile to null. The user sees a fully populated profile
  // page blank itself out after, say, saving an edit over a flaky connection.
  it("wipes a loaded profile to null when the refetch errors (current buggy behaviour)", async () => {
    const { result } = await renderLoaded(makeProfile({ full_name: "Jonas Petraitis" }));
    expect(result.current.profile).not.toBeNull();

    h.maybeSingle.mockResolvedValue({ data: null, error: { message: "network down" } });
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.profile).toBeNull();
    expect(result.current.isComplete).toBe(false);
  });
});

describe("isComplete truth table", () => {
  const F = "Jonas";
  const P = "+37060000000";
  const C = "Vilnius";

  const cases: Array<[string | null, string | null, string | null, boolean]> = [
    [null, null, null, false],
    [F, null, null, false],
    [null, P, null, false],
    [null, null, C, false],
    [F, P, null, false],
    [F, null, C, false],
    [null, P, C, false],
    [F, P, C, true],
  ];

  it.each(cases)(
    "full_name=%o phone=%o city=%o -> isComplete=%s",
    async (full_name, phone, city, expected) => {
      const { result } = await renderLoaded(makeProfile({ full_name, phone, city }));
      expect(result.current.isComplete).toBe(expected);
    }
  );

  it("treats an empty string as incomplete because it is falsy", async () => {
    const { result } = await renderLoaded(makeProfile({ full_name: "", phone: P, city: C }));
    expect(result.current.isComplete).toBe(false);
  });

  it("treats a null profile as incomplete", async () => {
    const { result } = await renderLoaded(null);
    expect(result.current.isComplete).toBe(false);
  });

  // BUG: the check is a bare truthiness test with no .trim(), so a profile
  // whose three required fields are all whitespace passes as complete. The
  // user gets past the "finish your profile" gate with a blank-looking name,
  // and other users see an empty card wherever the name is rendered.
  // Correct behaviour would be `!!profile?.full_name?.trim()` per field.
  it("counts whitespace-only values as complete (current buggy behaviour)", async () => {
    const { result } = await renderLoaded(
      makeProfile({ full_name: "   ", phone: "\t", city: "\n " })
    );
    expect(result.current.isComplete).toBe(true);
  });

  it("returns a boolean rather than the truthy city string", async () => {
    // The double bang matters: consumers render `isComplete && <Badge/>`.
    const { result } = await renderLoaded(makeProfile());
    expect(result.current.isComplete).toBe(true);
    expect(typeof result.current.isComplete).toBe("boolean");
  });
});

describe("loading composition", () => {
  it("reports loading while the profile query is still in flight", async () => {
    const pending = deferred<SingleResult>();
    h.maybeSingle.mockReturnValueOnce(pending.promise);
    h.auth.user = userA;

    const { result } = renderHook(() => useProfile());
    expect(result.current.loading).toBe(true);

    await act(async () => {
      pending.resolve({ data: makeProfile(), error: null });
    });
    expect(result.current.loading).toBe(false);
  });

  it("still reports loading when auth goes back to loading after the profile arrived", async () => {
    const { result, rerender } = await renderLoaded(makeProfile());
    expect(result.current.loading).toBe(false);

    // Local loading is false, auth loading is true: the returned value is the
    // logical OR of the two, so the hook keeps reporting loading even though
    // the profile itself is present.
    h.auth.loading = true;
    rerender();

    expect(result.current.loading).toBe(true);
    expect(result.current.profile).not.toBeNull();
  });
});
