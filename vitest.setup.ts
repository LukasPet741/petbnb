import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

// src/lib/supabase.ts calls createClient() at module scope with non-null
// assertions, so importing anything that transitively imports it throws
// "supabaseUrl is required" unless these exist. Dummy values only -- see the
// fetch guard below, which makes sure nothing ever actually talks to them.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://stub.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "stub-anon-key";

// CI sets the real Supabase and Resend secrets at job level, so a test that
// accidentally hits the network would pass in CI and fail for anyone without
// secrets (a fork PR, a new contributor). Fail loudly and deterministically
// instead. A test that genuinely needs fetch stubs it itself.
vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    throw new Error(
      "Network call attempted in a unit test. Mock the module under test instead.",
    );
  }),
);

// jsdom implements neither observer. useInView needs IntersectionObserver;
// Radix's popper-based components (dropdown, select) need ResizeObserver.
class MockObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  takeRecords = vi.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds: readonly number[] = [];
  constructor(_cb: unknown, _opts?: unknown) {}
}
vi.stubGlobal("IntersectionObserver", MockObserver);
vi.stubGlobal("ResizeObserver", MockObserver);

vi.stubGlobal(
  "matchMedia",
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);

// Radix drives its interactions through pointer capture, which jsdom lacks.
// Without these, user-event clicks on a Select or DropdownMenu throw.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.setPointerCapture ??= () => {};
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

// Next's App Router hooks are not available outside a Next runtime. Tests that
// care about navigation override this with their own vi.mock.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// We are not using Vitest globals (so tsconfig needs no "types" entry, which
// would otherwise drop @types/node from scope), so RTL's auto-cleanup never
// registers. Do it by hand.
afterEach(() => {
  cleanup();
});

// A guard against the most common false-positive in this suite: asserting on a
// formatted date/number and getting a plain space where Intl emitted a
// non-breaking or narrow-no-break space. Gives a readable diff instead of
// "expected '1 234 €' to be '1 234 €'".
expect.addSnapshotSerializer({
  test: (val) => typeof val === "string" && /[  ]/.test(val),
  print: (val) =>
    JSON.stringify(
      (val as string).replace(/ /g, "<NBSP>").replace(/ /g, "<NNBSP>"),
    ),
});
