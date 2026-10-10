import { describe, expect, it } from "vitest";
import { BOARD_TARGET, addProposal, deriveNow, findDuplicate, mainFromGitFile, nextStep, parseArgs, slugify, transition } from "./agents.mjs";

const empty = () => ({ items: [] });
const withItem = (status) => ({
  items: [{ id: "facebook-login", title: "Facebook login", status, why: "w", effort: "S", feature: null }],
});

describe("slugify", () => {
  it("makes short stable ids", () => {
    expect(slugify("Facebook login")).toBe("facebook-login");
    expect(slugify("  Add to calendar (.ics)! ")).toBe("add-to-calendar-ics");
  });
});

describe("addProposal", () => {
  it("adds a proposed item with defaults", () => {
    const { board, item } = addProposal(empty(), { title: "Facebook login", why: "one-tap signup" }, 5);
    expect(item).toMatchObject({ id: "facebook-login", status: "proposed", effort: "M", needs: null, createdAt: 5 });
    expect(board.items).toHaveLength(1);
  });

  it("keeps ids unique when Lukas's agent re-proposes on purpose", () => {
    const first = addProposal(empty(), { title: "Facebook login", why: "a" }).board;
    expect(addProposal(first, { title: "Facebook login", why: "b", force: true }).item.id).toBe("facebook-login-2");
  });

  it("refuses what is done, open or parked, naming it", () => {
    const board = { items: [
      { id: "a", title: "Add a booked stay to your calendar", status: "shipped" },
      { id: "b", title: "Google login", status: "approved" },
    ] };
    expect(() => addProposal(board, { title: "Calendar: add a booked stay", why: "x" })).toThrow(/done, crossed off.*booked stay/);
    expect(() => addProposal(board, { title: "Reach: add Google login", why: "x" })).toThrow(/approved.*Google login/);
    expect(addProposal(board, { title: "Reach: Facebook login", why: "x" }).item.id).toBe("reach-facebook-login");
  });

  it("insists on a title, a reason and a known effort", () => {
    expect(() => addProposal(empty(), { title: "", why: "x" })).toThrow(/title/);
    expect(() => addProposal(empty(), { title: "x" })).toThrow(/why/);
    expect(() => addProposal(empty(), { title: "x", why: "y", effort: "XL" })).toThrow(/effort/);
  });
});

describe("transition — Lukas gates every build", () => {
  it("lets Lukas approve a proposal", () => {
    const b = transition(withItem("proposed"), "facebook-login", "approve", "lukas", {}, 9);
    expect(b.items[0]).toMatchObject({ status: "approved", updatedAt: 9 });
  });

  it("stops an agent from approving or shipping its own work", () => {
    expect(() => transition(withItem("proposed"), "facebook-login", "approve", "agent")).toThrow(/only Lukas/);
    expect(() => transition(withItem("review"), "facebook-login", "ship", "agent")).toThrow(/only Lukas/);
  });

  it("lets an agent build only what is approved", () => {
    expect(() => transition(withItem("proposed"), "facebook-login", "build", "agent")).toThrow(/is proposed/);
    const b = transition(withItem("approved"), "facebook-login", "build", "agent", { branch: "agent/facebook-login" });
    expect(b.items[0]).toMatchObject({ status: "building", branch: "agent/facebook-login" });
  });

  it("walks building → review → shipped", () => {
    let b = transition(withItem("building"), "facebook-login", "review", "agent", { howToTry: "click it" });
    expect(b.items[0].status).toBe("review");
    b = transition(b, "facebook-login", "ship", "lukas");
    expect(b.items[0].status).toBe("shipped");
  });

  it("reports unknown items and actions", () => {
    expect(() => transition(empty(), "nope", "approve", "lukas")).toThrow(/no item/);
    expect(() => transition(withItem("proposed"), "facebook-login", "teleport", "lukas")).toThrow(/unknown action/);
  });
});

describe("deriveNow", () => {
  const feed = [
    { run: "r1", type: "start", role: "evaluator", text: "look around", at: 1 },
    { run: "r1", type: "done", role: "evaluator", text: "3 proposals", at: 2 },
    { run: "r2", type: "start", role: "conductor", text: "build facebook-login", item: "facebook-login", at: 3 },
    { run: "r2", type: "step", role: "conductor", text: "tests written", at: 4 },
  ];

  it("returns the open run with its steps", () => {
    expect(deriveNow(feed, 5)).toMatchObject({
      run: "r2",
      role: "conductor",
      task: "build facebook-login",
      item: "facebook-login",
      startedAt: 3,
      updatedAt: 4,
      stalled: false,
      steps: [{ text: "tests written" }],
    });
  });

  it("is idle once the newest run is done", () => {
    expect(deriveNow(feed.slice(0, 2), 5)).toBeNull();
  });

  it("marks a run silent for two hours as stalled", () => {
    expect(deriveNow(feed, 4 + 2 * 3600e3 + 1).stalled).toBe(true);
  });
});

describe("parseArgs", () => {
  it("splits positionals and --flags", () => {
    expect(parseArgs(["propose", "Facebook login", "--why", "reach", "--effort", "S", "--dry"])).toEqual({
      _: ["propose", "Facebook login"],
      flags: { why: "reach", effort: "S", dry: true },
    });
  });
});

describe("nextStep", () => {
  const item = (id, status) => ({ id, title: id, status });

  it("builds what Lukas approved before anything else", () => {
    const step = nextStep([item("a", "proposed"), item("b", "approved")]);
    expect(step).toMatchObject({ role: "conductor", item: "b" });
  });

  it("refills a thin board, counting only proposals", () => {
    const step = nextStep([item("a", "proposed"), item("b", "review"), item("c", "building"), item("d", "shipped")]);
    expect(step).toMatchObject({ role: "evaluator", refill: true });
    expect(step.text).toContain(`1 of ${BOARD_TARGET}`);
  });

  it("stops proposing once the board is full", () => {
    const full = Array.from({ length: BOARD_TARGET }, (_, n) => item(`p${n}`, "proposed"));
    expect(nextStep(full)).toMatchObject({ role: "evaluator", refill: false });
  });

  it("starts an empty board", () => {
    expect(nextStep([])).toMatchObject({ role: "evaluator", refill: true });
  });
});

describe("findDuplicate — crossed-off work stays crossed off", () => {
  const items = [
    { id: "cal", title: "Add a booked stay to your calendar", status: "shipped" },
    { id: "fb", title: "Facebook login", status: "building" },
    { id: "name", title: "Legal: clear the name before anything carries it", status: "proposed" },
  ];

  it("matches on the meaningful words, ignoring the lane and filler", () => {
    expect(findDuplicate(items, "Feature: booked stay in the calendar")?.id).toBe("cal");
    expect(findDuplicate(items, "Add Facebook login")?.id).toBe("fb");
    expect(findDuplicate(items, "Brand: clear the name")?.id).toBe("name");
  });

  it("lets a neighbour through", () => {
    expect(findDuplicate(items, "Google login")).toBeNull();
    expect(findDuplicate(items, "Calendar: Google Calendar link")).toBeNull();
    expect(findDuplicate(items, "Legal: marketplace duties, visible in the app")).toBeNull();
  });
});

describe("mainFromGitFile — a worktree reports to the monitor of the main checkout", () => {
  it("follows a worktree back to its main checkout", () => {
    expect(mainFromGitFile("gitdir: C:/Users/lkspe/petbnb/.git/worktrees/petbnb-brand\n")).toBe("C:/Users/lkspe/petbnb");
  });

  it("leaves anything that is not a worktree alone", () => {
    expect(mainFromGitFile("gitdir: /repo/.git/modules/sub\n")).toBeNull();
    expect(mainFromGitFile("")).toBeNull();
  });
});
