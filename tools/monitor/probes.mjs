// Probes for the monitor: pure parsers (unit-tested) plus the two small
// side-effecting helpers that feed them — an HTTP probe and a process runner.

import { spawn } from "node:child_process";

const TAB = String.fromCharCode(9);
const ESC = String.fromCharCode(27);
// Colour codes in process output; built from a char code because escaped
// control characters in source have been mangled by editors here before.
const ANSI = new RegExp(`${ESC}[[][0-9;?]*[A-Za-z]`, "g");

export const stripAnsi = (s) => s.replace(ANSI, "");

const RANK = { idle: 0, ok: 1, slow: 2, fail: 3 };

/** The worst of a list of states: fail > slow > ok > idle. */
export function worst(states) {
  return states.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "idle");
}

/** ok | slow | fail for one HTTP probe. Redirects and 401/403/405 mean the route is alive. */
export function classifyResponse(r, slowMs) {
  if (r.error || !r.status) return "fail";
  if (r.status === 404 || r.status >= 500) return "fail";
  return r.ms > slowMs ? "slow" : "ok";
}

/** `git status --porcelain=v2 --branch` → branch, upstream, ahead/behind, files. */
export function parseGitStatus(out) {
  const s = { branch: null, upstream: null, ahead: null, behind: null, files: [] };
  for (const line of out.split(/\r?\n/)) {
    if (!line) continue;
    if (line.startsWith("# branch.head ")) s.branch = line.slice(14);
    else if (line.startsWith("# branch.upstream ")) s.upstream = line.slice(18);
    else if (line.startsWith("# branch.ab ")) {
      const [a, b] = line.slice(12).split(" ");
      s.ahead = Number(a.slice(1));
      s.behind = Number(b.slice(1));
    } else if (line.startsWith("1 ")) {
      const parts = line.split(" ");
      s.files.push({ xy: parts[1], path: parts.slice(8).join(" ") });
    } else if (line.startsWith("2 ")) {
      const [head, from] = line.split(TAB);
      const parts = head.split(" ");
      s.files.push({ xy: parts[1], path: parts.slice(9).join(" "), from });
    } else if (line.startsWith("? ")) {
      s.files.push({ xy: "??", path: line.slice(2) });
    } else if (line.startsWith("u ")) {
      const parts = line.split(" ");
      s.files.push({ xy: parts[1], path: parts.slice(10).join(" ") });
    }
  }
  return s;
}

/** `git log --pretty=format:%h%x09%cr%x09%s` → commits. */
export function parseGitLog(out) {
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [hash, when, ...rest] = line.split(TAB);
      return { hash, when, subject: rest.join(TAB) };
    });
}

/** `tsc --noEmit --pretty false` output → error count and the errors. */
export function parseTsc(out) {
  const items = [];
  for (const line of stripAnsi(out).split(/\r?\n/)) {
    const m = line.match(/^(.+?)\((\d+),\d+\): error (TS\d+: .*)$/);
    if (m) items.push({ file: m[1].replaceAll("\\", "/"), line: Number(m[2]), msg: m[3] });
  }
  return { errors: items.length, items };
}

/** Vitest's JSON reporter → counts plus failing tests with repo-relative files. */
export function summarizeVitest(json, root) {
  const base = root.replaceAll("\\", "/").replace(/\/$/, "") + "/";
  const rel = (p) => {
    const f = p.replaceAll("\\", "/");
    return f.toLowerCase().startsWith(base.toLowerCase()) ? f.slice(base.length) : f;
  };
  const failures = [];
  for (const file of json.testResults ?? []) {
    const failed = (file.assertionResults ?? []).filter((a) => a.status === "failed");
    for (const a of failed) {
      failures.push({ file: rel(file.name), test: a.fullName, msg: String(a.failureMessages?.[0] ?? "").split("\n")[0] });
    }
    // A file can fail without a failing test (import error, crash).
    if (file.status === "failed" && !failed.length) {
      failures.push({ file: rel(file.name), test: "(file failed to run)", msg: String(file.message ?? "").split("\n")[0] });
    }
  }
  return {
    files: json.testResults?.length ?? json.numTotalTestSuites ?? 0,
    filesFailed: json.numFailedTestSuites ?? 0,
    tests: json.numTotalTests ?? 0,
    testsFailed: json.numFailedTests ?? 0,
    failures,
  };
}

/** pytest's summary line → counts, or null when there is none. */
export function parsePytest(out) {
  const text = stripAnsi(out);
  const passed = text.match(/(\d+) passed/);
  const failed = text.match(/(\d+) (failed|error)/);
  if (!passed && !failed) return null;
  return { passed: passed ? Number(passed[1]) : 0, failed: failed ? Number(failed[1]) : 0 };
}

/** Repo paths (src/, iot-collar/, supabase/, tools/) mentioned in free text such as build output. */
export function pathsInText(text) {
  const found = new Set();
  for (const m of stripAnsi(text).matchAll(/(?:\.\/)?((?:src|iot-collar|supabase|tools)\/[\w./()[\]-]+\.[a-z]+)/g)) {
    found.add(m[1]);
  }
  return [...found];
}

/** One HTTP GET: status, time, redirect target or error. Never throws. */
export async function probeUrl(url, { timeoutMs = 10000, headers = {} } = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "user-agent": "petbnb-monitor", ...headers },
    });
    await res.arrayBuffer();
    return {
      status: res.status,
      ms: Math.round(performance.now() - t0),
      location: res.headers.get("location") ?? undefined,
    };
  } catch (e) {
    const cause = e?.cause?.code ?? e?.name ?? "error";
    return { error: cause === "TimeoutError" ? "timeout" : cause, ms: Math.round(performance.now() - t0) };
  }
}

/**
 * Runs a shell command, streaming lines to `onLine`. Resolves with the exit
 * code and the full output; never rejects. `child` is exposed for killing.
 */
export function run(command, { cwd, env, onLine = () => {} } = {}) {
  const child = spawn(command, {
    cwd,
    shell: true,
    windowsHide: true,
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", ...env },
  });
  let out = "";
  let pending = "";
  const feed = (chunk) => {
    const text = stripAnsi(chunk.toString());
    out += text;
    pending += text;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop();
    lines.forEach((l) => onLine(l));
  };
  child.stdout.on("data", feed);
  child.stderr.on("data", feed);
  const t0 = performance.now();
  const done = new Promise((resolve) => {
    child.on("error", (e) => resolve({ code: -1, out: out + String(e), ms: 0 }));
    child.on("close", (code) => {
      if (pending) onLine(pending);
      resolve({ code: code ?? -1, out, ms: Math.round(performance.now() - t0) });
    });
  });
  return { child, done };
}
