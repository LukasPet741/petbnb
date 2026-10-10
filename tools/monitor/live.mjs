// What a Claude Code session is doing, from its hook events (see hook.mjs). Pure, so the
// tests can feed it events; hook.mjs does the reading and writing.
//
// Two outputs per event: presence (one line per session: where it is, what it does now)
// and, for the things Lukas wants to see happen, a feed entry. Edits in Lukas's own
// checkout are left to the monitor's file watcher, which already shows them.

import path from "node:path";
import { featuresForPath } from "./features.mjs";

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);
const RUN_TOOLS = new Set(["Bash", "PowerShell"]);
const AGENT_TOOLS = new Set(["Agent", "Task"]);

/** A session that has said nothing for this long is quiet; after the second, it is gone. */
export const QUIET_MS = 3 * 60e3;
export const GONE_MS = 30 * 60e3;

/**
 * Which checkout a file is in, and its path there. Checkouts sit side by side: petbnb itself
 * and its worktrees, named petbnb-<something> (DRIVE.md). Anything else keeps only its name.
 */
export function locate(file, root) {
  const base = path.win32.basename(root);
  const parts = path.win32.relative(path.win32.dirname(root), file).split(/[\\/]/);
  const [where, ...rest] = parts;
  if (where !== base && !where.startsWith(`${base}-`)) {
    return { where: null, rel: parts[parts.length - 1] };
  }
  return { where, rel: rest.join("/") };
}

/** A worktree a command works in, when it names one ("cd /c/…/petbnb-wt-ics && …"). */
function whereInCommand(command, base) {
  return new RegExp(`[\\\\/](${base}-[\\w.-]+)`).exec(command)?.[1] ?? null;
}

/** A hook event → { state, doing, where, feed? }, or null for events that say nothing. */
export function describeEvent(ev, root) {
  const base = path.win32.basename(root);
  const here = locate(ev.cwd ?? root, root).where ?? base;
  switch (ev.hook_event_name) {
    case "SessionStart":
      return { state: "working", doing: "session started", where: here };
    case "UserPromptSubmit":
      return { state: "working", doing: "on a request from Lukas", where: here };
    case "Stop":
      return { state: "idle", doing: "waiting for Lukas", where: here };
    case "PostToolUse":
      break;
    default:
      return null;
  }

  const tool = ev.tool_name;
  const input = ev.tool_input ?? {};
  if (EDIT_TOOLS.has(tool)) {
    const file = input.file_path ?? input.notebook_path;
    if (!file) return null;
    const { where, rel } = locate(file, root);
    const doing = `edit ${rel}`;
    const out = { state: "working", doing, where: where ?? here };
    if (where && where !== base) out.feed = { text: `${where}: ${doing}`, features: featuresForPath(rel) };
    return out;
  }
  if (RUN_TOOLS.has(tool) || AGENT_TOOLS.has(tool)) {
    const command = String(input.command ?? "");
    const what = String(input.description || command.split(/\r?\n/)[0] || tool).slice(0, 90);
    const doing = `${AGENT_TOOLS.has(tool) ? "subagent" : "run"}: ${what}`;
    const where = whereInCommand(command, base) ?? here;
    return { state: "working", doing, where, feed: { text: where === base ? doing : `${where}: ${doing}`, features: [] } };
  }
  return { state: "working", doing: tool ? `using ${tool}` : "working", where: here };
}

/** Sessions for the monitor: freshest first; a silent worker shows as quiet; the long gone drop off. */
export function sessionView(list, now = Date.now()) {
  return list
    .filter((s) => now - s.at < GONE_MS)
    .map((s) => (s.state === "working" && now - s.at > QUIET_MS ? { ...s, state: "quiet" } : s))
    .sort((a, b) => b.at - a.at);
}
