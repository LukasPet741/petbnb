import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  lookup,
  interpolate,
  LanguageProvider,
  useLanguage,
} from "@/context/LanguageContext";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
    })),
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}));

const STORAGE_KEY = "petbnb-locale";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lookup", () => {
  const dict = {
    common: { signIn: "Sign in", services: { walking: "Dog walking" } },
    tips: { "midday-heat": { tag: "Walking" } },
  };

  it("resolves a dotted path to its leaf string", () => {
    expect(lookup(dict, "common.services.walking")).toBe("Dog walking");
  });

  it("returns undefined for a key that does not exist", () => {
    expect(lookup(dict, "nope")).toBeUndefined();
  });

  it("returns the intermediate object for a partial path", () => {
    // t() then rejects it for not being a string and echoes the key back.
    expect(lookup(dict, "common.services")).toEqual({ walking: "Dog walking" });
  });

  it("returns undefined when the path runs past a string leaf", () => {
    // Strings are not objects, so the typeof guard stops the descent.
    expect(lookup(dict, "common.signIn.length")).toBeUndefined();
  });

  it("resolves a hyphenated segment, which every tip id uses", () => {
    expect(lookup(dict, "tips.midday-heat.tag")).toBe("Walking");
  });

  it.each([
    ["an empty key", ""],
    ["a leading dot", ".common"],
    ["a trailing dot", "common."],
    ["a doubled dot", "common..signIn"],
  ])("returns undefined for %s", (_label, key) => {
    expect(lookup(dict, key)).toBeUndefined();
  });

  it("returns undefined for every key against an empty dictionary", () => {
    expect(lookup({}, "common.signIn")).toBeUndefined();
  });

  it("returns undefined for a very deep key without blowing the stack", () => {
    expect(lookup(dict, Array(100).fill("a").join("."))).toBeUndefined();
  });

  // BUG (latent, currently harmless): the `in` operator walks the prototype
  // chain, so inherited Object.prototype members resolve as if they were
  // dictionary entries. t() happens to contain the damage because it rejects
  // any non-string, but lookup() on its own is unsound.
  // Correct behaviour would be Object.hasOwn(node, part).
  it("leaks Object.prototype members through the in operator (current behaviour)", () => {
    expect(typeof lookup(dict, "toString")).toBe("function");
    expect(lookup(dict, "constructor")).toBe(Object);
    expect(lookup(dict, "common.hasOwnProperty")).toBe(
      Object.prototype.hasOwnProperty,
    );
  });
});

describe("interpolate", () => {
  it("substitutes a named placeholder", () => {
    expect(interpolate("Hi {name}", { name: "Jonas" })).toBe("Hi Jonas");
  });

  it("returns the text untouched, braces and all, when vars is undefined", () => {
    // This is why a t() call that forgets its vars shows literal braces.
    expect(interpolate("Hi {name}")).toBe("Hi {name}");
  });

  it("leaves a placeholder literal when vars is empty", () => {
    expect(interpolate("Hi {name}", {})).toBe("Hi {name}");
  });

  it("leaves an unmatched placeholder visible to the user", () => {
    expect(interpolate("{a} and {b}", { a: "1" })).toBe("1 and {b}");
  });

  it("ignores extra vars", () => {
    expect(interpolate("Hi {name}", { name: "A", unused: "B" })).toBe("Hi A");
  });

  it("replaces every occurrence of a repeated placeholder", () => {
    expect(interpolate("{a}-{a}", { a: "x" })).toBe("x-x");
  });

  it("does not re-scan substituted text, so a value containing braces is safe", () => {
    // Guards against a template-injection style bug.
    expect(interpolate("{a}", { a: "{b}" })).toBe("{b}");
  });

  it("treats dollar patterns in the value literally", () => {
    // Because the replacer is a function, "$&" and "$1" are not special.
    expect(interpolate("{a}", { a: "$&" })).toBe("$&");
    expect(interpolate("{a}", { a: "$1" })).toBe("$1");
  });

  it.each([
    [0, "0"],
    [-0, "0"],
    [12.5, "12.5"],
    [NaN, "NaN"],
    [Infinity, "Infinity"],
    [1e21, "1e+21"],
  ])("stringifies the numeric value %p as %s", (value, expected) => {
    expect(interpolate("{n}", { n: value })).toBe(expected);
  });

  it.each([
    ["a hyphen", "{first-name}"],
    ["a dot", "{first.name}"],
    ["surrounding spaces", "{ name }"],
    ["nothing", "{}"],
    ["no closing brace", "{name"],
  ])("does not match a placeholder containing %s", (_label, text) => {
    expect(interpolate(text, { name: "X", "first-name": "X" })).toBe(text);
  });

  it("substitutes the inner braces of a doubled placeholder", () => {
    expect(interpolate("{{name}}", { name: "X" })).toBe("{X}");
  });

  it("does not match a placeholder name containing a Lithuanian diacritic", () => {
    // \w is ASCII-only. Pinned because the LT dictionary is full of diacritics
    // and a translator could easily localise a placeholder name by accident.
    expect(interpolate("{miestąs}", { miestąs: "Vilnius" })).toBe("{miestąs}");
  });

  it("returns a value verbatim without HTML-escaping it", () => {
    // Safe today only because React escapes on render. A future consumer using
    // dangerouslySetInnerHTML would turn this into an XSS hole.
    expect(interpolate("{a}", { a: "<img src=x onerror=alert(1)>" })).toBe(
      "<img src=x onerror=alert(1)>",
    );
  });

  // BUG: `name in vars` also walks the prototype chain, so Object.prototype
  // members resolve as if the caller had supplied them - and unlike lookup(),
  // there is no typeof guard downstream to contain it. The function source is
  // stringified straight into user-visible copy.
  // Correct behaviour would be Object.hasOwn(vars, name).
  it("substitutes inherited Object.prototype members into the UI (current buggy behaviour)", () => {
    const out = interpolate("value: {toString}", {});
    expect(out).toContain("function toString()");
    expect(out).not.toBe("value: {toString}");
  });

  it.each(["constructor", "valueOf", "hasOwnProperty"])(
    "also substitutes the inherited %s member (current buggy behaviour)",
    (name) => {
      expect(interpolate(`{${name}}`, {})).not.toBe(`{${name}}`);
    },
  );

  it("returns an empty string unchanged", () => {
    expect(interpolate("", { a: "x" })).toBe("");
  });
});

// A probe component that surfaces the context through the DOM, so assertions
// are on real rendered output rather than on hook internals.
function Probe({ tKey, vars }: { tKey: string; vars?: Record<string, string | number> }) {
  const { t, locale, setLocale } = useLanguage();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="value">{t(tKey, vars)}</span>
      <button onClick={() => setLocale("lt")}>to-lt</button>
      <button onClick={() => setLocale("en")}>to-en</button>
    </div>
  );
}

describe("t", () => {
  it("returns the English string by default", () => {
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("value")).toHaveTextContent("Sign in");
  });

  it("returns the Lithuanian string after switching locale", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole("button", { name: "to-lt" }));
    expect(screen.getByTestId("locale")).toHaveTextContent("lt");
    expect(screen.getByTestId("value")).not.toHaveTextContent("Sign in");
  });

  it("renders the raw key when the key exists in neither dictionary", () => {
    // This is how a typo reaches production: as visible dot-path text.
    render(
      <LanguageProvider>
        <Probe tKey="does.not.exist" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("value")).toHaveTextContent("does.not.exist");
  });

  it("renders the raw key when the key resolves to an object", () => {
    render(
      <LanguageProvider>
        <Probe tKey="common.services" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("value")).toHaveTextContent("common.services");
  });

  it("interpolates vars into the resolved string", () => {
    render(
      <LanguageProvider>
        <Probe tKey="common.experienceSuffix" vars={{ years: 3 }} />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("value").textContent).toContain("3");
  });
});

describe("LanguageProvider persistence", () => {
  it("initialises its state to English before any effect runs", () => {
    // The stored value is only read in a post-mount effect, so the server and
    // first client render are always English - which is why LanguageSwitcher
    // carries suppressHydrationWarning. RTL flushes effects during render(),
    // so the initial paint is asserted on the initial state directly rather
    // than through the DOM.
    window.localStorage.setItem(STORAGE_KEY, "lt");
    let firstPaintLocale: string | undefined;
    function CaptureFirstPaint() {
      const { locale } = useLanguage();
      firstPaintLocale ??= locale;
      return null;
    }
    render(
      <LanguageProvider>
        <CaptureFirstPaint />
      </LanguageProvider>,
    );
    expect(firstPaintLocale).toBe("en");
  });

  it("adopts a valid stored locale after mount", () => {
    window.localStorage.setItem(STORAGE_KEY, "lt");
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("lt");
  });

  it.each([
    ["wrong case", "EN"],
    ["trailing whitespace", "en "],
    ["an unsupported language", "fr"],
    ["the string null", "null"],
    ["an object literal", "{}"],
    ["an empty string", ""],
  ])("rejects a stored locale with %s and stays on English", (_label, stored) => {
    window.localStorage.setItem(STORAGE_KEY, stored);
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("falls back to English when localStorage throws on read", () => {
    // Safari private mode, or a browser configured to block site data.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("access denied");
    });
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("still applies the locale in-session when localStorage throws on write", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole("button", { name: "to-lt" }));
    expect(screen.getByTestId("locale")).toHaveTextContent("lt");
  });

  it("persists the chosen locale to localStorage", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole("button", { name: "to-lt" }));
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("lt");
  });

  it("round-trips a stored locale back out on the next mount", async () => {
    const user = userEvent.setup();
    const first = render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    await user.click(screen.getByRole("button", { name: "to-lt" }));
    first.unmount();

    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    expect(screen.getByTestId("locale")).toHaveTextContent("lt");
  });

  it("sets the document language attribute so screen readers announce correctly", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Probe tKey="common.signIn" />
      </LanguageProvider>,
    );
    expect(document.documentElement.lang).toBe("en");
    await user.click(screen.getByRole("button", { name: "to-lt" }));
    expect(document.documentElement.lang).toBe("lt");
  });
});

describe("useLanguage outside a provider", () => {
  it("echoes the key back, so a missing provider shows dot-paths rather than crashing", () => {
    render(<Probe tKey="common.signIn" />);
    expect(screen.getByTestId("value")).toHaveTextContent("common.signIn");
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });

  it("makes setLocale a silent no-op", async () => {
    const user = userEvent.setup();
    render(<Probe tKey="common.signIn" />);
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "to-lt" }));
    });
    expect(screen.getByTestId("locale")).toHaveTextContent("en");
  });
});
