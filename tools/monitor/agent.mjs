#!/usr/bin/env node
// How agents report to the monitor. Every call appends to the feed (or edits
// the board) in tools/monitor/.data/; a running monitor shows it within a
// second, and nothing is lost when the monitor is closed. See DRIVE.md.

import { FEATURES } from "./features.mjs";
import {
  addProposal,
  appendFeed,
  loadBoard,
  parseArgs,
  readRun,
  saveBoard,
  slugify,
  transition,
  writeRun,
} from "./agents.mjs";

const USAGE = `petbnb agent → monitor

  node tools/monitor/agent.mjs board
  node tools/monitor/agent.mjs start <evaluator|conductor> "<what this run will do>" [--item <id>]
  node tools/monitor/agent.mjs step "<progress>" [--feature <feature-id>]
  node tools/monitor/agent.mjs done "<result>"          (or: fail "<why>")
  node tools/monitor/agent.mjs propose "<title>" --why "<value for the demo>" [--effort S|M|L]
                                       [--needs "<what only Lukas can do>"] [--feature "<dot label or id>"]
  node tools/monitor/agent.mjs build <item-id> --branch agent/<item-id>
  node tools/monitor/agent.mjs review <item-id> "<how Lukas tries it>"
  node tools/monitor/agent.mjs drop <item-id> "<why it goes back to the queue>"
  node tools/monitor/agent.mjs note "<anything Lukas should see>"

Approving and shipping happen on the monitor, by Lukas.`;

const { _: [cmd, ...pos], flags } = parseArgs(process.argv.slice(2));
const run = readRun();
const role = run?.role ?? "agent";
const say = (msg) => console.log(`✓ ${msg}`);
const need = (v, what) => {
  if (!v || v === true) throw new Error(`missing ${what}\n\n${USAGE}`);
  return String(v);
};

function featureRef(raw) {
  if (!raw || raw === true) return null;
  const known = FEATURES.find((f) => f.id === raw || f.label.toLowerCase() === String(raw).toLowerCase());
  return known ? { id: known.id, label: known.label } : { id: slugify(raw), label: String(raw) };
}

function move(id, action, extra, text) {
  const board = transition(loadBoard(), id, action, "agent", extra);
  saveBoard(board);
  appendFeed({ type: "move", role, run: run?.run, item: id, text });
  return board.items.find((i) => i.id === id);
}

function printBoard() {
  const items = loadBoard().items;
  if (!items.length) return console.log("The board is empty — run as evaluator and propose something.");
  for (const status of ["review", "building", "approved", "proposed", "parked", "shipped"]) {
    const list = items.filter((i) => i.status === status);
    if (!list.length) continue;
    console.log(`\n${status.toUpperCase()} (${list.length})`);
    for (const i of list) {
      console.log(`  ${i.id}  [${i.effort}]  ${i.title}${i.branch ? `  (${i.branch})` : ""}`);
      console.log(`      why: ${i.why}${i.needs ? `\n      needs Lukas: ${i.needs}` : ""}`);
    }
  }
}

try {
  switch (cmd) {
    case "board":
      printBoard();
      break;

    case "start": {
      const r = need(pos[0], "a role (evaluator or conductor)");
      if (!["evaluator", "conductor"].includes(r)) throw new Error("role must be evaluator or conductor");
      const next = { run: `${Date.now().toString(36)}`, role: r };
      writeRun(next);
      appendFeed({ type: "start", run: next.run, role: r, text: need(pos[1], "what this run will do"), item: flags.item ?? null });
      say(`${r} run started — Lukas sees it on the monitor`);
      break;
    }

    case "step": {
      if (!run) throw new Error('no run in progress — start one first: agent.mjs start <role> "…"');
      const feature = featureRef(flags.feature);
      appendFeed({ type: "step", run: run.run, role, text: need(pos[0], "the progress text"), features: feature ? [feature.id] : [] });
      say("step posted");
      break;
    }

    case "done":
    case "fail": {
      if (!run) throw new Error("no run in progress");
      appendFeed({ type: cmd, run: run.run, role, text: need(pos[0], cmd === "done" ? "the result" : "why it failed") });
      writeRun(null);
      say(`run ${cmd === "done" ? "finished" : "marked failed"}`);
      break;
    }

    case "propose": {
      const { board, item } = addProposal(loadBoard(), {
        title: need(pos[0], "a title"),
        why: flags.why,
        needs: flags.needs,
        effort: flags.effort,
        feature: featureRef(flags.feature),
        by: role,
      });
      saveBoard(board);
      appendFeed({ type: "propose", role, run: run?.run, item: item.id, text: `proposed “${item.title}” [${item.effort}]` });
      say(`proposed ${item.id} — waiting for Lukas to approve it on the monitor`);
      break;
    }

    case "build": {
      const id = need(pos[0], "an item id");
      const branch = flags.branch && flags.branch !== true ? String(flags.branch) : `agent/${id}`;
      const item = move(id, "build", { branch }, `building on ${branch}`);
      say(`building “${item.title}” on ${branch}`);
      break;
    }

    case "review": {
      const id = need(pos[0], "an item id");
      const item = move(id, "review", { howToTry: need(pos[1], "how Lukas tries it") }, "ready for Lukas to try");
      say(`“${item.title}” is in review — Lukas decides on the monitor`);
      break;
    }

    case "drop": {
      const id = need(pos[0], "an item id");
      const item = move(id, "drop", {}, `back to the queue: ${need(pos[1], "why")}`);
      say(`“${item.title}” is back in the queue`);
      break;
    }

    case "note":
      appendFeed({ type: "note", role, run: run?.run, text: need(pos[0], "the note") });
      say("note posted");
      break;

    default:
      console.log(USAGE);
      process.exitCode = cmd ? 1 : 0;
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exitCode = 1;
}
