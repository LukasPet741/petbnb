import { describe, expect, it } from "vitest";
import { describeEvent, locate, sessionView } from "./live.mjs";

const ROOT = "C:\\Users\\lkspe\\petbnb";
const ev = (o) => ({ session_id: "abc12345-x", cwd: ROOT, hook_event_name: "PostToolUse", ...o });

describe("locate", () => {
  it("names the checkout next to petbnb and the path inside it", () => {
    expect(locate("C:\\Users\\lkspe\\petbnb-wt-ics\\src\\lib\\a.ts", ROOT)).toEqual({ where: "petbnb-wt-ics", rel: "src/lib/a.ts" });
    expect(locate("C:\\Users\\lkspe\\petbnb\\src\\a.ts", ROOT)).toEqual({ where: "petbnb", rel: "src/a.ts" });
  });

  it("keeps only the file name for anything outside the checkouts", () => {
    expect(locate("C:\\Users\\lkspe\\.claude\\memory\\notes.md", ROOT)).toEqual({ where: null, rel: "notes.md" });
  });
});

describe("describeEvent", () => {
  it("reports a worktree edit to the feed, with its feature dots", () => {
    const d = describeEvent(ev({ tool_name: "Edit", tool_input: { file_path: "C:\\Users\\lkspe\\petbnb-wt-ics\\src\\components\\BookingCard.tsx" } }), ROOT);
    expect(d).toMatchObject({ state: "working", where: "petbnb-wt-ics", doing: "edit src/components/BookingCard.tsx" });
    expect(d.feed.text).toBe("petbnb-wt-ics: edit src/components/BookingCard.tsx");
    expect(d.feed.features).toContain("bookings");
  });

  it("leaves edits in Lukas's checkout to the monitor's own file watcher", () => {
    const d = describeEvent(ev({ tool_name: "Write", tool_input: { file_path: ROOT + "\\src\\a.ts" } }), ROOT);
    expect(d.doing).toBe("edit src/a.ts");
    expect(d.feed).toBeUndefined();
  });

  it("reports a command by its description, in the checkout it cds into", () => {
    const d = describeEvent(ev({ tool_name: "Bash", tool_input: { command: "cd /c/Users/lkspe/petbnb-wt-ics && npx vitest run", description: "Run the tests" } }), ROOT);
    expect(d).toMatchObject({ where: "petbnb-wt-ics", doing: "run: Run the tests" });
    expect(d.feed.text).toBe("petbnb-wt-ics: run: Run the tests");
  });

  it("falls back to the command's first line", () => {
    const d = describeEvent(ev({ tool_name: "PowerShell", tool_input: { command: "git status\ngit log" } }), ROOT);
    expect(d.doing).toBe("run: git status");
  });

  it("marks presence for quiet tools without filling the feed", () => {
    const d = describeEvent(ev({ tool_name: "Read", tool_input: { file_path: ROOT + "\\a.ts" } }), ROOT);
    expect(d).toMatchObject({ state: "working", doing: "using Read", where: "petbnb" });
    expect(d.feed).toBeUndefined();
  });

  it("follows the session's life: start, a request from Lukas, waiting", () => {
    expect(describeEvent(ev({ hook_event_name: "SessionStart" }), ROOT)).toMatchObject({ state: "working", doing: "session started" });
    expect(describeEvent(ev({ hook_event_name: "UserPromptSubmit" }), ROOT)).toMatchObject({ state: "working", doing: "on a request from Lukas" });
    expect(describeEvent(ev({ hook_event_name: "Stop" }), ROOT)).toMatchObject({ state: "idle", doing: "waiting for Lukas" });
  });

  it("ignores events it does not know", () => {
    expect(describeEvent(ev({ hook_event_name: "PreCompact" }), ROOT)).toBeNull();
  });
});

describe("sessionView", () => {
  const NOW = 10_000_000;
  it("lists the freshest first, calls a silent worker quiet, and forgets the long gone", () => {
    const v = sessionView([
      { id: "a", state: "working", at: NOW - 10_000 },
      { id: "b", state: "working", at: NOW - 5 * 60e3 },
      { id: "c", state: "idle", at: NOW - 60e3 },
      { id: "d", state: "idle", at: NOW - 31 * 60e3 },
    ], NOW);
    expect(v.map((s) => [s.id, s.state])).toEqual([["a", "working"], ["c", "idle"], ["b", "quiet"]]);
  });
});
