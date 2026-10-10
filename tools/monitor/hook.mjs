#!/usr/bin/env node
// Claude Code hook: every session in petbnb reports what it does to the monitor, by
// itself, between the steps agents post with agent.mjs. Wired in .claude/settings.local.json
// for SessionStart, UserPromptSubmit, PostToolUse and Stop; the meaning of each event is
// in live.mjs.
//
// It must never get in a session's way: no output, every error swallowed, exit 0.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATA_DIR, appendFeed } from "./agents.mjs";
import { describeEvent } from "./live.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

try {
  const ev = JSON.parse(fs.readFileSync(0, "utf8"));
  const d = describeEvent(ev, ROOT);
  const id = String(ev.session_id ?? "").replace(/[^\w-]/g, "").slice(0, 8);
  if (d && id) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const file = path.join(DATA_DIR, `session-${id}.json`);
    let since = Date.now();
    try {
      since = JSON.parse(fs.readFileSync(file, "utf8")).since ?? since;
    } catch {
      /* first event of this session */
    }
    const at = Date.now();
    fs.writeFileSync(file, JSON.stringify({ id, where: d.where, doing: d.doing, state: d.state, at, since }));
    if (d.feed) appendFeed({ type: "tool", role: "claude", session: id, text: d.feed.text, features: d.feed.features });
  }
} catch {
  /* never block or break a session */
}
