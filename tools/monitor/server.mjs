// petbnb monitor — `npm run monitor` (add `-- --no-open` to skip the browser).
//
// A local-only dashboard: dev server (start/stop/log/sweep), git, prod and
// Supabase health, and on-demand checks (vitest, tsc, pytest, next build).
// Live state goes to the page over SSE. Binds to 127.0.0.1 because it can
// start processes; POSTs need an `x-monitor` header so other sites can't
// trigger them from your browser.

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile, execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { FEATURES, featuresForPath } from "./features.mjs";
import { DATA_DIR, appendFeed, deriveNow, loadBoard, readFeed, saveBoard, transition } from "./agents.mjs";
import {
  classifyResponse,
  parseGitLog,
  parseGitStatus,
  parsePytest,
  parseTsc,
  parseWorktrees,
  pathsInText,
  probeUrl,
  run,
  summarizeVitest,
  worst,
} from "./probes.mjs";
import { sessionView } from "./live.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PROD = "https://petbnb.lt";
const IS_WIN = process.platform === "win32";
const STATE_DIR = path.join(os.tmpdir(), "petbnb-monitor");
const STATE_FILE = path.join(STATE_DIR, "state.json");
const VITEST_JSON = path.join(STATE_DIR, "vitest.json");
const PROD_EVERY_MS = 5 * 60_000;
const SLOW_MS = { dev: 4000, prod: 1500 };
const LOG_LINES = 500;
const ALL_ROUTES = [...new Set(FEATURES.flatMap((f) => f.routes))];

// Which features a passing check vouches for.
const SRC_FEATURES = FEATURES.map((f) => f.id).filter((id) => id !== "collar-hw" && id !== "backend");
const COVERS = {
  vitest: FEATURES.map((f) => f.id),
  tsc: SRC_FEATURES,
  build: SRC_FEATURES,
  pytest: ["collar-hw"],
};

function blankCheck() {
  return { status: "never", summary: "not run yet", at: null, ms: null, details: [], attributed: {}, running: false };
}

const state = {
  repo: { branch: null, base: null, ahead: null, behind: null, files: [], commits: [], error: null },
  dev: { mode: "down", port: 3000, pid: null, last: null, sweeping: false },
  prod: { at: null, sweeping: false },
  supabase: null,
  system: {},
  checks: { vitest: blankCheck(), tsc: blankCheck(), pytest: blankCheck(), build: blankCheck() },
  queue: [],
  running: null,
  routes: { dev: {}, prod: {} },
  activity: [],
  lastPop: {},
};
const logs = { dev: [], vitest: [], tsc: [], pytest: [], build: [] };

// ── persistence (system temp, nothing lands in the repo) ────────────────────
function load() {
  try {
    const saved = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    for (const k of Object.keys(state.checks)) {
      if (saved.checks?.[k]) state.checks[k] = { ...saved.checks[k], running: false };
    }
    state.routes.prod = saved.prod ?? {};
    state.prod.at = saved.prodAt ?? null;
    state.supabase = saved.supabase ?? null;
    state.activity = saved.activity ?? [];
  } catch {
    /* first run */
  }
}
function persist() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({
        checks: state.checks,
        prod: state.routes.prod,
        prodAt: state.prod.at,
        supabase: state.supabase,
        activity: state.activity.slice(0, 40),
      }),
    );
  } catch {
    /* best effort */
  }
}

// ── SSE plumbing ────────────────────────────────────────────────────────────
const clients = new Set();
const sse = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
function broadcast(event, data) {
  const msg = sse(event, data);
  for (const c of clients) c.write(msg);
}

let stateTimer = null;
function scheduleState() {
  if (stateTimer) return;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    broadcast("state", snapshot());
  }, 120);
}

const pendingLogs = {};
let logTimer = null;
function pushLog(name, line) {
  const buf = logs[name];
  buf.push(line);
  if (buf.length > LOG_LINES) buf.splice(0, buf.length - LOG_LINES);
  (pendingLogs[name] ??= []).push(line);
  logTimer ??= setTimeout(() => {
    logTimer = null;
    for (const [n, lines] of Object.entries(pendingLogs)) broadcast("log", { name: n, lines });
    for (const k of Object.keys(pendingLogs)) delete pendingLogs[k];
  }, 200);
}

function activity(kind, text, features = [], extra = {}) {
  const entry = { at: Date.now(), kind, text, features, ...extra };
  state.activity.unshift(entry);
  state.activity.length = Math.min(state.activity.length, 80);
  for (const id of features) state.lastPop[id] = { at: entry.at, text };
  broadcast("activity", entry);
}

// ── feature view + pops ─────────────────────────────────────────────────────
const devLive = () => state.dev.mode === "running" || state.dev.mode === "external";

function featureView() {
  const dirty = {};
  for (const f of state.repo.files) for (const id of f.features) (dirty[id] ??= []).push(f.path);
  return FEATURES.map((f) => {
    const local = [];
    if (devLive()) {
      for (const r of f.routes) if (state.routes.dev[r]) local.push(state.routes.dev[r].state);
      if (f.id === "shell" && state.dev.last) local.push(state.dev.last.state);
    }
    const checkFails = {};
    for (const [name, c] of Object.entries(state.checks)) {
      if (c.status === "pass" && COVERS[name].includes(f.id)) local.push("ok");
      if (c.status === "fail" && c.attributed[f.id]) {
        checkFails[name] = c.attributed[f.id];
        local.push("fail");
      }
    }
    let prod;
    if (f.id === "backend") prod = state.supabase ? [state.supabase.state] : [];
    else if (f.id === "shell") prod = state.routes.prod["/"] ? [state.routes.prod["/"].state] : [];
    else prod = f.routes.map((r) => state.routes.prod[r]?.state).filter(Boolean);
    return {
      id: f.id,
      label: f.label,
      routes: f.routes.map((r) => ({ path: r, dev: state.routes.dev[r] ?? null, prod: state.routes.prod[r] ?? null })),
      local: worst(local),
      prod: worst(prod),
      dirty: dirty[f.id] ?? [],
      checkFails,
      lastPop: state.lastPop[f.id] ?? null,
    };
  });
}

let lastView = [];
const labelOf = (id) => FEATURES.find((f) => f.id === id)?.label ?? id;

/** Recompute features; any colour flip becomes an activity line (which pops the dots). */
function changed(cause) {
  const view = featureView();
  const prev = new Map(lastView.map((f) => [f.id, f]));
  const flips = [];
  for (const f of view) {
    const p = prev.get(f.id);
    if (!p) continue;
    if (p.local !== f.local) flips.push({ id: f.id, to: f.local, text: `${labelOf(f.id)} ${p.local}→${f.local}` });
    if (p.prod !== f.prod) flips.push({ id: f.id, to: `prod ${f.prod}`, text: `${labelOf(f.id)} prod ${p.prod}→${f.prod}` });
  }
  lastView = view;
  if (flips.length) {
    const ids = [...new Set(flips.map((x) => x.id))];
    const targets = [...new Set(flips.map((x) => x.to))];
    const body =
      flips.length <= 4
        ? flips.map((x) => x.text).join(", ")
        : targets.length === 1
          ? `${ids.length} features → ${targets[0]}`
          : `${ids.length} features changed`;
    activity("state", cause ? `${cause}: ${body}` : body, ids);
    lastView = featureView(); // pick up lastPop
  }
  scheduleState();
}

function snapshot() {
  return {
    now: Date.now(),
    prodUrl: PROD,
    repo: state.repo,
    dev: { ...state.dev, child: Boolean(devChild) },
    prod: state.prod,
    supabase: state.supabase,
    system: state.system,
    checks: state.checks,
    queue: state.queue,
    running: state.running,
    features: featureView(),
    agents: {
      board: agents.board.items,
      now: deriveNow(agents.feed),
      last: [...agents.feed].reverse().find((e) => e.type === "done" || e.type === "fail") ?? null,
      sessions: sessionView(agents.sessions),
    },
  };
}

// ── git ─────────────────────────────────────────────────────────────────────
function git(args) {
  return new Promise((resolve) =>
    execFile("git", ["--no-optional-locks", ...args], { cwd: ROOT, windowsHide: true, maxBuffer: 8e6 }, (err, out, errOut) =>
      resolve({ ok: !err, out: String(out), err: String(errOut || err?.message || "") }),
    ),
  );
}

// Agents build in worktrees next to petbnb (DRIVE.md). Without these, their commits and
// unsaved work were invisible here until they posted a step.
async function scanWorktrees(currentBranch) {
  const wt = await git(["worktree", "list", "--porcelain"]);
  if (!wt.ok) return [];
  const others = parseWorktrees(wt.out).filter((w) => path.resolve(w.path) !== path.resolve(ROOT));
  return Promise.all(
    others.map(async (w) => {
      const [last, ahead, dirty] = await Promise.all([
        git(["-C", w.path, "log", "-1", "--pretty=format:%h%x09%cr%x09%s"]),
        w.branch && currentBranch ? git(["rev-list", "--count", `${currentBranch}..${w.branch}`]) : null,
        git(["-C", w.path, "status", "--porcelain"]),
      ]);
      return {
        name: path.basename(w.path),
        branch: w.branch,
        ahead: ahead?.ok ? Number(ahead.out.trim()) : null,
        dirty: dirty.ok ? dirty.out.split(/\r?\n/).filter(Boolean).length : null,
        last: last.ok ? (parseGitLog(last.out)[0] ?? null) : null,
      };
    }),
  );
}

let repoBusy = false;
async function refreshRepo() {
  if (repoBusy) return;
  repoBusy = true;
  try {
    const st = await git(["status", "--porcelain=v2", "--branch"]);
    if (!st.ok) {
      state.repo = { ...state.repo, error: st.err.trim() || "git status failed" };
      return scheduleState();
    }
    const s = parseGitStatus(st.out);
    let { ahead, behind, upstream: base } = s;
    if (!base) {
      const rl = await git(["rev-list", "--left-right", "--count", "origin/main...HEAD"]);
      if (rl.ok) {
        [behind, ahead] = rl.out.trim().split(/\s+/).map(Number);
        base = "origin/main";
      }
    }
    const log = await git(["log", "-8", "--pretty=format:%h%x09%cr%x09%s"]);
    const next = {
      branch: s.branch,
      base,
      ahead,
      behind,
      files: s.files.map((f) => ({ ...f, features: featuresForPath(f.path) })),
      commits: log.ok ? parseGitLog(log.out) : [],
      worktrees: await scanWorktrees(s.branch),
      error: null,
    };
    if (JSON.stringify(next) !== JSON.stringify(state.repo)) {
      state.repo = next;
      changed(null);
    }
  } finally {
    repoBusy = false;
  }
}
let repoSoon = null;
const scheduleRepo = () => {
  clearTimeout(repoSoon);
  repoSoon = setTimeout(refreshRepo, 400);
};

// ── dev server ──────────────────────────────────────────────────────────────
let devChild = null;
let devPinging = false;

async function pingDev() {
  if (devPinging) return;
  devPinging = true;
  try {
    const r = await probeUrl(`http://localhost:${state.dev.port}/`, { timeoutMs: devChild ? 90_000 : 8_000 });
    const up = !r.error;
    const before = state.dev.mode;
    if (devChild) state.dev.mode = up ? "running" : before === "stopping" ? "stopping" : "starting";
    else state.dev.mode = up ? "external" : "down";
    state.dev.last = { ...r, state: classifyResponse(r, SLOW_MS.dev), at: Date.now() };
    if (up) state.routes.dev["/"] = state.dev.last;
    else state.routes.dev = {};
    if (state.dev.mode !== before) {
      const label = { running: "is up", external: "is up (started elsewhere)", down: "is down", starting: "is starting" };
      activity("dev", `dev server ${label[state.dev.mode] ?? state.dev.mode} on :${state.dev.port}`);
    }
    changed(state.dev.mode !== before ? `dev ${state.dev.mode}` : null);
  } finally {
    devPinging = false;
  }
}

function killTree(child) {
  if (!child?.pid) return;
  try {
    if (IS_WIN) execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: "ignore" });
    else child.kill("SIGTERM");
  } catch {
    /* already gone */
  }
}

function startDev() {
  if (devChild || devLive()) return;
  logs.dev = [];
  broadcast("log-reset", { name: "dev" });
  const { child, done } = run("npm run dev", {
    cwd: ROOT,
    onLine: (line) => {
      pushLog("dev", line);
      const m = line.match(/Local:\s+https?:\/\/localhost:(\d+)/);
      if (m) state.dev.port = Number(m[1]);
      if (/ready in|✓ Ready/i.test(line)) pingDev();
    },
  });
  devChild = child;
  state.dev.pid = child.pid;
  state.dev.mode = "starting";
  activity("dev", "starting the dev server (npm run dev)");
  changed(null);
  done.then(({ code }) => {
    devChild = null;
    state.dev.pid = null;
    state.dev.mode = "down";
    state.routes.dev = {};
    pushLog("dev", `── exited (${code}) ──`);
    activity("dev", `dev server stopped (exit ${code})`);
    changed("dev stopped");
  });
}

function stopDev() {
  if (!devChild) return;
  state.dev.mode = "stopping";
  changed(null);
  killTree(devChild);
}

async function sweepDev() {
  if (state.dev.sweeping || !devLive()) return;
  state.dev.sweeping = true;
  activity("dev", `sweeping ${ALL_ROUTES.length} dev routes (first hit compiles, second is timed)`);
  changed(null);
  for (const r of ALL_ROUTES) {
    if (!devLive()) break;
    const url = `http://localhost:${state.dev.port}${r}`;
    const first = await probeUrl(url, { timeoutMs: 120_000 });
    const warm = first.error ? first : await probeUrl(url, { timeoutMs: 30_000 });
    state.routes.dev[r] = { ...warm, compileMs: first.ms, state: classifyResponse(warm, SLOW_MS.dev), at: Date.now() };
    changed(`dev ${r}`);
  }
  state.dev.sweeping = false;
  const bad = ALL_ROUTES.filter((r) => state.routes.dev[r]?.state !== "ok");
  activity("dev", bad.length ? `dev sweep done — not ok: ${bad.join(", ")}` : "dev sweep done — all routes ok");
  changed(null);
}

// ── prod + Supabase ─────────────────────────────────────────────────────────
function readEnv() {
  try {
    const env = {};
    for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return env;
  } catch {
    return {};
  }
}

async function pingSupabase() {
  const env = readEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { state: "idle", error: "no Supabase URL/key in .env.local", at: Date.now() };
  const r = await probeUrl(`${url}/auth/v1/health`, { timeoutMs: 10_000, headers: { apikey: key } });
  return { ...r, state: r.status === 200 ? classifyResponse(r, SLOW_MS.prod) : "fail", at: Date.now() };
}

async function sweepProd() {
  if (state.prod.sweeping) return;
  state.prod.sweeping = true;
  changed(null);
  const queue = [...ALL_ROUTES];
  const worker = async () => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const x = await probeUrl(PROD + r, { timeoutMs: 10_000 });
      state.routes.prod[r] = { ...x, state: classifyResponse(x, SLOW_MS.prod), at: Date.now() };
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  state.supabase = await pingSupabase();
  state.prod.sweeping = false;
  state.prod.at = Date.now();
  const bad = ALL_ROUTES.filter((r) => state.routes.prod[r].state !== "ok");
  activity("prod", bad.length ? `prod: not ok — ${bad.join(", ")}` : `prod: ${ALL_ROUTES.length} routes ok, Supabase ${state.supabase.state}`);
  changed("prod");
  persist();
}
const maybeSweepProd = () => {
  if (clients.size && Date.now() - (state.prod.at ?? 0) > PROD_EVERY_MS) sweepProd();
};

// ── checks (one at a time: RAM is the ceiling on this machine) ──────────────
let checkChild = null;

function exec(name, command, opts = {}) {
  const { child, done } = run(command, { cwd: ROOT, ...opts, onLine: (l) => pushLog(name, l) });
  checkChild = child;
  return done.finally(() => {
    checkChild = null;
  });
}

const tail = (out, n) =>
  out
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(-n)
    .map((text) => ({ text }));

function attribute(paths, fallback = "shell") {
  const counts = {};
  for (const p of paths) for (const id of featuresForPath(p)) counts[id] = (counts[id] ?? 0) + 1;
  if (!paths.length && fallback) counts[fallback] = 1;
  return counts;
}

const CHECKS = {
  async vitest() {
    fs.rmSync(VITEST_JSON, { force: true });
    const r = await exec("vitest", `npx vitest run --reporter=dot --reporter=json --outputFile.json="${VITEST_JSON}"`);
    let json;
    try {
      json = JSON.parse(fs.readFileSync(VITEST_JSON, "utf8"));
    } catch {
      return { status: "fail", ms: r.ms, summary: "vitest crashed — no report", details: tail(r.out, 20), attributed: { shell: 1 } };
    }
    const s = summarizeVitest(json, ROOT);
    const ok = r.code === 0 && s.testsFailed === 0 && s.filesFailed === 0;
    return {
      status: ok ? "pass" : "fail",
      ms: r.ms,
      summary: `${s.tests - s.testsFailed}/${s.tests} tests · ${s.files} files${ok ? "" : ` · ${s.testsFailed || s.filesFailed} failing`}`,
      details: s.failures.slice(0, 40).map((f) => ({ file: f.file, text: `${f.test} — ${f.msg}` })),
      attributed: ok ? {} : attribute(s.failures.map((f) => f.file)),
    };
  },

  async tsc() {
    const r = await exec("tsc", "npx tsc --noEmit --pretty false");
    const t = parseTsc(r.out);
    const ok = r.code === 0 && t.errors === 0;
    return {
      status: ok ? "pass" : "fail",
      ms: r.ms,
      summary: ok ? "0 type errors" : `${t.errors || "?"} type error${t.errors === 1 ? "" : "s"}`,
      details: t.errors ? t.items.slice(0, 40).map((e) => ({ file: e.file, text: `:${e.line} ${e.msg}` })) : ok ? [] : tail(r.out, 15),
      attributed: ok ? {} : attribute(t.items.map((e) => e.file)),
    };
  },

  async pytest() {
    const py = path.join(ROOT, "iot-collar", ".venv", IS_WIN ? "Scripts/python.exe" : "bin/python");
    if (!fs.existsSync(py)) return { status: "unavailable", ms: 0, summary: "no iot-collar/.venv", details: [], attributed: {} };
    const r = await exec("pytest", `"${py}" -m pytest -q`, { cwd: path.join(ROOT, "iot-collar") });
    const p = parsePytest(r.out);
    const ok = r.code === 0 && p && p.failed === 0;
    return {
      status: ok ? "pass" : "fail",
      ms: r.ms,
      summary: p ? `${p.passed} passed${p.failed ? ` · ${p.failed} failed` : ""}` : "pytest gave no summary",
      details: ok ? [] : tail(r.out, 20),
      attributed: ok ? {} : { "collar-hw": p?.failed || 1 },
    };
  },

  async build() {
    // `next build` rewrites next-env.d.ts — put it back, but only if it was clean before.
    const wasClean = (await git(["diff", "--quiet", "--", "next-env.d.ts"])).ok;
    const r = await exec("build", "npx next build", { env: { NEXT_TELEMETRY_DISABLED: "1" } });
    if (wasClean && !(await git(["diff", "--quiet", "--", "next-env.d.ts"])).ok) {
      await git(["restore", "--", "next-env.d.ts"]);
      pushLog("build", "── monitor: restored next-env.d.ts ──");
    }
    const ok = r.code === 0;
    const compiled = r.out.match(/Compiled successfully in ([\d.]+\s*m?s)/);
    return {
      status: ok ? "pass" : "fail",
      ms: r.ms,
      summary: ok ? `built${compiled ? ` · compiled in ${compiled[1]}` : ""}` : "build failed",
      details: ok ? [] : tail(r.out, 25),
      attributed: ok ? {} : attribute(pathsInText(r.out)),
    };
  },
};

function enqueue(name) {
  if (!CHECKS[name] || state.running === name || state.queue.includes(name)) return;
  state.queue.push(name);
  changed(null);
  drain();
}

async function drain() {
  if (state.running || !state.queue.length) return;
  const name = state.queue.shift();
  state.running = name;
  state.checks[name].running = true;
  logs[name] = [];
  broadcast("log-reset", { name });
  activity("check", `${name} started`);
  changed(null);
  let result;
  try {
    result = await CHECKS[name]();
  } catch (e) {
    result = { status: "fail", ms: 0, summary: `monitor error: ${e.message}`, details: [], attributed: { shell: 1 } };
  }
  result.details = result.details.map((d) => (d.file ? { ...d, features: featuresForPath(d.file) } : d));
  const prev = state.checks[name];
  state.checks[name] = { ...result, at: Date.now(), running: false };
  state.running = null;
  pushLog(name, `── ${result.status}: ${result.summary} (${(result.ms / 1000).toFixed(1)} s) ──`);
  const flip = prev.status !== result.status && prev.status !== "never" ? ` (was ${prev.status})` : "";
  activity("check", `${name} ${result.status}: ${result.summary}${flip}`, Object.keys(result.attributed));
  changed(name);
  persist();
  drain();
}

// ── system ──────────────────────────────────────────────────────────────────
function refreshSystem() {
  const total = os.totalmem();
  const free = os.freemem();
  const next = { ramPct: Math.round((1 - free / total) * 100), freeGb: +(free / 2 ** 30).toFixed(1), totalGb: Math.round(total / 2 ** 30) };
  if (next.ramPct !== state.system.ramPct) {
    state.system = next;
    scheduleState();
  }
}

// ── file watching: a save makes its feature's dot pop ───────────────────────
const IGNORE = /(^|\/)(node_modules|\.next|\.venv|__pycache__|\.pytest_cache|\.temp|\.git|\.data)(\/|$)/;
const recentSave = new Map();
for (const dir of ["src", "iot-collar", "supabase", "tools"]) {
  try {
    fs.watch(path.join(ROOT, dir), { recursive: true }, (_evt, name) => {
      if (!name) return;
      const rel = `${dir}/${String(name).replaceAll("\\", "/")}`;
      // Editors' atomic-save temp files (x.tmp.123.abc, .swp, ~) are noise.
      if (IGNORE.test(rel) || /\.tmp\b|\.(pyc|log|tsbuildinfo|swp)$|~$/.test(rel)) return;
      const now = Date.now();
      // Windows also reports plain reads (last-access updates), so a test run
      // would look like a save storm. Only a fresh mtime — or a vanished file — counts.
      let st = null;
      try {
        st = fs.statSync(path.join(ROOT, rel));
      } catch {
        /* deleted or renamed away */
      }
      if (st && (st.isDirectory() || now - st.mtimeMs > 4000)) return;
      if (now - (recentSave.get(rel) ?? 0) < 1500) return;
      recentSave.set(rel, now);
      if (recentSave.size > 500) recentSave.clear();
      activity("file", st ? rel : `${rel} (removed)`, featuresForPath(rel));
      scheduleRepo();
    });
  } catch {
    /* folder missing */
  }
}

// ── agents: the board + feed that agent.mjs writes, shown live ──────────────
const FEATURE_IDS = new Set(FEATURES.map((f) => f.id));
const agents = { board: { items: [] }, feed: [], sessions: [], seen: new Set() };

// One file per Claude session, written by hook.mjs on every event. A day-old one is litter.
function readSessions() {
  const list = [];
  let names = [];
  try {
    names = fs.readdirSync(DATA_DIR);
  } catch {
    /* no data yet */
  }
  for (const f of names) {
    if (!/^session-[\w-]+\.json$/.test(f)) continue;
    const file = path.join(DATA_DIR, f);
    try {
      const s = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Date.now() - s.at > 24 * 3600e3) fs.rmSync(file, { force: true });
      else list.push(s);
    } catch {
      /* half-written; the next event rewrites it */
    }
  }
  return list;
}

// Which dots an agent's update pops: its --feature, else its board item's dot.
function popsFor(e) {
  if (e.features?.length) return e.features;
  const item = e.item && agents.board.items.find((i) => i.id === e.item);
  if (!item?.feature) return [];
  return [FEATURE_IDS.has(item.feature.id) ? item.feature.id : `item:${item.id}`];
}

function reloadAgents(announce = true) {
  agents.board = loadBoard();
  agents.feed = readFeed();
  agents.sessions = readSessions();
  for (const e of agents.feed) {
    if (agents.seen.has(e.id)) continue;
    agents.seen.add(e.id);
    if (announce) activity("agent", e.text, popsFor(e), { role: e.role ?? "agent" });
  }
  if (agents.seen.size > 5000) agents.seen = new Set(agents.feed.map((e) => e.id));
  scheduleState();
}

fs.mkdirSync(DATA_DIR, { recursive: true });
let agentsSoon = null;
fs.watch(DATA_DIR, () => {
  clearTimeout(agentsSoon);
  agentsSoon = setTimeout(() => reloadAgents(), 120);
});

const VERBS = { approve: "approved", park: "parked", ship: "crossed off ✓", reopen: "sent back" };
function boardAction(id, action) {
  try {
    const board = transition(loadBoard(), id, action, "lukas");
    saveBoard(board);
    const item = board.items.find((i) => i.id === id);
    appendFeed({ type: "move", role: "lukas", item: id, text: `${VERBS[action] ?? action} “${item.title}”` });
  } catch (e) {
    activity("agent", `board: ${e.message}`, [], { role: "lukas" });
  }
  reloadAgents();
}

// ── HTTP ────────────────────────────────────────────────────────────────────
const ACTIONS = {
  "dev/start": startDev,
  "dev/stop": stopDev,
  "dev/sweep": sweepDev,
  "prod/sweep": sweepProd,
  "check/all": () => ["tsc", "vitest", "pytest"].forEach(enqueue),
};

const server = http.createServer((req, res) => {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  if (host !== "127.0.0.1" && host !== "localhost") return res.writeHead(403).end();
  const url = new URL(req.url, "http://127.0.0.1");

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(fs.readFileSync(path.join(HERE, "page.html")));
  }

  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
    res.write("retry: 2000\n\n");
    res.write(sse("hello", { snapshot: snapshot(), logs, activity: state.activity, features: FEATURES.map((f) => f.id) }));
    clients.add(res);
    req.on("close", () => clients.delete(res));
    maybeSweepProd();
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/")) {
    if (req.headers["x-monitor"] !== "1") return res.writeHead(403).end();
    const key = url.pathname.slice(5);
    if (ACTIONS[key]) ACTIONS[key]();
    else if (key.startsWith("board/")) {
      const [, id, action] = key.split("/");
      boardAction(decodeURIComponent(id ?? ""), action);
    } else if (key.startsWith("check/")) enqueue(key.slice(6));
    else return res.writeHead(404).end();
    return res.writeHead(204).end();
  }

  res.writeHead(404).end();
});

function openBrowser(url) {
  const [cmd, args] = IS_WIN ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    /* no browser */
  }
}

function listen(port, triesLeft = 10) {
  const onError = (e) => {
    if (e.code === "EADDRINUSE" && triesLeft > 0) return listen(port + 1, triesLeft - 1);
    console.error(`monitor: ${e.message}`);
    process.exit(1);
  };
  server.once("error", onError);
  server.listen(port, "127.0.0.1", () => {
    server.off("error", onError);
    const url = `http://127.0.0.1:${port}`;
    console.log(`petbnb monitor → ${url}   (Ctrl+C stops it, and the dev server it started)`);
    if (!process.argv.includes("--no-open")) openBrowser(url);
  });
}

function shutdown() {
  killTree(devChild);
  killTree(checkChild);
  persist();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGHUP", shutdown); // Windows: the console window was closed

// ── go ──────────────────────────────────────────────────────────────────────
load();
reloadAgents(false);
lastView = featureView();
refreshSystem();
await refreshRepo();
await pingDev();
lastView = featureView();
setInterval(() => {
  refreshRepo();
  pingDev();
  refreshSystem();
}, 5000);
setInterval(maybeSweepProd, 30_000);
// A session that went silent turns "quiet" and then drops off without writing anything.
setInterval(() => {
  if (agents.sessions.length) scheduleState();
}, 30_000);
setInterval(() => {
  for (const c of clients) c.write(": ping\n\n");
}, 20_000);
listen(Number(process.env.MONITOR_PORT ?? 4545));
