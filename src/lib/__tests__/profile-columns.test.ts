import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * `select("*")` on profiles is a hard error, not a quiet leak.
 *
 * Neither anon nor authenticated holds a table-level SELECT on public.profiles —
 * both hold a column grant covering PUBLIC_PROFILE_COLUMNS only (migrations
 * 20260910120000 and 20260910170000). Postgres requires SELECT on *every* column
 * for `select *`, so any query asking for the star fails with 42501 and the screen
 * behind it goes to its error state. This is not theoretical: it was reproduced
 * against production as anon.
 *
 * The trap is that an embed spells it differently. The commit that named
 * PUBLIC_PROFILE_COLUMNS at six `.from("profiles").select("*")` sites missed
 * `owner:profiles!fkey ( * )` in the messages page, which is the same star wearing
 * a different hat. This test reads both spellings out of the source so the next one
 * cannot ship.
 *
 * That grant has a write-side twin, found on 2026-09-12. `insert ... on conflict do
 * update` — what PostgREST's .upsert() emits — needs SELECT on the columns it names,
 * so /profile had been failing every save with 42501 for two days purely because its
 * payload included `phone`. Proven against production three ways: the same upsert
 * without `phone` succeeds, a plain `update ... set phone` succeeds, the upsert with
 * `phone` fails. A plain .update() carries no such requirement, so the upsert shape is
 * forbidden on this table too.
 *
 * Both checks are line-based, like the star ones above: a call split across lines would
 * slip through. That is the same limitation the star tests have always had, and it is
 * worth less than the complexity of parsing TypeScript here.
 */

const SRC = join(process.cwd(), "src");

/** Every .ts/.tsx file under src, tests excluded — a test may quote the pattern. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

const FILES = sourceFiles(SRC);

/** A comment line names the forbidden shape to explain it; only code ships it. */
const isComment = (line: string) => /^\s*(\/\/|\/\*|\*)/.test(line);

/** file:line for every code line matching a pattern, across all of src. */
function hits(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, i) => {
        if (!isComment(line) && pattern.test(line)) {
          found.push(`${relative(SRC, file)}:${i + 1}`);
        }
      });
  }
  return found;
}

describe("profiles is never selected with a star", () => {
  it("has no .from(\"profiles\").select(\"*\")", () => {
    // `my_profile` is deliberately not matched: it is a view the caller holds a
    // full grant on, and select("*") there is the correct query.
    expect(hits(/from\(\s*["']profiles["']\s*\)\s*\.\s*select\(\s*["'`]\s*\*/)).toEqual([]);
  });

  it("has no profiles(*) embed", () => {
    // Matches `profiles ( * )` and `profiles!some_fkey ( * )`, the two shapes
    // PostgREST accepts for an embedded resource.
    expect(hits(/(?<![_a-zA-Z])profiles(?:![A-Za-z_]+)?\s*\(\s*\*\s*\)/)).toEqual([]);
  });
});

describe("profiles is never written with an upsert", () => {
  it('has no .from("profiles").upsert(', () => {
    // A profile row always exists by the time anyone can edit it: on_auth_user_created
    // inserts one for every new auth user, and production carries zero orphans. So
    // .update().eq("id", user.id) is the correct write, and the upsert bought nothing
    // but a 42501.
    expect(hits(/from\(\s*["']profiles["']\s*\)\s*\.\s*upsert\(/)).toEqual([]);
  });
});
