import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Guards over the migration files, replayed in order as "supabase db reset" would.
 *
 * handle_new_user creates the profile row inside every signup. Without SECURITY DEFINER it
 * runs as supabase_auth_admin, which may not write public.profiles, and every signup fails
 * (prod, 2026-08-30 → 2026-10-10, after the baseline was replayed there).
 */

const DIR = path.join(process.cwd(), "supabase/migrations");
const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const read = (f: string) => fs.readFileSync(path.join(DIR, f), "utf8");

/** Whether handle_new_user ends up SECURITY DEFINER after the files run in order. */
function handleNewUserIsDefiner(): boolean | null {
  let definer: boolean | null = null;
  for (const file of files) {
    const sql = read(file).replace(/--.*$/gm, "");
    const re = /(create\s+or\s+replace\s+function\s+(?:public\.)?handle_new_user\s*\(\s*\)[\s\S]*?\$\$)|(alter\s+function\s+(?:public\.)?handle_new_user\s*\(\s*\)[^;]*;)/gi;
    for (const m of sql.matchAll(re)) {
      const text = m[0].toLowerCase();
      if (m[1]) definer = /security\s+definer/.test(text);
      else if (/security\s+definer/.test(text)) definer = true;
      else if (/security\s+invoker/.test(text)) definer = false;
    }
  }
  return definer;
}

describe("migrations", () => {
  it("leave the signup trigger SECURITY DEFINER, or nobody can sign up", () => {
    expect(handleNewUserIsDefiner()).toBe(true);
  });

  it("keep the warning that the baseline must never run against production", () => {
    expect(read("00000000000000_baseline_initial_schema.sql")).toMatch(/NEVER RUN IT AGAINST PRODUCTION/);
  });
});
