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

/** Proposals the board keeps in stock for Lukas to choose from (see DRIVE.md, "Manager"). */
export const BOARD_TARGET = 5;

/** What the next session does: build what Lukas approved, else keep the board stocked. */
export function nextStep(items) {
  const approved = items.find((i) => i.status === "approved");
  if (approved) return { role: "conductor", item: approved.id, text: `conductor — build “${approved.title}” (${approved.id})` };
  const proposed = items.filter((i) => i.status === "proposed").length;
  if (proposed < BOARD_TARGET) {
    return { role: "evaluator", refill: true, text: `evaluator — the board holds ${proposed} of ${BOARD_TARGET} proposals: refill it, next lane in turn` };
  }
  return { role: "evaluator", refill: false, text: `evaluator — the board is full: sharpen a proposal or wait for Lukas` };
}

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

// Filler that says nothing about what an item is, so two titles are compared on substance.
const FILLER = new Set(["add", "the", "and", "for", "with", "your", "you", "its", "into", "from", "that", "this", "before", "after", "new", "let", "make"]);

/** A title's meaningful words: no lane prefix ("Legal: …"), no filler, plural s dropped. */
function words(title) {
  const body = String(title).replace(/^\s*[a-z &]{2,20}:\s*/i, "");
  return new Set(
    body
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !FILLER.has(w))
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w)),
  );
}

/**
 * The board item a new title repeats, or null. Shipped items count too: they are crossed off,
 * and crossed-off work is not proposed again. A match shares most of the shorter title's words,
 * and at least two of them, so "Google login" is not "Facebook login".
 */
export function findDuplicate(items, title) {
  const mine = words(title);
  for (const item of items) {
    const theirs = words(item.title);
    const shared = [...mine].filter((w) => theirs.has(w)).length;
    const same = shared === mine.size && shared === theirs.size;
    if (shared && (same || shared >= 2) && shared / Math.min(mine.size, theirs.size) >= 0.75) return item;
  }
  return null;
}

/** Adds a proposal; returns the new board and the item. Throws on bad input or a repeat. */
export function addProposal(board, input, now = Date.now()) {
  const title = String(input.title ?? "").trim();
  if (!title) throw new Error("a proposal needs a title");
  if (!input.why || input.why === true) throw new Error('say why it matters: --why "…"');
  const effort = String(input.effort ?? "M").toUpperCase();
  if (!["S", "M", "L"].includes(effort)) throw new Error("effort must be S, M or L");
  const dup = input.force ? null : findDuplicate(board.items, title);
  if (dup) {
    const where = dup.status === "shipped" ? "already done, crossed off" : `already on the board, ${dup.status}`;
    throw new Error(`${where}: “${dup.title}” (${dup.id}). Propose something else, or pass --force with a new reason`);
  }
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
