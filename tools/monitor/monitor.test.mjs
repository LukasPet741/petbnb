import { describe, expect, it } from "vitest";
import { FEATURES, featuresForPath } from "./features.mjs";
import {
  classifyResponse,
  parseGitStatus,
  parseGitLog,
  parsePytest,
  parseTsc,
  pathsInText,
  summarizeVitest,
  worst,
} from "./probes.mjs";

const TAB = String.fromCharCode(9);

describe("featuresForPath", () => {
  it("maps app code to the feature it belongs to", () => {
    expect(featuresForPath("src/components/collar/LiveDot.tsx")).toEqual(["collar"]);
    expect(featuresForPath("src/app/(app)/smart-id-demo/page.tsx")).toEqual(["smart-id"]);
    expect(featuresForPath("src/app/login/LoginClient.tsx")).toEqual(["auth"]);
    expect(featuresForPath("src/components/home/Hero.tsx")).toEqual(["landing"]);
  });

  it("keeps the Pi's code apart from the collar page", () => {
    expect(featuresForPath("iot-collar/collar/gps.py")).toEqual(["collar-hw"]);
    expect(featuresForPath("iot-collar/supabase/functions/collar-ingest/index.ts")).toEqual(["collar-hw"]);
  });

  it("sends database and edge-function work to the Supabase dot", () => {
    expect(featuresForPath("supabase/migrations/20261009_x.sql")).toEqual(["backend"]);
  });

  it("normalises Windows separators", () => {
    expect(featuresForPath("src\\components\\collar\\MiniMap.tsx")).toEqual(["collar"]);
  });

  it("falls back to the app shell for anything unmatched", () => {
    expect(featuresForPath("package.json")).toEqual(["shell"]);
    expect(featuresForPath("src/app/dev/")).toEqual(["shell"]);
  });

  it("gives every feature a unique id", () => {
    const ids = FEATURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("parseGitStatus", () => {
  const out = [
    "# branch.oid 77b44acc1f66d7d975fd72020bf6b339cde18874",
    "# branch.head feat/showcase",
    "# branch.upstream origin/feat/showcase",
    "# branch.ab +2 -1",
    "1 .M N... 100644 100644 100644 adf7 adf7 src/app/login/LoginClient.tsx",
    `2 RM N... 100644 100644 100644 b4f8 b4f8 R100 src/components/AuthShell.tsx${TAB}src/components/PasswordShell.tsx`,
    "? src/app/dev/",
    "",
  ].join("\n");

  it("reads branch, upstream and ahead/behind", () => {
    const s = parseGitStatus(out);
    expect(s.branch).toBe("feat/showcase");
    expect(s.upstream).toBe("origin/feat/showcase");
    expect(s.ahead).toBe(2);
    expect(s.behind).toBe(1);
  });

  it("lists changed, renamed and untracked files", () => {
    expect(parseGitStatus(out).files).toEqual([
      { xy: ".M", path: "src/app/login/LoginClient.tsx" },
      { xy: "RM", path: "src/components/AuthShell.tsx", from: "src/components/PasswordShell.tsx" },
      { xy: "??", path: "src/app/dev/" },
    ]);
  });

  it("leaves ahead/behind empty without an upstream", () => {
    const s = parseGitStatus("# branch.head main\n");
    expect(s.upstream).toBeNull();
    expect(s.ahead).toBeNull();
  });
});

describe("parseGitLog", () => {
  it("splits hash, age and subject", () => {
    expect(parseGitLog(`77b44ac${TAB}3 days ago${TAB}Give every page a title\n`)).toEqual([
      { hash: "77b44ac", when: "3 days ago", subject: "Give every page a title" },
    ]);
  });
});

describe("parseTsc", () => {
  it("counts errors and keeps file, line and message", () => {
    const r = parseTsc(
      "src/lib/a.ts(12,5): error TS2322: Type 'x' is not assignable.\nsrc/b.tsx(1,1): error TS1005: ';' expected.\n",
    );
    expect(r.errors).toBe(2);
    expect(r.items[0]).toEqual({ file: "src/lib/a.ts", line: 12, msg: "TS2322: Type 'x' is not assignable." });
  });

  it("reports zero on clean output", () => {
    expect(parseTsc("").errors).toBe(0);
  });
});

describe("summarizeVitest", () => {
  it("summarises the JSON reporter and lists failing files relative to the repo", () => {
    const root = "C:/Users/lkspe/petbnb";
    const json = {
      numTotalTestSuites: 3,
      numFailedTestSuites: 1,
      numTotalTests: 10,
      numFailedTests: 1,
      testResults: [
        { name: `${root}/src/a.test.ts`, status: "passed", assertionResults: [] },
        {
          name: "C:\\Users\\lkspe\\petbnb\\src\\components\\collar\\x.test.tsx",
          status: "failed",
          assertionResults: [{ fullName: "x works", status: "failed", failureMessages: ["boom\nstack"] }],
        },
      ],
    };
    const s = summarizeVitest(json, root);
    expect(s).toMatchObject({ files: 2, filesFailed: 1, tests: 10, testsFailed: 1 });
    expect(s.failures).toEqual([{ file: "src/components/collar/x.test.tsx", test: "x works", msg: "boom" }]);
  });
});

describe("parsePytest", () => {
  it("reads passed and failed counts from the summary line", () => {
    expect(parsePytest("....\n34 passed in 0.52s\n")).toEqual({ passed: 34, failed: 0 });
    expect(parsePytest("1 failed, 33 passed in 1.1s")).toEqual({ passed: 33, failed: 1 });
    expect(parsePytest("garbage")).toBeNull();
  });
});

describe("pathsInText", () => {
  it("finds repo paths in build output", () => {
    expect(pathsInText("Type error in ./src/components/collar/MiniMap.tsx:3:1\nat src/lib/x.ts")).toEqual([
      "src/components/collar/MiniMap.tsx",
      "src/lib/x.ts",
    ]);
  });
});

describe("classifyResponse", () => {
  it("treats 2xx, redirects and gated answers as up", () => {
    expect(classifyResponse({ status: 200, ms: 100 }, 1500)).toBe("ok");
    expect(classifyResponse({ status: 307, ms: 100 }, 1500)).toBe("ok");
    expect(classifyResponse({ status: 405, ms: 100 }, 1500)).toBe("ok");
  });

  it("flags slow, missing, broken and unreachable routes", () => {
    expect(classifyResponse({ status: 200, ms: 2000 }, 1500)).toBe("slow");
    expect(classifyResponse({ status: 404, ms: 50 }, 1500)).toBe("fail");
    expect(classifyResponse({ status: 500, ms: 50 }, 1500)).toBe("fail");
    expect(classifyResponse({ error: "ECONNREFUSED" }, 1500)).toBe("fail");
  });
});

describe("worst", () => {
  it("ranks fail > slow > ok > idle", () => {
    expect(worst(["ok", "slow", "idle"])).toBe("slow");
    expect(worst(["ok", "fail"])).toBe("fail");
    expect(worst([])).toBe("idle");
  });
});
