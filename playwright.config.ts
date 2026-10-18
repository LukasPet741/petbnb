import { defineConfig } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// The test accounts' credentials live in .env.e2e (git-ignored, never committed: the repo is
// public). Values already in the environment win, so CI or a one-off run can override them.
if (existsSync(".env.e2e")) {
  for (const line of readFileSync(".env.e2e", "utf8").split(/\r?\n/)) {
    const eq = line.indexOf("=");
    if (eq > 0 && !line.startsWith("#")) process.env[line.slice(0, eq)] ??= line.slice(eq + 1);
  }
}

/**
 * Flow tests against a running site. E2E_BASE_URL picks which one: the local dev server by
 * default, https://petbnb.lt to check what is deployed.
 *
 * Two projects, because they cost different things:
 * - `public` only reads. It is safe to run against prod at any time.
 * - `signed-in` signs the two test accounts in and books, offers, accepts and reviews. Every
 *   one of those writes to the ONE Supabase project and sends real email, so it runs only when
 *   asked for by name (`npm run e2e -- --project=signed-in`) and only with Lukas's yes.
 */
export default defineConfig({
  testDir: "e2e",
  // The signed-in flows are one story told in order (request, counter, accept, review), and
  // the two accounts share their bookings, so nothing runs in parallel.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    // The Chrome already on this machine, so no browser download is needed.
    channel: "chrome",
    locale: "en-GB",
    timezoneId: "Europe/Vilnius",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "public", testMatch: /public\/.*\.spec\.ts/ },
    { name: "signed-in", testMatch: /signed-in\/.*\.spec\.ts/ },
  ],
});
