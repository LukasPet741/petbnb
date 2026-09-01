// Pin the timezone before anything reads it. Almost every date assertion in this
// suite is timezone-sensitive (the app books date ranges and formats them for
// Lithuanian users), so tests must not pass on one machine and fail on another.
// Workers inherit process.env from this process, so setting it here is enough.
process.env.TZ = "Europe/Vilnius";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  test: {
    // Two projects, because the repo holds two different runtimes. The Next app
    // needs a DOM; the Supabase Edge Functions are Deno code whose pure helpers
    // are plain TypeScript and run fine on node without a DOM.
    projects: [
      {
        plugins: [tsconfigPaths(), react()],
        test: {
          name: "web",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          restoreMocks: true,
        },
      },
      {
        test: {
          name: "edge",
          environment: "node",
          // These live outside src/ and are deliberately excluded from
          // tsconfig.json, so they are never type-checked by `npm run typecheck`.
          include: [
            "supabase/functions/**/*.{test,spec}.ts",
            "iot-collar/supabase/functions/**/*.{test,spec}.ts",
          ],
          restoreMocks: true,
        },
      },
    ],
  },
});
