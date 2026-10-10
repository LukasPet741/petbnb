// The agent space: a board of proposals and a feed of what agents do, shown
// live on the monitor. Shared by the monitor (server.mjs) and the CLI agents
// report through (agent.mjs). The data lives in tools/monitor/.data/ — local
// to this machine and git-ignored.
//
// The board encodes the human gate: agents propose and build, but only Lukas
// (through the monitor) approves a proposal or marks work shipped.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// MONITOR_DATA points a throwaway monitor (tests, trials) at its own board.
export const DATA_DIR = process.env.MONITOR_DATA ?? path.join(path.dirname(fileURLToPath(import.meta.url)), ".data");
export const BOARD_FILE = path.join(DATA_DIR, "board.json");
export const FEED_FILE = path.join(DATA_DIR, "feed.jsonl");
export const RUN_FILE = path.join(DATA_DIR, "run.json");

export const OPEN_STATUSES = ["proposed", "approved", "building", "review"];
const STALLED_MS = 2 * 3600e3;

const ACTIONS = {
  approve: { from: ["proposed", "parked"], to: "approved", who: "lukas" },
  park: { from: ["proposed", "approved", "review"], to: "parked", who: "lukas" },
  ship: { from: ["review"], to: "shipped", who: "lukas" },
  reopen: { from: ["review"], to: "approved", who: "lukas" },
  build: { from: ["approved"], to: "building", who: "agent" },
  review: { from: ["building"], to: "review", who: "agent" },
  drop: { from: ["building"], to: "approved", who: "agent" },
};

export const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

/** Adds a proposal; returns the new board and the item. Throws on bad input. */
export function addProposal(board, input, now = Date.now()) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("a proposal needs a title");
  if (!input.why || input.why === true) throw new Error('say why it matters: --why "…"');
  const effort = String(input.effort ?? "M").toUpperCase();
  if (!["S", "M", "L"].includes(effort)) throw new Error("effort must be S, M or L");
  const base = slugify(title) || "item";
  let id = base;
  for (let n = 2; board.items.some((i) => i.id === id); n++) id = `${base}-${n}`;
  const item = {
    id,
    title,
    why: String(input.why),
    needs: input.needs && input.needs !== true ? String(input.needs) : null,
    effort,
    feature: input.feature ?? null,
    status: "proposed",
    by: input.by ?? "agent",
    branch: null,
    howToTry: null,
    createdAt: now,
    updatedAt: now,
  };
  return { board: { ...board, items: [...board.items, item] }, item };
}

/** Moves an item along the board. `actor` is "lukas" (the monitor) or "agent" (the CLI). */
export function transition(board, id, action, actor, extra = {}, now = Date.now()) {
  const rule = ACTIONS[action];
  if (!rule) throw new Error(`unknown action "${action}"`);
  if (rule.who !== actor) {
    throw new Error(rule.who === "lukas" ? `only Lukas can ${action} — on the monitor` : `only an agent can ${action}`);
  }
  const item = board.items.find((i) => i.id === id);
  if (!item) throw new Error(`no item "${id}" on the board`);
  if (!rule.from.includes(item.status)) {
    throw new Error(`"${id}" is ${item.status}; ${action} needs it ${rule.from.join(" or ")}`);
  }
  const next = { ...item, ...extra, status: rule.to, updatedAt: now };
  return { ...board, items: board.items.map((i) => (i.id === id ? next : i)) };
}

/** The run an agent is in the middle of, or null when the newest run has finished. */
export function deriveNow(feed, now = Date.now()) {
  const newest = [...feed].reverse().find((e) => e.run);
  if (!newest) return null;
  const entries = feed.filter((e) => e.run === newest.run);
  const last = entries[entries.length - 1];
  if (last.type === "done" || last.type === "fail") return null;
  const start = entries.find((e) => e.type === "start") ?? entries[0];
  return {
    run: newest.run,
    role: start.role,
    task: start.text,
    item: start.item ?? null,
    startedAt: start.at,
    updatedAt: last.at,
    stalled: now - last.at > STALLED_MS,
    steps: entries.filter((e) => e.type === "step").slice(-6),
  };
}

/** argv → positionals and --flags ("--x value", or a bare "--x" as true). */
export function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out._.push(a);
      continue;
    }
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) out.flags[a.slice(2)] = true;
    else {
      out.flags[a.slice(2)] = next;
      i++;
    }
  }
  return out;
}

// ── files ───────────────────────────────────────────────────────────────────
function writeAtomic(file, text) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function loadBoard() {
  try {
    const b = JSON.parse(fs.readFileSync(BOARD_FILE, "utf8"));
    return Array.isArray(b.items) ? b : { items: [] };
  } catch {
    return { items: [] };
  }
}

export const saveBoard = (board) => writeAtomic(BOARD_FILE, JSON.stringify(board, null, 2) + "\n");

export function appendFeed(entry) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const at = Date.now();
  const full = { id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at, ...entry };
  fs.appendFileSync(FEED_FILE, JSON.stringify(full) + "\n");
  return full;
}

export function readFeed(limit = 400) {
  let lines;
  try {
    lines = fs.readFileSync(FEED_FILE, "utf8").split("\n").filter(Boolean);
  } catch {
    return [];
  }
  // Keep the file small: past 3000 lines, rewrite it with the newest 2000.
  if (lines.length > 3000) {
    lines = lines.slice(-2000);
    writeAtomic(FEED_FILE, lines.join("\n") + "\n");
  }
  return lines
    .slice(-limit)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export function readRun() {
  try {
    return JSON.parse(fs.readFileSync(RUN_FILE, "utf8"));
  } catch {
    return null;
  }
}
export const writeRun = (run) => (run ? writeAtomic(RUN_FILE, JSON.stringify(run)) : fs.rmSync(RUN_FILE, { force: true }));
