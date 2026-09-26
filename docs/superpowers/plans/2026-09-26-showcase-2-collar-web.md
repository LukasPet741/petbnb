# Showcase 2/3 — Collar web (sidebar A + `/collar`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The collar is front and center: a live card at the top of the sidebar on every page, and a `/collar` page with sticker-code pairing, a live check-in checklist, a big live map, honest failure states, and a recorded walk that replays through the database.

**Architecture:** Pure modules in `src/lib/collar/` (types, pair code, status rule, stats, tile maths, place names, data access) are unit-tested first. One `CollarLiveProvider` in the `(app)` layout owns the collar list, newest positions, the Realtime channel (15 s polling fallback) and the recorded-walk loop; the sidebar card, the phone's collar button and `/collar` all read it. Components in `src/components/collar/` render the approved mockups. Finally the Profile "My collars" tab goes and a cleanup migration removes the old pairing path.

**Tech Stack:** Next.js 16.2 App Router (client components, as every `(app)` page is), React 19, Tailwind v4 tokens and `glass-*` utilities from `globals.css`, lucide-react 1.17, Leaflet 1.9, supabase-js 2 (typed by `src/lib/database.types.ts`), vitest 4 + Testing Library (jsdom, TZ pinned to Europe/Vilnius).

**Spec:** `docs/superpowers/specs/2026-09-26-showcase-collar-smartid-design.md` (sections "Web — collar", "Failures", "Testing", "Rollout"). Mockups: `docs/superpowers/specs/2026-09-26-showcase-mockups/sidebar.html` (option A) and `collar-page.html`.

**Depends on:** plan 1 (`2026-09-26-showcase-1-collar-backend.md`) fully done: migration applied, `database.types.ts` regenerated, ingest v6 live.

## Global Constraints

- Every prod write needs Lukas's explicit yes: `apply_migration`, write SQL (rolled-back checks included), `git push` to `main` (Vercel deploys it).
- Git: explicit paths only (never `git add -A`/`.`); never commit `src/app/dev/` or `docs/security/`; messages are a plain sentence ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Status thresholds, verbatim from the spec: live = newest `source='collar'` position ≤ **45 s** old; searching = `last_seen_at` ≤ **90 s** ago; offline = seen since pairing but silent > **90 s**; replaying = this tab's loop or newest position a replay ≤ **10 s** old; wizard warning **90 s** after pairing. Order: `no_collar → replaying → demo_idle → live → searching → waiting → offline`.
- Recorded walk: one `replay_collar_point` call every **2 s** from index 0; **3** failures in a row stop it; always labelled DEMO. Realtime down → poll every **15 s**.
- Weekly numbers count only `source='collar'` positions, over the **last 7 days** (oldest first, ending today).
- Place names: Nominatim, at most once a minute and only after moving > **150 m**; failure shows nothing.
- No "How it works" diagram anywhere; no battery anywhere.
- Every user-visible string goes through `t()` with keys in both `src/lib/i18n/en/*` and `src/lib/i18n/lt/*` (the parity test fails otherwise).
- Tests render without `LanguageProvider`, so `t(key)` returns the key itself (interpolation variables are ignored) — assert on keys.

## Review Focus

- **The Pi comes back after being offline and flushes an old queue**: an older position arriving late must not replace a newer one on the map — pinned in Task 1 (`mergePosition` ignores older arrivals).
- **A collar that checked in seconds before it was paired** must show "Collar online" straight away, not "waiting" — pinned in Task 2 and Task 13.
- **The recorded walk while the user clicks between pages** keeps playing (the loop lives in the provider, not the page) — pinned in Task 8 (loop runs without the page mounted).
- **A sloppily typed sticker code** (`7k3q 9d2m`, `O` for `0`) pairs the same collar — pinned in Task 1 and Task 13.
- **Realtime never connects on the defence Wi-Fi**: the page still updates every 15 s — pinned in Task 8 (`falls back to polling`).

---

### Task 1: Collar types, pair code and position merging

**Files:**
- Create: `src/lib/collar/types.ts`, `src/lib/collar/pairCode.ts`, `src/lib/collar/positions.ts`
- Test: `src/lib/collar/__tests__/pairCode.test.ts`, `src/lib/collar/__tests__/positions.test.ts`

**Interfaces:**
- Produces: `CollarDevice`, `PositionSource`, `CollarPosition`, `CollarState` (types.ts); `PAIR_CODE_LENGTH`, `cleanPairCode(input) → string`, `isPairCode(clean) → boolean`, `formatPairCode(clean) → string` (pairCode.ts); `LatestPair`, `EMPTY_PAIR`, `mergePosition(prev, position) → Record<string, LatestPair>` (positions.ts).

- [ ] **Step 1: Branch check**

Run: `cd C:/Users/lkspe/petbnb && git branch --show-current`
Expected: `feat/showcase` (plan 1 created it). If not, `git switch feat/showcase`.

- [ ] **Step 2: Write the failing tests**

Create `src/lib/collar/__tests__/pairCode.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cleanPairCode, formatPairCode, isPairCode } from "@/lib/collar/pairCode";

describe("cleanPairCode", () => {
  it.each([
    ["7K3Q-9D2M", "7K3Q9D2M"],
    ["7k3q 9d2m", "7K3Q9D2M"],
    [" 7K3Q–9D2M ", "7K3Q9D2M"],
    ["7K3Q-9D2O", "7K3Q9D20"],
    ["IL00-ABCD", "1100ABCD"],
  ])("cleans %j to %s", (input, expected) => {
    expect(cleanPairCode(input)).toBe(expected);
  });
});

describe("isPairCode", () => {
  it("accepts eight Crockford characters", () => {
    expect(isPairCode("7K3Q9D2M")).toBe(true);
  });

  it.each(["7K3Q9D2", "7K3Q9D2MX", "7K3Q9D2U", ""])("rejects %j", (code) => {
    expect(isPairCode(code)).toBe(false);
  });
});

describe("formatPairCode", () => {
  it("adds the dash after four characters", () => {
    expect(formatPairCode("7K3Q9D2M")).toBe("7K3Q-9D2M");
  });

  it("leaves a short code alone while it is being typed", () => {
    expect(formatPairCode("7K3")).toBe("7K3");
  });
});
```

Create `src/lib/collar/__tests__/positions.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mergePosition } from "@/lib/collar/positions";
import type { CollarPosition } from "@/lib/collar/types";

const at = (iso: string, source: "collar" | "replay" = "collar", device_id = "c1"): CollarPosition => ({
  device_id, lat: 54.68, lng: 25.23, speed_kmh: 4.2, recorded_at: iso, source,
});

describe("mergePosition", () => {
  it("records the first position of a collar as both newest and newest real", () => {
    const p = at("2026-09-26T12:00:00Z");
    expect(mergePosition({}, p)).toEqual({ c1: { latest: p, latestReal: p } });
  });

  it("replaces an older position with a newer one", () => {
    const old = at("2026-09-26T12:00:00Z");
    const fresh = at("2026-09-26T12:00:15Z");
    const merged = mergePosition({ c1: { latest: old, latestReal: old } }, fresh);
    expect(merged.c1).toEqual({ latest: fresh, latestReal: fresh });
  });

  it("ignores a position older than the one it has (a flushed offline queue)", () => {
    const fresh = at("2026-09-26T12:00:15Z");
    const prev = { c1: { latest: fresh, latestReal: fresh } };
    expect(mergePosition(prev, at("2026-09-26T11:50:00Z"))).toBe(prev);
  });

  it("lets a replayed point become the newest without becoming the newest real one", () => {
    const real = at("2026-09-26T12:00:00Z");
    const replayed = at("2026-09-26T12:00:02Z", "replay");
    const merged = mergePosition({ c1: { latest: real, latestReal: real } }, replayed);
    expect(merged.c1).toEqual({ latest: replayed, latestReal: real });
  });

  it("keeps collars apart", () => {
    const merged = mergePosition({}, at("2026-09-26T12:00:00Z", "collar", "c2"));
    expect(Object.keys(merged)).toEqual(["c2"]);
  });
});
```

- [ ] **Step 3: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar`
Expected: FAIL — cannot resolve `@/lib/collar/pairCode`.

- [ ] **Step 4: Write the modules**

Create `src/lib/collar/types.ts`:

```ts
/** Shapes the collar feature passes around; rows come from collar_devices and collar_locations. */

export interface CollarDevice {
  id: string;
  label: string | null;
  is_demo: boolean;
  claimed_at: string | null;
  created_at: string;
  last_seen_at: string | null;
  gps_locked: boolean | null;
  gps_satellites: number | null;
}

export type PositionSource = "collar" | "replay";

export interface CollarPosition {
  device_id: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  recorded_at: string;
  source: PositionSource;
}

export type CollarState = "no_collar" | "replaying" | "demo_idle" | "live" | "searching" | "waiting" | "offline";
```

Create `src/lib/collar/pairCode.ts`:

```ts
/**
 * The pairing code printed on a collar's sticker: 8 Crockford base-32 characters, shown as
 * XXXX-XXXX. claim_collar cleans codes the same way (public.clean_pair_code), so the browser and
 * the database agree on what "the same code" means.
 */
export const PAIR_CODE_LENGTH = 8;

const VALID = /^[0-9A-HJKMNP-TV-Z]{8}$/;

export function cleanPairCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-Z]/g, "");
}

export function isPairCode(clean: string): boolean {
  return VALID.test(clean);
}

export function formatPairCode(clean: string): string {
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}
```

Create `src/lib/collar/positions.ts`:

```ts
import type { CollarPosition } from "./types";

/** The newest position of a collar, and the newest one that came from the collar itself. */
export interface LatestPair {
  latest: CollarPosition | null;
  latestReal: CollarPosition | null;
}

export const EMPTY_PAIR: LatestPair = { latest: null, latestReal: null };

const isNewer = (candidate: CollarPosition, current: CollarPosition | null) =>
  !current || Date.parse(candidate.recorded_at) >= Date.parse(current.recorded_at);

/**
 * Folds one arriving position into the per-collar map. An older arrival (the Pi flushing its
 * offline queue) never replaces a newer position; the unchanged map is returned as-is.
 */
export function mergePosition(prev: Record<string, LatestPair>, position: CollarPosition): Record<string, LatestPair> {
  const current = prev[position.device_id] ?? EMPTY_PAIR;
  const latest = isNewer(position, current.latest) ? position : current.latest;
  const latestReal =
    position.source === "collar" && isNewer(position, current.latestReal) ? position : current.latestReal;
  if (latest === current.latest && latestReal === current.latestReal) return prev;
  return { ...prev, [position.device_id]: { latest, latestReal } };
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar`
Expected: PASS (17 tests).

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/collar/types.ts src/lib/collar/pairCode.ts src/lib/collar/positions.ts src/lib/collar/__tests__/pairCode.test.ts src/lib/collar/__tests__/positions.test.ts && git commit -F - <<'EOF'
Add collar types, sticker-code cleanup and newest-position merging

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: The status rule

**Files:**
- Create: `src/lib/collar/status.ts`
- Test: `src/lib/collar/__tests__/status.test.ts`

**Interfaces:**
- Consumes: Task 1 types.
- Produces: `LIVE_MAX_AGE_MS = 45_000`, `SEEN_MAX_AGE_MS = 90_000`, `REPLAY_MAX_AGE_MS = 10_000`, `CHECKIN_TIMEOUT_MS = 90_000`, `StatusInput`, `pairedAt(device) → string`, `msSincePaired(device, now) → number`, `isOnline(device, now) → boolean`, `collarState(input) → CollarState`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/collar/__tests__/status.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  collarState, isOnline, msSincePaired, LIVE_MAX_AGE_MS, REPLAY_MAX_AGE_MS, SEEN_MAX_AGE_MS,
} from "@/lib/collar/status";
import type { CollarDevice, CollarPosition } from "@/lib/collar/types";

const NOW = Date.parse("2026-09-26T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const device = (over: Partial<CollarDevice> = {}): CollarDevice => ({
  id: "c1", label: "Reksas", is_demo: false, claimed_at: ago(3_600_000), created_at: ago(7_200_000),
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

const pos = (msAgo: number, source: "collar" | "replay" = "collar"): CollarPosition => ({
  device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4.2, recorded_at: ago(msAgo), source,
});

function state(over: { device?: CollarDevice | null; latest?: CollarPosition | null; latestReal?: CollarPosition | null; replayingHere?: boolean } = {}) {
  return collarState({
    device: over.device === undefined ? device() : over.device,
    latest: over.latest ?? null,
    latestReal: over.latestReal ?? null,
    replayingHere: over.replayingHere ?? false,
    now: NOW,
  });
}

describe("collarState", () => {
  it("is no_collar without a device", () => {
    expect(state({ device: null })).toBe("no_collar");
  });

  it("is replaying while this tab plays a walk, whatever else is true", () => {
    expect(state({ device: device({ is_demo: true }), replayingHere: true })).toBe("replaying");
    expect(state({ device: device({ last_seen_at: ago(600_000) }), replayingHere: true })).toBe("replaying");
  });

  it("is replaying when the newest position is a replay at most 10 s old (another tab plays it)", () => {
    expect(state({ latest: pos(REPLAY_MAX_AGE_MS, "replay") })).toBe("replaying");
    expect(state({ latest: pos(REPLAY_MAX_AGE_MS + 1, "replay") })).not.toBe("replaying");
  });

  it("is demo_idle for a demo collar that is not replaying", () => {
    expect(state({ device: device({ is_demo: true }), latest: pos(60_000, "replay") })).toBe("demo_idle");
  });

  it("is live with a real position at most 45 s old", () => {
    const seen = device({ last_seen_at: ago(1_000) });
    expect(state({ device: seen, latestReal: pos(LIVE_MAX_AGE_MS) })).toBe("live");
    expect(state({ device: seen, latestReal: pos(LIVE_MAX_AGE_MS + 1) })).toBe("searching");
  });

  it("is searching while the collar checked in within 90 s", () => {
    expect(state({ device: device({ last_seen_at: ago(SEEN_MAX_AGE_MS) }) })).toBe("searching");
  });

  it("is offline once a collar seen since pairing has been silent over 90 s", () => {
    expect(state({ device: device({ last_seen_at: ago(SEEN_MAX_AGE_MS + 1) }) })).toBe("offline");
  });

  it("is waiting while a paired collar has never checked in", () => {
    expect(state({ device: device({ last_seen_at: null }) })).toBe("waiting");
  });

  it("is waiting when the last check-in predates the pairing", () => {
    expect(state({ device: device({ claimed_at: ago(60_000), last_seen_at: ago(7_200_000) }) })).toBe("waiting");
  });

  it("counts a check-in just before pairing as online", () => {
    expect(state({ device: device({ claimed_at: ago(5_000), last_seen_at: ago(10_000) }) })).toBe("searching");
  });

  it("uses created_at for a collar paired before claim codes existed", () => {
    const legacy = device({ claimed_at: null, created_at: ago(60_000), last_seen_at: ago(120_000) });
    expect(state({ device: legacy })).toBe("waiting");
  });
});

describe("helpers", () => {
  it("measures time since pairing", () => {
    expect(msSincePaired(device({ claimed_at: ago(91_000) }), NOW)).toBe(91_000);
  });

  it("knows whether a collar is online", () => {
    expect(isOnline(device({ last_seen_at: ago(90_000) }), NOW)).toBe(true);
    expect(isOnline(device({ last_seen_at: ago(90_001) }), NOW)).toBe(false);
    expect(isOnline(device({ last_seen_at: null }), NOW)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/status.test.ts`
Expected: FAIL — cannot resolve `@/lib/collar/status`.

- [ ] **Step 3: Write `status.ts`**

```ts
import type { CollarDevice, CollarPosition, CollarState } from "./types";

/**
 * The one rule that decides what a collar is doing (spec "Status rule"). Every screen — sidebar
 * card, phone button, /collar, the pairing checklist — asks this, so they never disagree.
 */

export const LIVE_MAX_AGE_MS = 45_000; // three missed 15 s ticks
export const SEEN_MAX_AGE_MS = 90_000;
export const REPLAY_MAX_AGE_MS = 10_000; // replayed points arrive every 2 s
export const CHECKIN_TIMEOUT_MS = 90_000;

export interface StatusInput {
  device: CollarDevice | null;
  latest: CollarPosition | null;
  latestReal: CollarPosition | null;
  replayingHere: boolean;
  now: number;
}

const age = (iso: string | null | undefined, now: number) => (iso ? now - Date.parse(iso) : Infinity);

/** Collars paired before claim codes existed have no claimed_at; their row's birth is the pairing. */
export function pairedAt(device: CollarDevice): string {
  return device.claimed_at ?? device.created_at;
}

export function msSincePaired(device: CollarDevice, now: number): number {
  return now - Date.parse(pairedAt(device));
}

export function isOnline(device: CollarDevice, now: number): boolean {
  return age(device.last_seen_at, now) <= SEEN_MAX_AGE_MS;
}

export function collarState({ device, latest, latestReal, replayingHere, now }: StatusInput): CollarState {
  if (!device) return "no_collar";
  if (replayingHere || (latest?.source === "replay" && age(latest.recorded_at, now) <= REPLAY_MAX_AGE_MS)) {
    return "replaying";
  }
  if (device.is_demo) return "demo_idle";
  if (latestReal && age(latestReal.recorded_at, now) <= LIVE_MAX_AGE_MS) return "live";
  if (isOnline(device, now)) return "searching";
  if (!device.last_seen_at || Date.parse(device.last_seen_at) < Date.parse(pairedAt(device))) return "waiting";
  return "offline";
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/status.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/collar/status.ts src/lib/collar/__tests__/status.test.ts && git commit -F - <<'EOF'
Add the one rule that decides whether a collar is live, searching or offline

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Dates and stats move to `src/lib/collar/stats.ts`

**Files:**
- Create: `src/lib/collar/stats.ts`
- Move + modify: `src/components/__tests__/CollarsPanel.helpers.test.ts` → `src/lib/collar/__tests__/stats.test.ts`
- Modify: `src/components/CollarsPanel.tsx` (imports the helpers instead of defining them; still used until Task 14)

**Interfaces:**
- Produces: `RoutePoint`, `SpeedPoint`, `localDateString(date)`, `todayInputValue()`, `dayBounds(date) → {from, to}`, `haversineKm(a, b)`, `routeStats(points)`, `lastSevenDates()`, `weekdayShort(date, locale)`, `formatClock(iso, locale)`, `formatDayMonth(iso, locale)`, `ACTIVITY_RESTING_MAX_KMH = 1`, `ACTIVITY_WALKING_MAX_KMH = 7`, `Activity`, `activityOf(speedKmh) → Activity | null`, `ActivityMix`, `activityMix(counts) → ActivityMix | null`, `DaySummary`, `WeekSummary`, `summarizeWeek(days) → WeekSummary`.

- [ ] **Step 1: Move the test file**

```bash
cd C:/Users/lkspe/petbnb && mkdir -p src/lib/collar/__tests__ && git mv src/components/__tests__/CollarsPanel.helpers.test.ts src/lib/collar/__tests__/stats.test.ts
```

- [ ] **Step 2: Edit the moved tests**

In `src/lib/collar/__tests__/stats.test.ts`:

(a) Replace the import block at the top (the `import { … } from "@/components/CollarsPanel";` statement) with:

```ts
import {
  todayInputValue,
  haversineKm,
  routeStats,
  lastSevenDates,
  weekdayShort,
  activityOf,
  activityMix,
  summarizeWeek,
  formatClock,
  formatDayMonth,
  dayBounds,
} from "@/lib/collar/stats";
```

and change the comment line below it from `// The pure date/geo maths behind the collar panel.` to `// The pure date/geo maths behind the collar page.`

(b) Replace the whole `describe("currentWeekDates", () => { … });` block with:

```ts
describe("lastSevenDates", () => {
  const daysAt = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
    return lastSevenDates();
  };

  it("ends today and starts six days back", () => {
    expect(daysAt("2026-09-10T12:00:00+03:00")).toEqual([
      "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10",
    ]);
  });

  it("rolls back into the previous month", () => {
    expect(daysAt("2026-03-02T12:00:00+02:00")[0]).toBe("2026-02-24");
  });

  it("rolls back across a year boundary", () => {
    expect(daysAt("2026-01-03T12:00:00+02:00")[0]).toBe("2025-12-28");
  });

  it("includes the leap day", () => {
    expect(daysAt("2028-03-02T12:00:00+02:00")).toContain("2028-02-29");
  });

  it("does not slip a day when called just before local midnight", () => {
    const days = daysAt("2026-09-10T23:59:00+03:00");
    expect(days[6]).toBe("2026-09-10");
  });

  it.each([
    "2026-09-07T08:00:00+03:00",
    "2026-09-13T00:01:00+03:00",
    "2026-03-29T12:00:00+03:00",
    "2026-10-25T12:00:00+03:00",
    "2028-02-29T12:00:00+02:00",
  ])("always returns seven distinct consecutive dates, seeded at %s", (iso) => {
    const days = daysAt(iso);
    expect(days).toHaveLength(7);
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T00:00:00Z`).getTime();
      const cur = new Date(`${days[i]}T00:00:00Z`).getTime();
      expect(cur - prev).toBe(86_400_000);
    }
  });
});

describe("dayBounds", () => {
  it("covers the whole local day", () => {
    expect(dayBounds("2026-09-26")).toEqual({
      from: "2026-09-25T21:00:00.000Z",
      to: "2026-09-26T20:59:59.999Z",
    });
  });
});

describe("formatClock and formatDayMonth", () => {
  it("prints local 24-hour time", () => {
    expect(formatClock("2026-09-26T11:32:00Z", "en")).toBe("14:32");
    expect(formatClock("2026-09-26T11:32:00Z", "lt")).toBe("14:32");
  });

  it("prints the day and month in each language", () => {
    // Long month on purpose: CLDR's short Lithuanian form is "09-24", which reads like a code.
    expect(formatDayMonth("2026-09-24T10:00:00Z", "en")).toBe("24 September");
    expect(formatDayMonth("2026-09-24T10:00:00Z", "lt")).toBe("rugsėjo 24 d.");
  });
});
```

(c) In the `describe("weekdayShort", …)` block, replace the last test (`it("formats every date currentWeekDates produces without throwing", …)`) with:

```ts
  it("formats every date lastSevenDates produces without throwing", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-10T12:00:00+03:00"));
    for (const date of lastSevenDates()) {
      expect(() => weekdayShort(date, "lt")).not.toThrow();
      expect(weekdayShort(date, "lt")).toMatch(/^\p{Lu}/u);
    }
  });
```

(d) Replace the whole `describe("activity bucketing thresholds", () => { … });` block with:

```ts
describe("activityOf", () => {
  it.each([
    [0, "resting"],
    [0.99, "resting"],
    [1, "walking"],
    [7, "walking"],
    [7.0001, "running"],
    [20, "running"],
    [-5, "resting"],
  ] as const)("buckets %p km/h as %s", (speed, expected) => {
    expect(activityOf(speed)).toBe(expected);
  });

  // Fixed 2026-09-26: a NaN speed used to fall through both comparisons and count as running.
  it("does not bucket a NaN speed at all", () => {
    expect(activityOf(NaN)).toBeNull();
  });
});

describe("activityMix", () => {
  // Fixed 2026-09-26: the three percentages were rounded independently and summed to 99 or 101.
  it("sums to exactly 100 for an even three-way split", () => {
    const mix = activityMix({ resting: 1, walking: 1, running: 1 });
    expect(mix).not.toBeNull();
    expect(mix!.restingPct + mix!.walkingPct + mix!.runningPct).toBe(100);
  });

  it("sums to exactly 100 for a one-sixth split", () => {
    const mix = activityMix({ resting: 1, walking: 1, running: 4 });
    expect(mix).toEqual({ restingPct: 17, walkingPct: 17, runningPct: 66 });
  });

  it("is null when nothing moved", () => {
    expect(activityMix({ resting: 0, walking: 0, running: 0 })).toBeNull();
  });
});

describe("summarizeWeek", () => {
  const p = (lat: number, recorded_at: string, speed_kmh: number | null = 4) => ({ lat, lng: 25.28, recorded_at, speed_kmh });

  it("adds up each day and the week, and mixes activity over every point with a speed", () => {
    const summary = summarizeWeek([
      { date: "2026-09-25", points: [p(54.68, "2026-09-25T10:00:00Z", 0.5), p(54.69, "2026-09-25T10:15:00Z", 5)] },
      { date: "2026-09-26", points: [p(54.68, "2026-09-26T10:00:00Z", null)] },
    ]);
    expect(summary.days.map((d) => d.date)).toEqual(["2026-09-25", "2026-09-26"]);
    expect(summary.days[0].distanceKm).toBeCloseTo(1.112, 2);
    expect(summary.days[1].distanceKm).toBe(0);
    expect(summary.totalDistanceKm).toBeCloseTo(1.112, 2);
    expect(summary.activity).toEqual({ restingPct: 50, walkingPct: 50, runningPct: 0 });
  });
});
```

- [ ] **Step 3: Run the moved tests to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/stats.test.ts`
Expected: FAIL — cannot resolve `@/lib/collar/stats`.

- [ ] **Step 4: Write `stats.ts`**

Create `src/lib/collar/stats.ts`:

```ts
/**
 * The date and distance maths behind the collar page, moved out of CollarsPanel (2026-09-26).
 * All of it is timezone sensitive; the test suite pins TZ to Europe/Vilnius.
 */

export interface RoutePoint {
  lat: number;
  lng: number;
  recorded_at: string;
}

export interface SpeedPoint extends RoutePoint {
  speed_kmh: number | null;
}

/** YYYY-MM-DD of a moment, in local time. */
export function localDateString(date: Date): string {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

export function todayInputValue(): string {
  return localDateString(new Date());
}

/** The first and last instant of a local day, as ISO strings for a range query. */
export function dayBounds(date: string): { from: string; to: string } {
  return {
    from: new Date(`${date}T00:00:00`).toISOString(),
    to: new Date(`${date}T23:59:59.999`).toISOString(),
  };
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function routeStats(points: RoutePoint[]): { distanceKm: number; durationMin: number } | null {
  if (points.length < 2) return null;
  let distanceKm = 0;
  for (let i = 1; i < points.length; i++) distanceKm += haversineKm(points[i - 1], points[i]);
  const durationMin =
    (new Date(points[points.length - 1].recorded_at).getTime() - new Date(points[0].recorded_at).getTime()) / 60_000;
  return { distanceKm, durationMin };
}

/** The last seven local dates, oldest first, ending today. Built at local noon so DST never skips a day. */
export function lastSevenDates(): string[] {
  const now = new Date();
  const dates: string[] = [];
  for (let back = 6; back >= 0; back--) {
    dates.push(localDateString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, 12)));
  }
  return dates;
}

export function weekdayShort(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const raw = new Intl.DateTimeFormat(locale === "lt" ? "lt-LT" : "en-US", { weekday: "short" }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const intlLocale = (locale: string) => (locale === "lt" ? "lt-LT" : "en-GB");

export function formatClock(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

export function formatDayMonth(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "long" }).format(new Date(iso));
}

export const ACTIVITY_RESTING_MAX_KMH = 1;
export const ACTIVITY_WALKING_MAX_KMH = 7;

export type Activity = "resting" | "walking" | "running";

export function activityOf(speedKmh: number): Activity | null {
  if (!Number.isFinite(speedKmh)) return null;
  if (speedKmh < ACTIVITY_RESTING_MAX_KMH) return "resting";
  if (speedKmh <= ACTIVITY_WALKING_MAX_KMH) return "walking";
  return "running";
}

export interface ActivityMix {
  restingPct: number;
  walkingPct: number;
  runningPct: number;
}

/** Percentages that always add up to 100 (largest remainder), so the bar never shows a gap. */
export function activityMix(counts: { resting: number; walking: number; running: number }): ActivityMix | null {
  const total = counts.resting + counts.walking + counts.running;
  if (total === 0) return null;
  const exact = [counts.resting, counts.walking, counts.running].map((n) => (n / total) * 100);
  const pct = exact.map(Math.floor);
  let left = 100 - pct.reduce((sum, n) => sum + n, 0);
  const byRemainder = exact.map((value, i) => ({ i, rest: value - pct[i] })).sort((a, b) => b.rest - a.rest);
  for (const { i } of byRemainder) {
    if (left <= 0) break;
    pct[i] += 1;
    left -= 1;
  }
  return { restingPct: pct[0], walkingPct: pct[1], runningPct: pct[2] };
}

export interface DaySummary {
  date: string;
  distanceKm: number;
}

export interface WeekSummary {
  days: DaySummary[];
  totalDistanceKm: number;
  activity: ActivityMix | null;
}

export function summarizeWeek(days: { date: string; points: SpeedPoint[] }[]): WeekSummary {
  const counts = { resting: 0, walking: 0, running: 0 };
  let totalDistanceKm = 0;
  const summaries = days.map(({ date, points }) => {
    const distanceKm = routeStats(points)?.distanceKm ?? 0;
    totalDistanceKm += distanceKm;
    for (const point of points) {
      const activity = point.speed_kmh == null ? null : activityOf(point.speed_kmh);
      if (activity) counts[activity] += 1;
    }
    return { date, distanceKm };
  });
  return { days: summaries, totalDistanceKm, activity: activityMix(counts) };
}
```

- [ ] **Step 5: Point CollarsPanel at the new module**

In `src/components/CollarsPanel.tsx`:
- Delete these definitions: the functions `todayInputValue`, `haversineKm`, `routeStats`, `currentWeekDates`, `weekdayShort`, and the constants `ACTIVITY_RESTING_MAX_KMH`, `ACTIVITY_WALKING_MAX_KMH`. Keep the interfaces (`CollarDevice`, `CollarFix`, `RoutePoint`, `WeeklyRoutePoint`, `WeeklyStats`) — the panel still uses them.
- Add below the other imports: `import { todayInputValue, routeStats, lastSevenDates, weekdayShort, ACTIVITY_RESTING_MAX_KMH, ACTIVITY_WALKING_MAX_KMH } from "@/lib/collar/stats";`
- In `loadWeeklyStats`, change `const weekDates = currentWeekDates();` to `const weekDates = lastSevenDates();`.

(The panel is deleted in Task 14; until then it must keep compiling.)

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar && npm run typecheck`
Expected: PASS; tsc exits 0. (Checked on Node 24.19 with TZ=Europe/Vilnius: `24 September`, `rugsėjo 24 d.`, `14:32`.)

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/collar/stats.ts src/lib/collar/__tests__/stats.test.ts src/components/CollarsPanel.tsx && git commit -F - <<'EOF'
Move the collar's date and distance maths into src/lib/collar

Adds the last-7-days window, local clock and date formatting, and
activity percentages that always sum to 100; a NaN speed no longer
counts as running.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 4: Mini-map tiles, `MiniMap` and `LiveDot`

**Files:**
- Create: `src/lib/collar/tiles.ts`, `src/components/collar/MiniMap.tsx`, `src/components/collar/LiveDot.tsx`
- Test: `src/lib/collar/__tests__/tiles.test.ts`, `src/components/collar/__tests__/MiniMap.test.tsx`

**Interfaces:**
- Produces: `TILE_SIZE`, `worldPixel(lat, lng, zoom) → {x, y}`, `PlacedTile {key, url, dx, dy}`, `tilesAround(lat, lng, zoom, width, height) → PlacedTile[]`; `<MiniMap lat lng height zoom? muted? className? />`; `<LiveDot className? />`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/collar/__tests__/tiles.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tilesAround, worldPixel, TILE_SIZE } from "@/lib/collar/tiles";

describe("worldPixel", () => {
  it("puts 0,0 in the middle of the single zoom-0 tile", () => {
    const { x, y } = worldPixel(0, 0, 0);
    expect(x).toBeCloseTo(128, 6);
    expect(y).toBeCloseTo(128, 6);
  });
});

describe("tilesAround", () => {
  const VINGIS = { lat: 54.683, lng: 25.233 };

  it("includes the tile that contains the point (Vingis Park, zoom 15)", () => {
    const tiles = tilesAround(VINGIS.lat, VINGIS.lng, 15, 320, 56);
    const home = tiles.find((t) => t.dx <= 0 && t.dx + TILE_SIZE > 0 && t.dy <= 0 && t.dy + TILE_SIZE > 0);
    expect(home?.url).toMatch(/\/15\/18680\/10414\.png$/);
  });

  it("covers the whole box around the point", () => {
    const tiles = tilesAround(VINGIS.lat, VINGIS.lng, 16, 320, 56);
    expect(Math.min(...tiles.map((t) => t.dx))).toBeLessThanOrEqual(-160);
    expect(Math.max(...tiles.map((t) => t.dx + TILE_SIZE))).toBeGreaterThanOrEqual(160);
    expect(Math.min(...tiles.map((t) => t.dy))).toBeLessThanOrEqual(-28);
    expect(Math.max(...tiles.map((t) => t.dy + TILE_SIZE))).toBeGreaterThanOrEqual(28);
  });

  it("only uses the a/b/c tile hosts the CSP allows", () => {
    for (const tile of tilesAround(VINGIS.lat, VINGIS.lng, 16, 320, 56)) {
      expect(tile.url).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/);
    }
  });

  it("wraps tile columns across the antimeridian", () => {
    for (const tile of tilesAround(0, 179.99, 2, 320, 56)) {
      const x = Number(tile.url.split("/")[4]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(4);
    }
  });
});
```

Create `src/components/collar/__tests__/MiniMap.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import MiniMap from "@/components/collar/MiniMap";

describe("MiniMap", () => {
  it("draws OpenStreetMap tiles around the collar with the dot in the middle", () => {
    const { container } = render(<MiniMap lat={54.683} lng={25.233} height={56} />);
    const images = container.querySelectorAll("img");
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) expect(img.getAttribute("src")).toMatch(/tile\.openstreetmap\.org/);
    expect(container.querySelector("[data-dot]")).not.toBeNull();
  });

  it("greys the map and stops the pulse for a stale position", () => {
    const { container } = render(<MiniMap lat={54.683} lng={25.233} height={56} muted />);
    expect(container.querySelector(".animate-ping")).toBeNull();
    expect((container.querySelector("img") as HTMLImageElement).style.filter).toContain("grayscale");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/tiles.test.ts src/components/collar`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the modules**

Create `src/lib/collar/tiles.ts`:

```ts
/**
 * OpenStreetMap tile maths for the sidebar's mini-map: which 256 px tiles cover a box around a
 * point, placed relative to the point, so the point sits in the middle of the box at whatever width
 * the card renders. No map library: this card is on every signed-in page. The CSP already allows
 * images from *.tile.openstreetmap.org (the a/b/c hosts Leaflet uses too).
 */
export const TILE_SIZE = 256;

const MAX_LAT = 85.05112878;

export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const clamped = Math.max(-MAX_LAT, Math.min(MAX_LAT, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale,
  };
}

export interface PlacedTile {
  key: string;
  url: string;
  /** The tile's top-left corner relative to the point, in px. */
  dx: number;
  dy: number;
}

export function tilesAround(lat: number, lng: number, zoom: number, width: number, height: number): PlacedTile[] {
  const { x, y } = worldPixel(lat, lng, zoom);
  const count = 2 ** zoom;
  const firstX = Math.floor((x - width / 2) / TILE_SIZE);
  const lastX = Math.floor((x + width / 2) / TILE_SIZE);
  const firstY = Math.max(0, Math.floor((y - height / 2) / TILE_SIZE));
  const lastY = Math.min(count - 1, Math.floor((y + height / 2) / TILE_SIZE));
  const tiles: PlacedTile[] = [];
  for (let ty = firstY; ty <= lastY; ty++) {
    for (let tx = firstX; tx <= lastX; tx++) {
      const wrapped = ((tx % count) + count) % count;
      const host = "abc"[(wrapped + ty) % 3];
      tiles.push({
        key: `${zoom}/${tx}/${ty}`,
        url: `https://${host}.tile.openstreetmap.org/${zoom}/${wrapped}/${ty}.png`,
        dx: Math.round(tx * TILE_SIZE - x),
        dy: Math.round(ty * TILE_SIZE - y),
      });
    }
  }
  return tiles;
}
```

Create `src/components/collar/LiveDot.tsx`:

```tsx
import { cn } from "@/lib/utils";

/** The amber "live" pulse — the same signal as the live marker on the collar map. */
export default function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-2 w-2 flex-shrink-0", className)} aria-hidden="true">
      <span className="absolute inset-0 animate-ping rounded-full bg-amber opacity-60" />
      <span className="relative inline-flex h-full w-full rounded-full bg-amber" />
    </span>
  );
}
```

Create `src/components/collar/MiniMap.tsx`:

```tsx
"use client";
import { tilesAround } from "@/lib/collar/tiles";
import { cn } from "@/lib/utils";

/** Covers cards up to this wide; wider cards would show the grey background at the edges. */
const COVER_WIDTH = 320;

/** A static OpenStreetMap snapshot with the collar in the middle, for the sidebar card. */
export default function MiniMap({
  lat, lng, height, zoom = 16, muted = false, className,
}: {
  lat: number;
  lng: number;
  height: number;
  zoom?: number;
  muted?: boolean;
  className?: string;
}) {
  const tiles = tilesAround(lat, lng, zoom, COVER_WIDTH, height);
  return (
    <div className={cn("relative w-full overflow-hidden bg-[#e7ece6]", className)} style={{ height }} aria-hidden="true">
      {tiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          src={tile.url}
          alt=""
          width={256}
          height={256}
          loading="lazy"
          draggable={false}
          className="absolute max-w-none select-none"
          style={{
            left: `calc(50% + ${tile.dx}px)`,
            top: `calc(50% + ${tile.dy}px)`,
            filter: muted ? "grayscale(1) opacity(0.55)" : "saturate(0.6)",
          }}
        />
      ))}
      <span data-dot className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2">
        {!muted && <span className="absolute inset-0 animate-ping rounded-full bg-amber opacity-50" />}
        <span className={cn("relative block h-full w-full rounded-full shadow ring-2 ring-white", muted ? "bg-[#8a948f]" : "bg-amber")} />
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/tiles.test.ts src/components/collar`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/collar/tiles.ts src/lib/collar/__tests__/tiles.test.ts src/components/collar/MiniMap.tsx src/components/collar/LiveDot.tsx src/components/collar/__tests__/MiniMap.test.tsx && git commit -F - <<'EOF'
Add a tile-based mini-map for the sidebar's collar card

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Place names from OpenStreetMap, throttled

**Files:**
- Create: `src/lib/collar/placeName.ts`
- Test: `src/lib/collar/__tests__/placeName.test.ts`
- Modify: `next.config.ts` (the `connect-src` line)

**Interfaces:**
- Consumes: Task 3 `haversineKm`.
- Produces: `PLACE_MIN_INTERVAL_MS = 60_000`, `PLACE_MIN_MOVE_KM = 0.15`, `createPlaceLookup(fetchImpl?, clock?) → (lat, lng, locale: "en" | "lt") => Promise<string | null>`, `lookupPlace` (the app-wide instance).

- [ ] **Step 1: Write the failing test**

Create `src/lib/collar/__tests__/placeName.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createPlaceLookup, PLACE_MIN_INTERVAL_MS } from "@/lib/collar/placeName";

const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response;

function setup(body: unknown = { name: "Vingio parkas", address: { city: "Vilnius" } }, ok = true) {
  let now = 1_000_000;
  const fetchImpl = vi.fn(async () => answer(body, ok));
  const lookup = createPlaceLookup(fetchImpl as unknown as typeof fetch, () => now);
  return { fetchImpl, lookup, advance: (ms: number) => { now += ms; } };
}

describe("createPlaceLookup", () => {
  it("asks Nominatim in the page's language and returns the place name", async () => {
    const { fetchImpl, lookup } = setup();
    expect(await lookup(54.683, 25.233, "lt")).toBe("Vingio parkas");
    const url = String((fetchImpl.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect(url).toContain("accept-language=lt");
  });

  it("does not ask again within a minute", async () => {
    const { fetchImpl, lookup, advance } = setup();
    await lookup(54.683, 25.233, "en");
    advance(PLACE_MIN_INTERVAL_MS - 1);
    expect(await lookup(54.70, 25.30, "en")).toBe("Vingio parkas");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does not ask again after a minute if the collar moved under 150 m", async () => {
    const { fetchImpl, lookup, advance } = setup();
    await lookup(54.683, 25.233, "en");
    advance(PLACE_MIN_INTERVAL_MS + 1);
    await lookup(54.6835, 25.2335, "en");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("asks again after a minute and more than 150 m", async () => {
    const { fetchImpl, lookup, advance } = setup();
    await lookup(54.683, 25.233, "en");
    advance(PLACE_MIN_INTERVAL_MS + 1);
    await lookup(54.686, 25.233, "en");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("falls back to the neighbourhood when the place has no name", async () => {
    const { lookup } = setup({ name: "", address: { neighbourhood: "Žvėrynas" } });
    expect(await lookup(54.69, 25.25, "lt")).toBe("Žvėrynas");
  });

  it("returns null on failure and backs off instead of retrying at once", async () => {
    const { fetchImpl, lookup } = setup({}, false);
    expect(await lookup(54.683, 25.233, "en")).toBeNull();
    expect(await lookup(54.683, 25.233, "en")).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/placeName.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `placeName.ts`**

```ts
import { haversineKm } from "./stats";

/**
 * "Vingis Park" on the collar's status card, from OpenStreetMap's Nominatim reverse geocoder.
 * Its usage policy allows about one request a second; this asks at most once a minute, and only
 * after the collar moved more than 150 m. Any failure just means no place name.
 */
export const PLACE_MIN_INTERVAL_MS = 60_000;
export const PLACE_MIN_MOVE_KM = 0.15;

interface Remembered {
  at: number;
  lat: number;
  lng: number;
  locale: string;
  name: string | null;
}

interface NominatimReverse {
  name?: string;
  address?: Record<string, string | undefined>;
}

function nameOf(body: NominatimReverse): string | null {
  const a = body.address ?? {};
  return body.name || a.park || a.leisure || a.neighbourhood || a.suburb || a.quarter || a.road || null;
}

export function createPlaceLookup(fetchImpl: typeof fetch = fetch, clock: () => number = Date.now) {
  let last: Remembered | null = null;
  let inflight: Promise<string | null> | null = null;

  return async function lookup(lat: number, lng: number, locale: "en" | "lt"): Promise<string | null> {
    const now = clock();
    if (last && last.locale === locale) {
      const tooSoon = now - last.at < PLACE_MIN_INTERVAL_MS;
      const tooClose = haversineKm(last, { lat, lng }) < PLACE_MIN_MOVE_KM;
      if (tooSoon || tooClose) return last.name;
    }
    if (inflight) return inflight;

    inflight = (async () => {
      try {
        const url =
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16` +
          `&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}&accept-language=${locale}`;
        const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error(`nominatim ${response.status}`);
        last = { at: now, lat, lng, locale, name: nameOf((await response.json()) as NominatimReverse) };
      } catch {
        // Remember the failure too, so a broken lookup is not retried on every position.
        last = { at: now, lat, lng, locale, name: null };
      } finally {
        inflight = null;
      }
      return last.name;
    })();
    return inflight;
  };
}

/** The app-wide lookup, so the throttle holds across components. */
export const lookupPlace = createPlaceLookup();
```

- [ ] **Step 4: Allow Nominatim in the CSP**

In `next.config.ts`, change the line

```ts
  `connect-src 'self' ${[...supabaseHttp, ...supabaseWs].join(" ")}`,
```

to

```ts
  // Nominatim: the collar page's place name ("Vingis Park"), throttled in src/lib/collar/placeName.ts.
  `connect-src 'self' ${[...supabaseHttp, ...supabaseWs].join(" ")} https://nominatim.openstreetmap.org`,
```

- [ ] **Step 5: Run the tests and typecheck**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/placeName.test.ts && npm run typecheck`
Expected: PASS (6 tests); tsc 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/collar/placeName.ts src/lib/collar/__tests__/placeName.test.ts next.config.ts && git commit -F - <<'EOF'
Look up the collar's place name from OpenStreetMap, at most once a minute

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Collar data access (`api.ts`)

**Files:**
- Create: `src/lib/collar/api.ts`
- Test: `src/lib/collar/__tests__/api.test.ts`

**Interfaces:**
- Consumes: Task 1 types and `LatestPair`; plan 1's regenerated types for `collar_devices`, `collar_locations`, and the RPCs.
- Produces:
  - `loadCollars(): Promise<CollarDevice[]>` (sorted: real before demo, most recently seen first), `sortCollars(devices)`
  - `loadLatest(ids: string[]): Promise<Record<string, LatestPair>>`
  - `loadPositions(deviceId, fromIso, toIso, source?): Promise<CollarPosition[]>` (ascending)
  - `loadPetNames(ownerId): Promise<string[]>`
  - `ClaimOutcome = "paired" | "already_yours" | "not_found" | "taken"`, `ClaimResult {deviceId: string | null; result: ClaimOutcome}`, `claimCollar(code, label?)`
  - `renameCollar(deviceId, label)`, `unpairCollar(deviceId)`, `createDemoCollar(): Promise<string>`
  - `ReplayPoint {lat, lng, speed_kmh, idx, total}`, `replayCollarPoint(deviceId, index)`
  - `CollarHandlers {onPosition, onDevice, onStatus}`, `subscribeCollars(userId, handlers): () => void`
  - Every failure throws `Error(message)` with the database message (`no_recording`, `out_of_range`, `not_your_collar`, …).

- [ ] **Step 1: Write the failing test**

Create `src/lib/collar/__tests__/api.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  claimCollar, createDemoCollar, loadCollars, loadPositions, loadPetNames, renameCollar,
  replayCollarPoint, sortCollars, subscribeCollars, unpairCollar,
} from "@/lib/collar/api";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as null | { message: string },
  rpcResult: { data: null as unknown, error: null as null | { message: string } },
  calls: [] as unknown[][],
  handlers: [] as Array<{ filter: Record<string, string>; cb: (payload: { new: unknown }) => void }>,
  statusCb: null as null | ((status: string) => void),
  removed: 0,
}));

vi.mock("@/lib/supabase", () => {
  const builder = () => {
    const chain: Record<string, unknown> = {};
    for (const op of ["select", "eq", "gte", "lte", "order", "limit", "update"]) {
      chain[op] = (...args: unknown[]) => {
        h.calls.push([op, ...args]);
        return chain;
      };
    }
    chain.maybeSingle = async () => ({ data: h.rows[0] ?? null, error: h.error });
    chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: h.rows, error: h.error }));
    return chain;
  };
  const channel = {
    on: (_type: string, filter: Record<string, string>, cb: (payload: { new: unknown }) => void) => {
      h.handlers.push({ filter, cb });
      return channel;
    },
    subscribe: (cb: (status: string) => void) => {
      h.statusCb = cb;
      return channel;
    },
  };
  return {
    supabase: {
      from: (table: string) => {
        h.calls.push(["from", table]);
        return builder();
      },
      rpc: async (...args: unknown[]) => {
        h.calls.push(["rpc", ...args]);
        return h.rpcResult;
      },
      channel: (name: string) => {
        h.calls.push(["channel", name]);
        return channel;
      },
      removeChannel: async () => {
        h.removed += 1;
      },
    },
  };
});

const device = (over: Partial<CollarDevice>): CollarDevice => ({
  id: "c", label: null, is_demo: false, claimed_at: null, created_at: "2026-09-01T00:00:00Z",
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

beforeEach(() => {
  h.rows = [];
  h.error = null;
  h.rpcResult = { data: null, error: null };
  h.calls = [];
  h.handlers = [];
  h.statusCb = null;
  h.removed = 0;
});

describe("collars", () => {
  it("sorts real collars before the demo one, most recently seen first", () => {
    const sorted = sortCollars([
      device({ id: "demo", is_demo: true, last_seen_at: "2026-09-26T12:00:00Z" }),
      device({ id: "old", last_seen_at: "2026-09-20T12:00:00Z" }),
      device({ id: "new", last_seen_at: "2026-09-26T11:00:00Z" }),
    ]);
    expect(sorted.map((d) => d.id)).toEqual(["new", "old", "demo"]);
  });

  it("loads collars from collar_devices and throws the database message on error", async () => {
    h.rows = [device({ id: "a" })];
    expect((await loadCollars()).map((d) => d.id)).toEqual(["a"]);
    expect(h.calls[0]).toEqual(["from", "collar_devices"]);
    h.error = { message: "boom" };
    await expect(loadCollars()).rejects.toThrow("boom");
  });

  it("loads a day's positions oldest first, filtered by source", async () => {
    await loadPositions("c1", "2026-09-26T00:00:00Z", "2026-09-26T23:59:59Z", "collar");
    expect(h.calls).toContainEqual(["eq", "source", "collar"]);
    expect(h.calls).toContainEqual(["order", "recorded_at", { ascending: true }]);
  });

  it("loads the owner's pet names", async () => {
    h.rows = [{ name: "Reksas" }, { name: "Mica" }];
    expect(await loadPetNames("u1")).toEqual(["Reksas", "Mica"]);
    expect(h.calls).toContainEqual(["eq", "owner_id", "u1"]);
  });
});

describe("pairing and changes", () => {
  it("maps claim_collar's row", async () => {
    h.rpcResult = { data: [{ device_id: "c9", result: "paired" }], error: null };
    expect(await claimCollar("7K3Q9D2M")).toEqual({ deviceId: "c9", result: "paired" });
    expect(h.calls).toContainEqual(["rpc", "claim_collar", { p_code: "7K3Q9D2M", p_label: undefined }]);
  });

  it("throws when claiming fails", async () => {
    h.rpcResult = { data: null, error: { message: "Failed to fetch" } };
    await expect(claimCollar("7K3Q9D2M")).rejects.toThrow("Failed to fetch");
  });

  it("renames with a plain update of the label", async () => {
    await renameCollar("c1", "Bobis");
    expect(h.calls).toContainEqual(["update", { label: "Bobis" }]);
    expect(h.calls).toContainEqual(["eq", "id", "c1"]);
  });

  it("unpairs and creates the demo collar through their functions", async () => {
    await unpairCollar("c1");
    expect(h.calls).toContainEqual(["rpc", "unpair_collar", { p_device_id: "c1" }]);
    h.rpcResult = { data: "demo-1", error: null };
    expect(await createDemoCollar()).toBe("demo-1");
  });

  it("returns a replayed point and passes the database's reason on failure", async () => {
    h.rpcResult = { data: [{ lat: 54.68, lng: 25.23, speed_kmh: 4.2, idx: 3, total: 64 }], error: null };
    expect(await replayCollarPoint("c1", 3)).toEqual({ lat: 54.68, lng: 25.23, speed_kmh: 4.2, idx: 3, total: 64 });
    h.rpcResult = { data: null, error: { message: "no_recording" } };
    await expect(replayCollarPoint("c1", 0)).rejects.toThrow("no_recording");
  });
});

describe("subscribeCollars", () => {
  it("passes new positions and device updates through, without extra columns", () => {
    const onPosition = vi.fn();
    const onDevice = vi.fn();
    const onStatus = vi.fn();
    subscribeCollars("u1", { onPosition, onDevice, onStatus });

    const positions = h.handlers.find((x) => x.filter.table === "collar_locations")!;
    positions.cb({ new: { id: 7, device_id: "c1", lat: 1, lng: 2, speed_kmh: null, battery_pct: null, recorded_at: "t", created_at: "t", source: "collar" } });
    expect(onPosition).toHaveBeenCalledWith({ device_id: "c1", lat: 1, lng: 2, speed_kmh: null, recorded_at: "t", source: "collar" });

    const devices = h.handlers.find((x) => x.filter.table === "collar_devices")!;
    devices.cb({ new: { id: "c1", owner_id: "u1", device_secret_hash: "$2a$…", pair_code: "7K3Q9D2M", label: "R", is_demo: false, claimed_at: null, created_at: "t", last_seen_at: "t2", gps_locked: false, gps_satellites: 3 } });
    expect(onDevice).toHaveBeenCalledWith({ id: "c1", label: "R", is_demo: false, claimed_at: null, created_at: "t", last_seen_at: "t2", gps_locked: false, gps_satellites: 3 });

    h.statusCb?.("SUBSCRIBED");
    expect(onStatus).toHaveBeenLastCalledWith(true);
  });

  it("reports offline and removes the channel when unsubscribed", () => {
    const onStatus = vi.fn();
    const stop = subscribeCollars("u1", { onPosition: vi.fn(), onDevice: vi.fn(), onStatus });
    stop();
    expect(onStatus).toHaveBeenLastCalledWith(false);
    expect(h.removed).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/api.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `api.ts`**

```ts
import { supabase } from "@/lib/supabase";
import type { CollarDevice, CollarPosition, PositionSource } from "./types";
import type { LatestPair } from "./positions";

/**
 * Every read and write the collar feature makes. Failures throw Error(message) with the database's
 * message, so callers can tell "no_recording" from a dropped connection.
 */

const DEVICE_COLUMNS = "id, label, is_demo, claimed_at, created_at, last_seen_at, gps_locked, gps_satellites";
const POSITION_COLUMNS = "device_id, lat, lng, speed_kmh, recorded_at, source";

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function pickDevice(row: Record<string, unknown>): CollarDevice {
  return {
    id: row.id as string,
    label: (row.label as string | null) ?? null,
    is_demo: Boolean(row.is_demo),
    claimed_at: (row.claimed_at as string | null) ?? null,
    created_at: row.created_at as string,
    last_seen_at: (row.last_seen_at as string | null) ?? null,
    gps_locked: (row.gps_locked as boolean | null) ?? null,
    gps_satellites: (row.gps_satellites as number | null) ?? null,
  };
}

function pickPosition(row: Record<string, unknown>): CollarPosition {
  return {
    device_id: row.device_id as string,
    lat: row.lat as number,
    lng: row.lng as number,
    speed_kmh: (row.speed_kmh as number | null) ?? null,
    recorded_at: row.recorded_at as string,
    source: row.source === "replay" ? "replay" : "collar",
  };
}

/** Real collars before the demo one; within those, the most recently seen first. */
export function sortCollars(devices: CollarDevice[]): CollarDevice[] {
  const seen = (d: CollarDevice) => Date.parse(d.last_seen_at ?? d.claimed_at ?? d.created_at);
  return [...devices].sort((a, b) => (a.is_demo === b.is_demo ? seen(b) - seen(a) : a.is_demo ? 1 : -1));
}

export async function loadCollars(): Promise<CollarDevice[]> {
  const { data, error } = await supabase.from("collar_devices").select(DEVICE_COLUMNS);
  fail(error);
  return sortCollars(((data ?? []) as Record<string, unknown>[]).map(pickDevice));
}

async function newest(deviceId: string, source?: PositionSource): Promise<CollarPosition | null> {
  let query = supabase.from("collar_locations").select(POSITION_COLUMNS).eq("device_id", deviceId);
  if (source) query = query.eq("source", source);
  const { data, error } = await query.order("recorded_at", { ascending: false }).limit(1).maybeSingle();
  fail(error);
  return data ? pickPosition(data as Record<string, unknown>) : null;
}

export async function loadLatest(deviceIds: string[]): Promise<Record<string, LatestPair>> {
  const entries = await Promise.all(
    deviceIds.map(async (id) => [id, { latest: await newest(id), latestReal: await newest(id, "collar") }] as const),
  );
  return Object.fromEntries(entries);
}

export async function loadPositions(
  deviceId: string, fromIso: string, toIso: string, source?: PositionSource,
): Promise<CollarPosition[]> {
  let query = supabase
    .from("collar_locations")
    .select(POSITION_COLUMNS)
    .eq("device_id", deviceId)
    .gte("recorded_at", fromIso)
    .lte("recorded_at", toIso);
  if (source) query = query.eq("source", source);
  const { data, error } = await query.order("recorded_at", { ascending: true });
  fail(error);
  return ((data ?? []) as Record<string, unknown>[]).map(pickPosition);
}

export async function loadPetNames(ownerId: string): Promise<string[]> {
  const { data, error } = await supabase.from("pets").select("name").eq("owner_id", ownerId).order("created_at");
  fail(error);
  return ((data ?? []) as { name: string }[]).map((p) => p.name).filter(Boolean);
}

export type ClaimOutcome = "paired" | "already_yours" | "not_found" | "taken";

export interface ClaimResult {
  deviceId: string | null;
  result: ClaimOutcome;
}

const firstRow = <T,>(data: unknown): T | undefined => (Array.isArray(data) ? data[0] : data) as T | undefined;

export async function claimCollar(code: string, label?: string): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_collar", { p_code: code, p_label: label });
  fail(error);
  const row = firstRow<{ device_id: string | null; result: ClaimOutcome }>(data);
  if (!row) throw new Error("empty_claim_result");
  return { deviceId: row.device_id, result: row.result };
}

export async function renameCollar(deviceId: string, label: string): Promise<void> {
  const { error } = await supabase.from("collar_devices").update({ label }).eq("id", deviceId);
  fail(error);
}

export async function unpairCollar(deviceId: string): Promise<void> {
  const { error } = await supabase.rpc("unpair_collar", { p_device_id: deviceId });
  fail(error);
}

export async function createDemoCollar(): Promise<string> {
  const { data, error } = await supabase.rpc("create_demo_collar");
  fail(error);
  return data as string;
}

export interface ReplayPoint {
  lat: number;
  lng: number;
  speed_kmh: number | null;
  idx: number;
  total: number;
}

export async function replayCollarPoint(deviceId: string, index: number): Promise<ReplayPoint> {
  const { data, error } = await supabase.rpc("replay_collar_point", { p_device_id: deviceId, p_index: index });
  fail(error);
  const row = firstRow<ReplayPoint>(data);
  if (!row) throw new Error("empty_replay_result");
  return row;
}

export interface CollarHandlers {
  onPosition: (position: CollarPosition) => void;
  onDevice: (device: CollarDevice) => void;
  onStatus: (connected: boolean) => void;
}

/**
 * One channel for both collar tables. No row filter: collar_locations has no owner column, and
 * Realtime already applies the tables' RLS, so only the user's own rows arrive.
 */
export function subscribeCollars(userId: string, handlers: CollarHandlers): () => void {
  const channel = supabase
    .channel(`collars:${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "collar_locations" }, (payload) =>
      handlers.onPosition(pickPosition(payload.new as Record<string, unknown>)),
    )
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "collar_devices" }, (payload) =>
      handlers.onDevice(pickDevice(payload.new as Record<string, unknown>)),
    )
    .subscribe((status) => handlers.onStatus(status === "SUBSCRIBED"));
  return () => {
    handlers.onStatus(false);
    void supabase.removeChannel(channel);
  };
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/collar/__tests__/api.test.ts && npm run typecheck`
Expected: PASS (11 tests); tsc 0. (If tsc rejects `p_label: undefined`, the generated arg type lacks `?` — pass `...(label ? { p_label: label } : {})` instead and update the test's expected call to `{ p_code: "7K3Q9D2M" }`.)

- [ ] **Step 5: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/collar/api.ts src/lib/collar/__tests__/api.test.ts && git commit -F - <<'EOF'
Add the collar data layer: collars, positions, pairing, replay, Realtime

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Collar copy in English and Lithuanian

**Files:**
- Modify: `src/lib/i18n/en/appShell.ts`, `src/lib/i18n/lt/appShell.ts` (add `spotlight`)
- Modify: `src/lib/i18n/en/appPages.ts`, `src/lib/i18n/lt/appPages.ts` (add `collar`; the old `collars` section stays until Task 14)

**Interfaces:**
- Produces every key used by Tasks 9–13: `appShell.spotlight.*` and `appPages.collar.*` exactly as below.

- [ ] **Step 1: Add the English keys**

In `src/lib/i18n/en/appShell.ts`, add this property to the `appShell` object (after `sidebar`):

```ts
  spotlight: {
    collarTitle: "GPS collar",
    pairTitle: "Pair a collar",
    pairText: "See every walk, live",
    live: "LIVE",
    demo: "DEMO",
    lineLive: "{ago} · {speed} km/h",
    lineReplaying: "Recorded walk playing",
    lineSearching: "Online · looking for satellites",
    lineWaiting: "Waiting for it to go online",
    lineOffline: "Offline · last seen {time}",
    lineDemoIdle: "Recorded walk · press play",
    smartIdTitle: "Smart-ID",
    smartIdVerified: "Identity verified",
    smartIdTodo: "Not verified yet · 1 min",
    collarButton: "Open the collar page",
  },
```

In `src/lib/i18n/en/appPages.ts`, add this property to the `appPages` object (after `collars`):

```ts
  collar: {
    pageLabel: "GPS collar",
    loading: "Loading your collar…",
    unnamed: "Collar",
    demoName: "Recorded walk",
    hardware: "Raspberry Pi + NEO-6M GPS · paired {date} · sends a position every 15 s",
    demoHardware: "Plays a walk a real PetBnB collar recorded",
    states: {
      live: "LIVE",
      replaying: "RECORDED",
      demo_idle: "DEMO",
      searching: "SEARCHING",
      waiting: "WAITING",
      offline: "OFFLINE",
    },
    play: "Play a recorded walk",
    stop: "Stop",
    more: "More",
    rename: "Rename",
    renameTitle: "Rename collar",
    nameLabel: "Name",
    save: "Save",
    cancel: "Cancel",
    remove: "Remove collar",
    removeTitle: "Remove {name}?",
    removeText: "Its history is deleted and the sticker code works again, so it can be paired anew.",
    pairAnother: "Pair another collar",
    collars: "Your collars",
    updatedAgo: "updated {ago}",
    ago: {
      justNow: "just now",
      minutesAgo: "{minutes} min ago",
      hoursAgo: "{hours} h ago",
      daysAgo: "{days} d ago",
    },
    speedUnit: "km/h",
    activity: {
      resting: "Resting",
      walking: "Walking",
      running: "Running",
    },
    satellitesLocked: "{count} satellites locked",
    onWifi: "Connected over WiFi",
    today: "Today",
    todaySummary: "{km} km · {min} min out",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    locate: "Center on the collar",
    speed: "Speed",
    satellites: "Satellites",
    week: {
      title: "Last 7 days",
      hint: "Pick a day to draw its route",
      empty: "No walks in the last 7 days",
      backToToday: "Back to today",
      activity: "Activity",
    },
    empty: {
      title: "See every walk, live",
      text: "Pair a PetBnB collar and follow your dog on a map while a sitter has them.",
      pair: "Pair a collar",
    },
    searching: {
      title: "Online · looking for satellites",
      count: "{count} of 4 needed",
      text: "The collar is connected, but it can't see the sky. Put it by a window, or play a walk it recorded outside.",
    },
    waiting: {
      title: "Waiting for the collar",
      text: "Paired, but it hasn't checked in yet. Switch it on; it needs about a minute.",
    },
    offline: {
      title: "Offline for {minutes} min",
      lastSeen: "Last seen {time}",
      text: "Out of WiFi range, or the battery ran out. Positions it records meanwhile upload when it's back.",
    },
    demoIdle: {
      title: "Recorded walk",
      text: "A real walk recorded by a PetBnB collar, played back through the database like live positions.",
    },
    replay: {
      title: "Recorded walk",
      note: "Sent through the same database as live positions",
      progress: "{done} of {total} points",
      stopped: "The recorded walk stopped.",
      noRecording: "No recorded walk yet.",
      tryAgain: "Try again",
    },
    wizard: {
      close: "Close",
      step: "Step {step} of 4",
      back: "Back",
      on: {
        title: "Switch the collar on",
        text: "Plug in its battery. The green light flickers while it starts up, about 40 seconds.",
        next: "It's on",
      },
      code: {
        title: "Enter the pairing code",
        text: "It's on the sticker under the collar.",
        label: "Pairing code",
        hint: "Letters and numbers. O and 0 count as the same.",
        submit: "Pair collar",
        notFound: "No collar has this code. Check the sticker: 8 characters, like 7K3Q-9D2M.",
        taken: "This collar is paired to another account. It has to be removed there before you can pair it.",
        network: "Couldn't reach PetBnB. Check your connection and try again.",
      },
      name: {
        title: "Who's wearing it?",
        text: "Pick from your pets, or give the collar any name.",
        other: "Other",
        label: "Collar name",
        submit: "Start tracking",
      },
      connect: {
        title: "Connecting to {name}",
        paired: "Paired to your account",
        online: "Collar online",
        onlineWaiting: "Waiting for it to go online",
        onlineDone: "checked in over WiFi · {time}",
        satellites: "Finding satellites",
        satellitesCount: "{count} in view, needs 4 for a position",
        first: "First position on the map",
        done: "Found it. Opening the map…",
        indoors: "Indoors the GPS may never lock.",
        playInstead: "Play a recorded walk instead",
        slowTitle: "No word from the collar yet",
        slowSeconds: "{seconds} s and counting",
        tipLight: "Is the green light on?",
        tipWifi: "Is it near the WiFi it was set up with?",
        tipBoot: "Just switched on? It needs about a minute.",
        keepWaiting: "Keep waiting",
        recordedWalk: "Recorded walk",
      },
    },
  },
```

- [ ] **Step 2: Add the Lithuanian keys (same shape)**

In `src/lib/i18n/lt/appShell.ts`, add after `sidebar`:

```ts
  spotlight: {
    collarTitle: "GPS antkaklis",
    pairTitle: "Susieti antkaklį",
    pairText: "Matykite kiekvieną pasivaikščiojimą gyvai",
    live: "GYVAI",
    demo: "DEMO",
    lineLive: "{ago} · {speed} km/val.",
    lineReplaying: "Rodomas įrašytas pasivaikščiojimas",
    lineSearching: "Prisijungęs · ieško palydovų",
    lineWaiting: "Laukiama, kol prisijungs",
    lineOffline: "Neprisijungęs · paskutinį kartą {time}",
    lineDemoIdle: "Įrašytas pasivaikščiojimas · paleiskite",
    smartIdTitle: "Smart-ID",
    smartIdVerified: "Tapatybė patvirtinta",
    smartIdTodo: "Dar nepatvirtinta · 1 min.",
    collarButton: "Atidaryti antkaklio puslapį",
  },
```

In `src/lib/i18n/lt/appPages.ts`, add after `collars`:

```ts
  collar: {
    pageLabel: "GPS antkaklis",
    loading: "Įkeliamas antkaklis…",
    unnamed: "Antkaklis",
    demoName: "Įrašytas pasivaikščiojimas",
    hardware: "Raspberry Pi + NEO-6M GPS · susietas {date} · vietą siunčia kas 15 s",
    demoHardware: "Rodo tikro PetBnB antkaklio įrašytą pasivaikščiojimą",
    states: {
      live: "GYVAI",
      replaying: "ĮRAŠAS",
      demo_idle: "DEMO",
      searching: "IEŠKO",
      waiting: "LAUKIAMA",
      offline: "NEPRISIJUNGĘS",
    },
    play: "Paleisti įrašytą pasivaikščiojimą",
    stop: "Sustabdyti",
    more: "Daugiau",
    rename: "Pervadinti",
    renameTitle: "Pervadinti antkaklį",
    nameLabel: "Pavadinimas",
    save: "Išsaugoti",
    cancel: "Atšaukti",
    remove: "Pašalinti antkaklį",
    removeTitle: "Pašalinti „{name}“?",
    removeText: "Jo istorija bus ištrinta, o lipduko kodas vėl veiks, todėl jį bus galima susieti iš naujo.",
    pairAnother: "Susieti kitą antkaklį",
    collars: "Jūsų antkakliai",
    updatedAgo: "atnaujinta {ago}",
    ago: {
      justNow: "ką tik",
      minutesAgo: "prieš {minutes} min.",
      hoursAgo: "prieš {hours} val.",
      daysAgo: "prieš {days} d.",
    },
    speedUnit: "km/val.",
    activity: {
      resting: "Ilsisi",
      walking: "Vaikšto",
      running: "Bėga",
    },
    satellitesLocked: "Užfiksuota palydovų: {count}",
    onWifi: "Prisijungęs per WiFi",
    today: "Šiandien",
    todaySummary: "{km} km · {min} min lauke",
    zoomIn: "Priartinti",
    zoomOut: "Nutolinti",
    locate: "Rodyti antkaklį centre",
    speed: "Greitis",
    satellites: "Palydovai",
    week: {
      title: "Paskutinės 7 dienos",
      hint: "Pasirinkite dieną, kad pamatytumėte maršrutą",
      empty: "Per paskutines 7 dienas pasivaikščiojimų nebuvo",
      backToToday: "Grįžti į šiandieną",
      activity: "Aktyvumas",
    },
    empty: {
      title: "Matykite kiekvieną pasivaikščiojimą gyvai",
      text: "Susiekite PetBnB antkaklį ir stebėkite šunį žemėlapyje, kol juo rūpinasi globėjas.",
      pair: "Susieti antkaklį",
    },
    searching: {
      title: "Prisijungęs · ieško palydovų",
      count: "{count} iš 4 reikalingų",
      text: "Antkaklis prisijungęs, bet nemato dangaus. Padėkite jį prie lango arba paleiskite lauke įrašytą pasivaikščiojimą.",
    },
    waiting: {
      title: "Laukiama antkaklio",
      text: "Susietas, bet dar neprisijungė. Įjunkite jį – tai užtrunka apie minutę.",
    },
    offline: {
      title: "Neprisijungęs {minutes} min.",
      lastSeen: "Paskutinį kartą {time}",
      text: "Už WiFi ribų arba išsikrovė baterija. Tuo metu užfiksuotos vietos bus įkeltos, kai jis vėl prisijungs.",
    },
    demoIdle: {
      title: "Įrašytas pasivaikščiojimas",
      text: "Tikras PetBnB antkaklio įrašytas pasivaikščiojimas, atkuriamas per duomenų bazę kaip gyvos vietos.",
    },
    replay: {
      title: "Įrašytas pasivaikščiojimas",
      note: "Siunčiamas per tą pačią duomenų bazę kaip gyvos vietos",
      progress: "{done} iš {total} taškų",
      stopped: "Įrašyto pasivaikščiojimo atkūrimas sustojo.",
      noRecording: "Įrašyto pasivaikščiojimo dar nėra.",
      tryAgain: "Bandyti dar kartą",
    },
    wizard: {
      close: "Uždaryti",
      step: "{step} žingsnis iš 4",
      back: "Atgal",
      on: {
        title: "Įjunkite antkaklį",
        text: "Prijunkite jo bateriją. Kol antkaklis įsijungia, mirksi žalia lemputė – apie 40 sekundžių.",
        next: "Įjungtas",
      },
      code: {
        title: "Įveskite susiejimo kodą",
        text: "Jis ant lipduko antkaklio apačioje.",
        label: "Susiejimo kodas",
        hint: "Raidės ir skaičiai. O ir 0 laikomi vienodais.",
        submit: "Susieti antkaklį",
        notFound: "Antkaklio su tokiu kodu nėra. Patikrinkite lipduką: 8 simboliai, pvz. 7K3Q-9D2M.",
        taken: "Šis antkaklis susietas su kita paskyra. Pirmiausia jį reikia pašalinti ten.",
        network: "Nepavyko susisiekti su PetBnB. Patikrinkite ryšį ir bandykite dar kartą.",
      },
      name: {
        title: "Kas jį nešios?",
        text: "Pasirinkite augintinį arba duokite antkakliui bet kokį pavadinimą.",
        other: "Kitas",
        label: "Antkaklio pavadinimas",
        submit: "Pradėti sekti",
      },
      connect: {
        title: "Jungiamasi prie „{name}“",
        paired: "Susieta su jūsų paskyra",
        online: "Antkaklis prisijungęs",
        onlineWaiting: "Laukiama, kol prisijungs",
        onlineDone: "prisijungė per WiFi · {time}",
        satellites: "Ieškoma palydovų",
        satellitesCount: "Matoma {count}, vietai nustatyti reikia 4",
        first: "Pirmoji vieta žemėlapyje",
        done: "Radome. Atidaromas žemėlapis…",
        indoors: "Patalpoje GPS gali taip ir nenustatyti vietos.",
        playInstead: "Vietoj to paleisti įrašytą pasivaikščiojimą",
        slowTitle: "Antkaklis dar neatsiliepė",
        slowSeconds: "Jau {seconds} s",
        tipLight: "Ar dega žalia lemputė?",
        tipWifi: "Ar jis šalia WiFi, prie kurio buvo prijungtas?",
        tipBoot: "Ką tik įjungtas? Jam reikia apie minutę.",
        keepWaiting: "Laukti toliau",
        recordedWalk: "Įrašytas pasivaikščiojimas",
      },
    },
  },
```

- [ ] **Step 3: Run the i18n tests**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/lib/i18n`
Expected: PASS — parity sees the same keys in both languages.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/lib/i18n/en/appShell.ts src/lib/i18n/lt/appShell.ts src/lib/i18n/en/appPages.ts src/lib/i18n/lt/appPages.ts && git commit -F - <<'EOF'
Add the collar page and sidebar card copy in English and Lithuanian

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: `CollarLiveProvider` — one live view, one Realtime channel, one replay loop

**Files:**
- Create: `src/context/CollarLiveContext.tsx`
- Test: `src/context/__tests__/CollarLiveContext.test.tsx`
- Modify: `src/app/(app)/layout.tsx` (mount the provider)

**Interfaces:**
- Consumes: Task 2 `collarState`; Task 1 `mergePosition`, `EMPTY_PAIR`, `LatestPair`; Task 6 api functions.
- Produces: `REPLAY_TICK_MS = 2000`, `POLL_MS = 15_000`, `CLOCK_MS = 5000`, `REPLAY_MAX_FAILURES = 3`, `ReplayProgress {deviceId, idx, total}`, `ReplayError = "stopped" | "no_recording"`, `CollarLiveValue` (below), `CollarLiveContext`, `EMPTY_COLLAR_LIVE`, `CollarLiveProvider`, `useCollarLive(): CollarLiveValue`.

```ts
interface CollarLiveValue {
  loading: boolean;
  collars: CollarDevice[];
  selected: CollarDevice | null;
  select: (id: string) => void;
  latest: CollarPosition | null;      // selected collar
  latestReal: CollarPosition | null;  // selected collar, source = collar
  state: CollarState;                 // selected collar
  now: number;
  realtime: boolean;
  replay: ReplayProgress | null;
  replayError: ReplayError | null;
  startReplay: () => Promise<void>;
  stopReplay: () => void;
  refresh: () => Promise<void>;
  pair: (code: string) => Promise<ClaimResult>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```

- [ ] **Step 1: Write the failing test**

Create `src/context/__tests__/CollarLiveContext.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { CollarLiveProvider, useCollarLive, POLL_MS, REPLAY_TICK_MS } from "@/context/CollarLiveContext";
import type { CollarHandlers } from "@/lib/collar/api";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({
  user: { id: "u1" } as { id: string } | null,
  loadCollars: vi.fn(),
  loadLatest: vi.fn(),
  replay: vi.fn(),
  claim: vi.fn(),
  demo: vi.fn(),
  handlers: null as CollarHandlers | null,
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: h.user, loading: false }) }));
vi.mock("@/lib/collar/api", () => ({
  loadCollars: (...a: unknown[]) => h.loadCollars(...a),
  loadLatest: (...a: unknown[]) => h.loadLatest(...a),
  replayCollarPoint: (...a: unknown[]) => h.replay(...a),
  claimCollar: (...a: unknown[]) => h.claim(...a),
  createDemoCollar: (...a: unknown[]) => h.demo(...a),
  renameCollar: vi.fn(async () => {}),
  unpairCollar: vi.fn(async () => {}),
  subscribeCollars: (_userId: string, handlers: CollarHandlers) => {
    h.handlers = handlers;
    return () => {};
  },
}));

const collar = (over: Partial<CollarDevice> = {}): CollarDevice => ({
  id: "c1", label: "Reksas", is_demo: false, claimed_at: "2026-09-26T08:00:00Z", created_at: "2026-09-26T08:00:00Z",
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

function Probe() {
  const live = useCollarLive();
  return (
    <div>
      <p data-testid="state">{live.state}</p>
      <p data-testid="selected">{live.selected?.id ?? "none"}</p>
      <p data-testid="replay">{live.replay ? `${live.replay.idx}/${live.replay.total}` : "off"}</p>
      <p data-testid="replayError">{live.replayError ?? "none"}</p>
      <button onClick={() => void live.startReplay()}>play</button>
      <button onClick={() => live.stopReplay()}>stop</button>
      <button onClick={() => void live.pair("7K3Q9D2M")}>pair</button>
    </div>
  );
}

const text = (id: string) => screen.getByTestId(id).textContent;
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-26T12:00:00Z"));
  h.user = { id: "u1" };
  h.handlers = null;
  h.loadCollars.mockReset().mockResolvedValue([collar()]);
  h.loadLatest.mockReset().mockResolvedValue({});
  h.replay.mockReset();
  h.claim.mockReset();
  h.demo.mockReset();
});

afterEach(() => vi.useRealTimers());

describe("CollarLiveProvider", () => {
  it("loads the collars, selects the first and works out its state", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    expect(text("selected")).toBe("c1");
    expect(text("state")).toBe("waiting");
  });

  it("goes live when a fresh position arrives over Realtime", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    act(() => {
      h.handlers!.onPosition({ device_id: "c1", lat: 54.68, lng: 25.23, speed_kmh: 4.2, recorded_at: "2026-09-26T11:59:58Z", source: "collar" });
    });
    expect(text("state")).toBe("live");
  });

  it("falls back to polling every 15 s while Realtime is not connected", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    expect(h.loadCollars).toHaveBeenCalledTimes(1);
    await wait(POLL_MS);
    expect(h.loadCollars).toHaveBeenCalledTimes(2);
  });

  it("stops polling once Realtime connects", async () => {
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    act(() => h.handlers!.onStatus(true));
    await wait(POLL_MS * 2);
    expect(h.loadCollars).toHaveBeenCalledTimes(1);
  });

  it("replays one point every 2 s, in order, and stops at the end of the walk", async () => {
    h.replay.mockImplementation(async (_id: string, idx: number) => ({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx, total: 3 }));
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(text("replay")).toBe("1/3");
    expect(text("state")).toBe("replaying");
    await wait(REPLAY_TICK_MS);
    expect(text("replay")).toBe("2/3");
    await wait(REPLAY_TICK_MS);
    expect(text("replay")).toBe("off");
    await wait(REPLAY_TICK_MS * 2);
    expect(h.replay.mock.calls.map((c) => c[1])).toEqual([0, 1, 2]);
  });

  it("keeps replaying with no page mounted, since the loop lives in the provider", async () => {
    h.replay.mockImplementation(async (_id: string, idx: number) => ({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx, total: 10 }));
    function Starter() {
      const live = useCollarLive();
      return <button onClick={() => void live.startReplay()}>play</button>;
    }
    const { rerender } = render(<CollarLiveProvider><Starter /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    rerender(<CollarLiveProvider><p>another page</p></CollarLiveProvider>);
    await wait(REPLAY_TICK_MS * 2);
    expect(h.replay).toHaveBeenCalledTimes(3);
  });

  it("gives up after three failures in a row", async () => {
    h.replay.mockRejectedValue(new Error("Failed to fetch"));
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    await wait(REPLAY_TICK_MS * 2);
    expect(text("replay")).toBe("off");
    expect(text("replayError")).toBe("stopped");
  });

  it("stops at once when there is no recording", async () => {
    h.replay.mockRejectedValue(new Error("no_recording"));
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(text("replayError")).toBe("no_recording");
    expect(text("replay")).toBe("off");
  });

  it("creates the demo collar first when the user has no collar", async () => {
    h.loadCollars.mockResolvedValueOnce([]).mockResolvedValue([collar({ id: "demo-1", is_demo: true })]);
    h.demo.mockResolvedValue("demo-1");
    h.replay.mockResolvedValue({ lat: 54.68, lng: 25.23, speed_kmh: 4, idx: 0, total: 5 });
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    expect(text("state")).toBe("no_collar");
    fireEvent.click(screen.getByText("play"));
    await flush();
    expect(h.replay).toHaveBeenCalledWith("demo-1", 0);
    expect(text("selected")).toBe("demo-1");
  });

  it("selects the collar it just paired", async () => {
    h.claim.mockResolvedValue({ deviceId: "c2", result: "paired" });
    h.loadCollars.mockResolvedValueOnce([collar()]).mockResolvedValue([collar(), collar({ id: "c2" })]);
    render(<CollarLiveProvider><Probe /></CollarLiveProvider>);
    await flush();
    fireEvent.click(screen.getByText("pair"));
    await flush();
    expect(text("selected")).toBe("c2");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/context/__tests__/CollarLiveContext.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the provider**

Create `src/context/CollarLiveContext.tsx`:

```tsx
"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  claimCollar, createDemoCollar, loadCollars, loadLatest, renameCollar, replayCollarPoint,
  subscribeCollars, unpairCollar, type ClaimResult,
} from "@/lib/collar/api";
import { EMPTY_PAIR, mergePosition, type LatestPair } from "@/lib/collar/positions";
import { collarState } from "@/lib/collar/status";
import type { CollarDevice, CollarPosition, CollarState } from "@/lib/collar/types";

/**
 * The user's collars, live, for the whole signed-in app (mounted once in (app)/layout.tsx). The
 * sidebar card, the phone's collar button and /collar all read this, so there is one Realtime
 * channel and one recorded-walk loop — and the walk keeps playing while the user clicks around.
 */

export const REPLAY_TICK_MS = 2000;
export const POLL_MS = 15_000;
export const CLOCK_MS = 5000;
export const REPLAY_MAX_FAILURES = 3;

export interface ReplayProgress {
  deviceId: string;
  idx: number;
  total: number;
}

export type ReplayError = "stopped" | "no_recording";

export interface CollarLiveValue {
  loading: boolean;
  collars: CollarDevice[];
  selected: CollarDevice | null;
  select: (id: string) => void;
  latest: CollarPosition | null;
  latestReal: CollarPosition | null;
  state: CollarState;
  now: number;
  realtime: boolean;
  replay: ReplayProgress | null;
  replayError: ReplayError | null;
  startReplay: () => Promise<void>;
  stopReplay: () => void;
  refresh: () => Promise<void>;
  pair: (code: string) => Promise<ClaimResult>;
  rename: (id: string, label: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const EMPTY_COLLAR_LIVE: CollarLiveValue = {
  loading: false,
  collars: [],
  selected: null,
  select: () => {},
  latest: null,
  latestReal: null,
  state: "no_collar",
  now: 0,
  realtime: false,
  replay: null,
  replayError: null,
  startReplay: async () => {},
  stopReplay: () => {},
  refresh: async () => {},
  pair: async () => ({ deviceId: null, result: "not_found" }),
  rename: async () => {},
  remove: async () => {},
};

export const CollarLiveContext = createContext<CollarLiveValue | null>(null);

/** Outside the provider (public pages, sandboxes) this reads as "no collar", never a crash. */
export function useCollarLive(): CollarLiveValue {
  return useContext(CollarLiveContext) ?? EMPTY_COLLAR_LIVE;
}

interface ReplayRun {
  deviceId: string;
  idx: number;
  failures: number;
  busy: boolean;
}

export function CollarLiveProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [collars, setCollars] = useState<CollarDevice[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [latestById, setLatestById] = useState<Record<string, LatestPair>>({});
  const [now, setNow] = useState(() => Date.now());
  const [realtime, setRealtime] = useState(false);
  const [replay, setReplay] = useState<ReplayProgress | null>(null);
  const [replayError, setReplayError] = useState<ReplayError | null>(null);
  const runRef = useRef<ReplayRun | null>(null);

  const refresh = useCallback(async () => {
    if (!userId) {
      setCollars([]);
      setLatestById({});
      setSelectedId(null);
      setLoading(false);
      return;
    }
    try {
      const devices = await loadCollars();
      const latest = await loadLatest(devices.map((d) => d.id));
      setCollars(devices);
      setLatestById(latest);
      setSelectedId((current) => (current && devices.some((d) => d.id === current) ? current : devices[0]?.id ?? null));
      setNow(Date.now());
    } catch {
      // Keep what is on screen; the next poll or Realtime event tries again.
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    return subscribeCollars(userId, {
      onPosition: (position) => {
        setLatestById((prev) => mergePosition(prev, position));
        setNow(Date.now());
      },
      onDevice: (device) => setCollars((prev) => prev.map((c) => (c.id === device.id ? { ...c, ...device } : c))),
      onStatus: setRealtime,
    });
  }, [userId]);

  // Realtime can be blocked (captive Wi-Fi, proxies); the page must still move.
  useEffect(() => {
    if (!userId || realtime) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [userId, realtime, refresh]);

  // Ages ("updated 20 s ago", live → searching after 45 s) change without any new data.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);

  const stopReplay = useCallback(() => {
    runRef.current = null;
    setReplay(null);
  }, []);

  const tickReplay = useCallback(async () => {
    const run = runRef.current;
    if (!run || run.busy) return;
    run.busy = true;
    try {
      const point = await replayCollarPoint(run.deviceId, run.idx);
      if (runRef.current !== run) return;
      run.failures = 0;
      const position: CollarPosition = {
        device_id: run.deviceId,
        lat: point.lat,
        lng: point.lng,
        speed_kmh: point.speed_kmh,
        recorded_at: new Date().toISOString(),
        source: "replay",
      };
      setLatestById((prev) => mergePosition(prev, position));
      setNow(Date.now());
      run.idx = point.idx + 1;
      if (run.idx >= point.total) {
        stopReplay();
        return;
      }
      setReplay({ deviceId: run.deviceId, idx: run.idx, total: point.total });
    } catch (error) {
      if (runRef.current !== run) return;
      if (error instanceof Error && error.message.includes("no_recording")) {
        setReplayError("no_recording");
        stopReplay();
        return;
      }
      run.failures += 1;
      if (run.failures >= REPLAY_MAX_FAILURES) {
        setReplayError("stopped");
        stopReplay();
      }
    } finally {
      run.busy = false;
    }
  }, [stopReplay]);

  const replayingId = replay?.deviceId ?? null;
  useEffect(() => {
    if (!replayingId) return;
    const timer = setInterval(() => void tickReplay(), REPLAY_TICK_MS);
    return () => clearInterval(timer);
  }, [replayingId, tickReplay]);

  const startReplay = useCallback(async () => {
    setReplayError(null);
    let deviceId = selectedId;
    if (!deviceId) {
      try {
        deviceId = await createDemoCollar();
      } catch {
        setReplayError("stopped");
        return;
      }
      await refresh();
      setSelectedId(deviceId);
    }
    runRef.current = { deviceId, idx: 0, failures: 0, busy: false };
    setReplay({ deviceId, idx: 0, total: 0 });
    await tickReplay();
  }, [selectedId, refresh, tickReplay]);

  const pair = useCallback(
    async (code: string) => {
      const result = await claimCollar(code);
      if (result.result === "paired" || result.result === "already_yours") {
        await refresh();
        if (result.deviceId) setSelectedId(result.deviceId);
      }
      return result;
    },
    [refresh],
  );

  const rename = useCallback(async (id: string, label: string) => {
    await renameCollar(id, label);
    setCollars((prev) => prev.map((c) => (c.id === id ? { ...c, label } : c)));
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (runRef.current?.deviceId === id) stopReplay();
      await unpairCollar(id);
      await refresh();
    },
    [refresh, stopReplay],
  );

  const selected = collars.find((c) => c.id === selectedId) ?? null;
  const pairOfSelected = (selectedId && latestById[selectedId]) || EMPTY_PAIR;
  const state = collarState({
    device: selected,
    latest: pairOfSelected.latest,
    latestReal: pairOfSelected.latestReal,
    replayingHere: replay !== null && replay.deviceId === selectedId,
    now,
  });

  const value = useMemo<CollarLiveValue>(
    () => ({
      loading,
      collars,
      selected,
      select: setSelectedId,
      latest: pairOfSelected.latest,
      latestReal: pairOfSelected.latestReal,
      state,
      now,
      realtime,
      replay,
      replayError,
      startReplay,
      stopReplay,
      refresh,
      pair,
      rename,
      remove,
    }),
    [loading, collars, selected, pairOfSelected, state, now, realtime, replay, replayError, startReplay, stopReplay, refresh, pair, rename, remove],
  );

  return <CollarLiveContext.Provider value={value}>{children}</CollarLiveContext.Provider>;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/context/__tests__/CollarLiveContext.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 5: Mount it in the app layout**

In `src/app/(app)/layout.tsx`: add `import { CollarLiveProvider } from "@/context/CollarLiveContext";` and wrap the `<div className="min-h-[100dvh]">…</div>` inside `NotificationsProvider` with it:

```tsx
    <FavoritesProvider>
      <NotificationsProvider>
        <CollarLiveProvider>
          {/* No backdrop of its own: the root layout's Atmosphere is the one ambient
              field behind every page, signed in or not. */}
          <div className="min-h-[100dvh]">
            <Sidebar />

            <div className="lg:pl-64 relative z-10">
              <main className="min-h-[calc(100dvh-3.5rem)] lg:min-h-[100dvh]">{children}</main>
            </div>
          </div>
        </CollarLiveProvider>
      </NotificationsProvider>
    </FavoritesProvider>
```

- [ ] **Step 6: Full suite and typecheck**

Run: `cd C:/Users/lkspe/petbnb && npm test && npm run typecheck`
Expected: all green; tsc 0.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/context/CollarLiveContext.tsx src/context/__tests__/CollarLiveContext.test.tsx "src/app/(app)/layout.tsx" && git commit -F - <<'EOF'
Keep the user's collars live across the app, with the recorded-walk loop

One provider owns the collar list, newest positions, the Realtime channel
(polling every 15 s when it is down) and the replay loop, so the walk
keeps playing while the user moves between pages.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Sidebar A — collar and Smart-ID cards, Legal in the footer, collar button on phones

**Files:**
- Create: `src/components/collar/names.ts`, `src/components/SidebarSpotlight.tsx`
- Modify: `src/components/Sidebar.tsx` (whole file below)
- Modify: `src/components/__tests__/Sidebar.test.tsx` (whole file below)

**Interfaces:**
- Consumes: Task 8 `useCollarLive`; Task 4 `MiniMap`, `LiveDot`; Task 3 `formatClock`; Task 7 keys; `useProfile().profile.is_verified`.
- Produces: `collarName(device, t) → string`; `<SidebarSpotlight onNavigate? />`.

- [ ] **Step 1: Rewrite the Sidebar tests (they fail against today's Sidebar)**

Replace the whole of `src/components/__tests__/Sidebar.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import Sidebar from "@/components/Sidebar";
import { EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";

/**
 * The app's primary navigation. Rendered without a LanguageProvider, so `t` is the identity
 * function and every accessible name is its translation key. Everything the sidebar reaches for
 * outside itself — router, profile, unread count, sign-out, the live collar — is mocked.
 */

const h = vi.hoisted(() => ({
  pathname: "/dashboard",
  unreadCount: 0,
  verified: false,
  collar: null as unknown as CollarLiveValue,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => h.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ profile: { full_name: "Rūta", avatar_url: null, is_verified: h.verified }, loading: false, isComplete: true, refresh: vi.fn() }),
}));
vi.mock("@/context/NotificationsContext", () => ({
  useNotifications: () => ({ unreadCount: h.unreadCount, notifications: [], loading: false, markRead: vi.fn(), markAllRead: vi.fn(), markThreadRead: vi.fn() }),
}));
vi.mock("@/context/CollarLiveContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/CollarLiveContext")>();
  return { ...actual, useCollarLive: () => h.collar };
});
vi.mock("@/lib/auth", () => ({ signOut: vi.fn() }));

const LIVE_COLLAR: CollarLiveValue = {
  ...EMPTY_COLLAR_LIVE,
  collars: [{ id: "c1", label: "Reksas", is_demo: false, claimed_at: null, created_at: "2026-09-26T08:00:00Z", last_seen_at: "2026-09-26T11:59:58Z", gps_locked: true, gps_satellites: 7 }],
  selected: { id: "c1", label: "Reksas", is_demo: false, claimed_at: null, created_at: "2026-09-26T08:00:00Z", last_seen_at: "2026-09-26T11:59:58Z", gps_locked: true, gps_satellites: 7 },
  latest: { device_id: "c1", lat: 54.683, lng: 25.233, speed_kmh: 4.2, recorded_at: new Date().toISOString(), source: "collar" },
  state: "live",
};

const nav = () => screen.getAllByRole("navigation")[0];
const navHrefs = () => within(nav()).getAllByRole("link").map((a) => a.getAttribute("href"));
/** The desktop rail and the phone drawer share markup; the rail is the first match. */
const first = (name: RegExp) => screen.getAllByRole("link", { name })[0];

beforeEach(() => {
  h.pathname = "/dashboard";
  h.unreadCount = 0;
  h.verified = false;
  h.collar = EMPTY_COLLAR_LIVE;
});

describe("Sidebar navigation", () => {
  it("lists the app's sections in a deliberate order, legal no longer among them", () => {
    render(<Sidebar />);
    expect(navHrefs()).toEqual(["/dashboard", "/browse", "/pets", "/bookings", "/messages", "/saved", "/profile"]);
  });

  it("marks only the section you are actually in", () => {
    h.pathname = "/bookings";
    render(<Sidebar />);
    const current = within(nav()).getAllByRole("link").filter((a) => a.getAttribute("aria-current") === "page").map((a) => a.getAttribute("href"));
    expect(current).toEqual(["/bookings"]);
  });

  it("drops the separate Find a sitter button (Browse is in the menu)", () => {
    render(<Sidebar />);
    expect(screen.queryByText("appShell.findASitter")).toBeNull();
  });
});

describe("Legal in the footer line", () => {
  it("links to legal from the footer, labelled from the dictionary", () => {
    render(<Sidebar />);
    expect(first(/appShell\.sidebar\.nav\.legal/).getAttribute("href")).toBe("/legal");
  });

  it("marks the legal link current on the privacy tab as well as the terms tab", () => {
    h.pathname = "/legal/privacy";
    render(<Sidebar />);
    expect(first(/nav\.legal/).getAttribute("aria-current")).toBe("page");
  });

  it("does not mark legal current while you are elsewhere", () => {
    render(<Sidebar />);
    expect(first(/nav\.legal/).getAttribute("aria-current")).toBeNull();
  });
});

describe("the collar and Smart-ID cards", () => {
  it("offers to pair a collar when there is none", () => {
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.pairTitle/);
    expect(card.getAttribute("href")).toBe("/collar");
  });

  it("shows the live collar with its name and the LIVE pill", () => {
    h.collar = LIVE_COLLAR;
    render(<Sidebar />);
    const card = first(/Reksas/);
    expect(card.getAttribute("href")).toBe("/collar");
    expect(within(card).getByText("appShell.spotlight.live")).toBeTruthy();
    expect(within(card).getByText("appShell.spotlight.lineLive")).toBeTruthy();
  });

  it("says Smart-ID is not verified yet, and links to the demo", () => {
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.smartIdTitle/);
    expect(card.getAttribute("href")).toBe("/smart-id-demo");
    expect(within(card).getByText("appShell.spotlight.smartIdTodo")).toBeTruthy();
  });

  it("says the identity is verified, with the DEMO marker, once it is", () => {
    h.verified = true;
    render(<Sidebar />);
    const card = first(/appShell\.spotlight\.smartIdTitle/);
    expect(within(card).getByText("appShell.spotlight.smartIdVerified")).toBeTruthy();
    expect(within(card).getByText("appShell.spotlight.demo")).toBeTruthy();
  });

  it("puts a collar button in the phone's top bar", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "appShell.spotlight.collarButton" }).getAttribute("href")).toBe("/collar");
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/Sidebar.test.tsx`
Expected: FAIL — `/legal` is still in the nav, the spotlight links don't exist.

- [ ] **Step 3: Write `names.ts` and `SidebarSpotlight.tsx`**

Create `src/components/collar/names.ts`:

```ts
import type { CollarDevice } from "@/lib/collar/types";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** A demo collar is always "Recorded walk" in the page's language; a real one is its label. */
export function collarName(device: CollarDevice, t: T): string {
  if (device.is_demo) return t("appPages.collar.demoName");
  return device.label || t("appPages.collar.unnamed");
}
```

Create `src/components/SidebarSpotlight.tsx`:

```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, ChevronRight, Radar, ShieldCheck } from "lucide-react";
import { useCollarLive } from "@/context/CollarLiveContext";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/context/LanguageContext";
import { cn, timeAgo } from "@/lib/utils";
import { formatClock } from "@/lib/collar/stats";
import MiniMap from "@/components/collar/MiniMap";
import LiveDot from "@/components/collar/LiveDot";
import { collarName } from "@/components/collar/names";

/**
 * Sidebar option A (Lukas, 2026-09-26): the collar and Smart-ID at the top of the menu on every
 * page — the two things the thesis defence is about. Shared by the desktop rail and the phone drawer.
 */
export default function SidebarSpotlight({ onNavigate }: { onNavigate?: () => void }) {
  const { t, locale } = useLanguage();
  const pathname = usePathname();
  const { selected, latest, state } = useCollarLive();
  const { profile } = useProfile();
  const verified = !!profile?.is_verified;
  const onCollar = pathname === "/collar";
  const onSmartId = pathname.startsWith("/smart-id-demo");

  const line = (() => {
    switch (state) {
      case "live":
        return t("appShell.spotlight.lineLive", {
          ago: latest ? timeAgo(latest.recorded_at, t, "appPages.collar.ago") : "",
          speed: (latest?.speed_kmh ?? 0).toFixed(1),
        });
      case "replaying":
        return t("appShell.spotlight.lineReplaying");
      case "searching":
        return t("appShell.spotlight.lineSearching");
      case "waiting":
        return t("appShell.spotlight.lineWaiting");
      case "offline":
        return t("appShell.spotlight.lineOffline", {
          time: selected?.last_seen_at ? formatClock(selected.last_seen_at, locale) : "–",
        });
      case "demo_idle":
        return t("appShell.spotlight.lineDemoIdle");
      default:
        return t("appShell.spotlight.pairText");
    }
  })();

  return (
    <div className="mb-4 space-y-2">
      <Link
        href="/collar"
        onClick={onNavigate}
        aria-current={onCollar ? "page" : undefined}
        className={cn(
          "glass-card block overflow-hidden rounded-2xl border transition-shadow hover:shadow-[var(--shadow-md)]",
          onCollar && "ring-2 ring-brand",
        )}
      >
        {selected && latest && (
          <div className="relative">
            <MiniMap lat={latest.lat} lng={latest.lng} height={56} muted={state === "offline" || state === "demo_idle"} />
            {(state === "live" || state === "replaying") && (
              <span className="absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-px text-[9.5px] font-bold tracking-[0.08em] text-ink shadow-sm">
                <LiveDot className="h-1.5 w-1.5" />
                {state === "replaying" ? t("appShell.spotlight.demo") : t("appShell.spotlight.live")}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-2.5 px-3 py-2">
          {!selected && (
            <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] bg-slate text-white">
              <Radar className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-semibold text-ink">
              {selected ? (
                <>
                  {collarName(selected, t)}
                  <span className="font-medium text-ink-soft"> · {t("appShell.spotlight.collarTitle")}</span>
                </>
              ) : (
                t("appShell.spotlight.pairTitle")
              )}
            </div>
            <div className="truncate text-[11.5px] text-ink-soft">{line}</div>
          </div>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-soft/70" aria-hidden="true" />
        </div>
      </Link>

      <Link
        href="/smart-id-demo"
        onClick={onNavigate}
        aria-current={onSmartId ? "page" : undefined}
        className={cn(
          "glass-card flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 transition-shadow hover:shadow-[var(--shadow-md)]",
          onSmartId && "ring-2 ring-brand",
        )}
      >
        <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#2a7a5e] to-brand-strong text-white">
          <ShieldCheck className="h-[17px] w-[17px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-ink">{t("appShell.spotlight.smartIdTitle")}</div>
          <div className={cn("flex items-center gap-1 truncate text-[11.5px] font-medium", verified ? "text-brand" : "text-amber-strong")}>
            {verified && <Check className="h-3 w-3" strokeWidth={2.6} aria-hidden="true" />}
            {verified ? t("appShell.spotlight.smartIdVerified") : t("appShell.spotlight.smartIdTodo")}
          </div>
        </div>
        {verified ? (
          <span className="rounded-md bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-amber-strong">
            {t("appShell.spotlight.demo")}
          </span>
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink-soft/70" aria-hidden="true" />
        )}
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite `Sidebar.tsx`**

Replace the whole of `src/components/Sidebar.tsx` with:

```tsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Search, Heart, CalendarDays, MessageCircle, Bookmark, User, Menu, X, LogOut, Radar } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";
import { signOut } from "@/lib/auth";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationsContext";
import { useCollarLive } from "@/context/CollarLiveContext";
import Avatar from "./Avatar";
import Logo from "./Logo";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "@/components/NotificationBell";
import SidebarSpotlight from "@/components/SidebarSpotlight";
import LiveDot from "@/components/collar/LiveDot";

// Legal moved into the footer line (2026-09-26): the collar and Smart-ID cards took its height,
// and it is reference material, not somewhere anyone came here to go.
const LINKS = [
  { href: "/dashboard", key: "appShell.sidebar.nav.dashboard", icon: LayoutDashboard },
  { href: "/browse", key: "appShell.sidebar.nav.browse", icon: Search },
  { href: "/pets", key: "appShell.sidebar.nav.pets", icon: Heart },
  { href: "/bookings", key: "appShell.sidebar.nav.bookings", icon: CalendarDays },
  { href: "/messages", key: "appShell.sidebar.nav.messages", icon: MessageCircle },
  { href: "/saved", key: "appShell.sidebar.nav.saved", icon: Bookmark },
  { href: "/profile", key: "appShell.sidebar.nav.profile", icon: User },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { profile } = useProfile();
  const { unreadCount } = useNotifications();
  const { state: collarState } = useCollarLive();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock the page behind the drawer. Without this, dragging the backdrop scrolls the
  // content underneath and closing the drawer drops you somewhere else on the page.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const handleSignOut = async () => { await signOut(); router.push("/login"); };
  const close = () => setOpen(false);
  // /legal redirects to /legal/terms, so this stays current on the privacy tab too.
  const legalActive = pathname === "/legal" || pathname.startsWith("/legal/");
  const collarPulsing = collarState === "live" || collarState === "replaying";

  // Shared by the desktop rail and the mobile drawer. The drawer is opened from the mobile
  // top bar, which carries its own bell, so this one is hidden below lg to avoid two bells
  // on the same screen. It opens left-anchored: a right-anchored panel would run off the
  // left edge of this 256px rail.
  const Inner = (
    <>
      <div className="flex items-center justify-between px-2 mb-4">
        <Link href="/dashboard" onClick={close} className="flex items-center">
          <Logo size={32} showWordmark />
        </Link>
        <div className="hidden lg:block -mr-1">
          <NotificationBell align="left" />
        </div>
      </div>

      <SidebarSpotlight onNavigate={close} />

      <nav className="space-y-0.5">
        {LINKS.map(({ href, key, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          const badge = href === "/messages" ? unreadCount : 0;
          return (
            <Link key={href} href={href} onClick={close}
              // The active state used to be styling only, and colour alone does not
              // tell a screen reader which section it is in.
              aria-current={active ? "page" : undefined}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors", active ? "bg-brand-soft text-brand-strong" : "text-ink-soft hover:bg-brand-softer hover:text-ink")}>
              <Icon className="w-[18px] h-[18px]" />{t(key)}
              {badge > 0 && (
                <span className="ml-auto bg-brand text-white text-[11px] font-semibold rounded-full min-w-[18px] h-[18px] px-1 grid place-items-center">
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      <div className="px-1 mt-2">
        <LanguageSwitcher />
      </div>

      <div className="border-t border-ink/8 pt-4 mt-4">
        {profile && (
          <div className="flex items-center gap-3 px-1">
            <Avatar name={profile.full_name ?? t("appShell.sidebar.youFallback")} url={profile.avatar_url} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink truncate">{profile.full_name ?? t("appShell.sidebar.youFallback")}</div>
              <div className="text-xs text-ink-soft truncate">{profile.city ?? ""}</div>
            </div>
            <button onClick={handleSignOut} title={t("appShell.sidebar.signOut")} className="p-2 rounded-lg text-ink-soft hover:text-ink hover:bg-brand-softer transition-colors"><LogOut className="w-4 h-4" /></button>
          </div>
        )}
        <p className="text-[11px] text-ink-soft/60 px-1 mt-3">
          {t("appShell.sidebar.footerNote")} ·{" "}
          <Link href="/legal" onClick={close} aria-current={legalActive ? "page" : undefined}
            className={cn("underline-offset-2 hover:underline", legalActive ? "font-medium text-ink" : "text-ink-soft")}>
            {t("appShell.sidebar.nav.legal")}
          </Link>
        </p>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <header className={`lg:hidden sticky top-0 z-40 glass border-b h-14 flex items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] transition-shadow duration-300 ease-out ${scrolled ? "shadow-[var(--shadow-sm)]" : ""}`}>
        <Link href="/dashboard" className="flex items-center">
          <Logo size={28} showWordmark />
        </Link>
        <div className="flex items-center gap-1.5">
          <Link href="/collar" aria-label={t("appShell.spotlight.collarButton")}
            className="relative grid h-9 w-9 place-items-center rounded-xl bg-slate text-white">
            <Radar className="h-[17px] w-[17px]" aria-hidden="true" />
            {collarPulsing && <LiveDot className="absolute -right-0.5 -top-0.5" />}
          </Link>
          <LanguageSwitcher />
          <NotificationBell />
          <button onClick={() => setOpen(true)} className="p-2 rounded-lg text-ink-soft hover:bg-brand-softer"><Menu className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Desktop fixed sidebar. Scrolls on short screens now that it carries the spotlight cards. */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 glass border-r flex-col p-4 z-40 overflow-y-auto">
        {Inner}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open && (
          <div className="lg:hidden">
            <motion.div className="fixed inset-0 glass-scrim z-50 touch-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close} />
            <motion.aside className="fixed inset-y-0 left-0 w-72 bg-surface flex flex-col z-50 overflow-y-auto overscroll-contain pl-[max(1rem,env(safe-area-inset-left))] pr-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]"
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", stiffness: 400, damping: 38 }}>
              <button onClick={close} className="self-end p-2 rounded-lg text-ink-soft hover:bg-brand-softer -mt-1 mb-1"><X className="w-5 h-5" /></button>
              {Inner}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/__tests__/Sidebar.test.tsx && npm run typecheck`
Expected: PASS (11 tests); tsc 0.

- [ ] **Step 6: Full suite**

Run: `cd C:/Users/lkspe/petbnb && npm test`
Expected: all green. (Any other test that rendered `Sidebar` and asserted the Find-a-sitter button must be updated in the same way — search with `grep -rn "findASitter" src --include=*.test.tsx`.)

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/collar/names.ts src/components/SidebarSpotlight.tsx src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx && git commit -F - <<'EOF'
Put the collar and Smart-ID at the top of the sidebar on every page

Sidebar option A: a live mini-map card for the collar and a Smart-ID
status card above the menu, in the rail and the phone drawer, plus a
collar button in the phone's top bar. The Find a sitter button goes
(Browse is in the menu) and Legal moves into the footer line.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 10: The map hero — `CollarMap` upgrade, status card, state cards, replay banner

**Files:**
- Modify: `src/components/CollarMap.tsx` (whole file below)
- Create: `src/components/collar/LazyCollarMap.tsx`, `src/components/collar/usePlaceName.ts`, `src/components/collar/StatusCard.tsx`, `src/components/collar/StateCard.tsx`, `src/components/collar/ReplayBanner.tsx`, `src/components/collar/CollarHero.tsx`
- Test: `src/components/collar/__tests__/CollarHero.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4, 7, 8 (`ReplayProgress`, `ReplayError`), `timeAgo`.
- Produces: `CollarMap` props `{lat, lng, label?, path?, showMarker?, stale?, fitKey?, controls?: {zoomIn, zoomOut, locate}}`; `usePlaceName(position) → string | null`; `<CollarHero state device latest trail fitKey now replay replayError onPlay onStop />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/collar/__tests__/CollarHero.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CollarHero from "@/components/collar/CollarHero";
import type { CollarDevice, CollarPosition, CollarState } from "@/lib/collar/types";

vi.mock("@/components/collar/LazyCollarMap", () => ({
  default: (props: { showMarker?: boolean; stale?: boolean }) => (
    <div data-testid="map" data-marker={String(props.showMarker)} data-stale={String(props.stale)} />
  ),
}));
vi.mock("@/lib/collar/placeName", () => ({ lookupPlace: async () => "Vingio parkas" }));

const NOW = Date.parse("2026-09-26T12:00:00Z");
const device: CollarDevice = {
  id: "c1", label: "Reksas", is_demo: false, claimed_at: "2026-09-24T10:00:00Z", created_at: "2026-09-24T10:00:00Z",
  last_seen_at: "2026-09-26T11:48:00Z", gps_locked: false, gps_satellites: 2,
};
const latest: CollarPosition = {
  device_id: "c1", lat: 54.683, lng: 25.233, speed_kmh: 4.2, recorded_at: "2026-09-26T11:59:57Z", source: "collar",
};

function hero(state: CollarState, over: Partial<Parameters<typeof CollarHero>[0]> = {}) {
  const onPlay = vi.fn();
  const onStop = vi.fn();
  render(
    <CollarHero state={state} device={device} latest={latest} trail={[latest]} fitKey="c1:today" now={NOW}
      replay={null} replayError={null} onPlay={onPlay} onStop={onStop} {...over} />,
  );
  return { onPlay, onStop };
}

describe("CollarHero", () => {
  it("shows speed, activity and satellites while live", async () => {
    hero("live", { device: { ...device, gps_satellites: 7, last_seen_at: "2026-09-26T11:59:57Z" } });
    expect(screen.getAllByText("4.2").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/appPages\.collar\.activity\.walking/).length).toBeGreaterThan(0);
    expect(screen.getByText("appPages.collar.satellitesLocked")).toBeTruthy();
    expect(screen.getByText("appPages.collar.onWifi")).toBeTruthy();
    // On the desktop card and the phone chip (both in the DOM; CSS picks one).
    expect((await screen.findAllByText(/Vingio parkas/)).length).toBeGreaterThan(0);
  });

  it("shows the replay banner with progress and a Stop button while replaying", () => {
    const { onStop } = hero("replaying", { latest: { ...latest, source: "replay" }, replay: { deviceId: "c1", idx: 23, total: 64 } });
    expect(screen.getByText("appPages.collar.replay.title")).toBeTruthy();
    expect(screen.getByText(/appPages\.collar\.replay\.progress/)).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("23");
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.stop/ }));
    expect(onStop).toHaveBeenCalled();
  });

  it("explains searching indoors and offers the recorded walk", () => {
    const { onPlay } = hero("searching", { latest: null });
    expect(screen.getByText("appPages.collar.searching.title")).toBeTruthy();
    expect(screen.getByText("appPages.collar.searching.count")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.marker).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("shows offline with a grey marker at the last position", () => {
    hero("offline");
    expect(screen.getByText("appPages.collar.offline.title")).toBeTruthy();
    expect(screen.getByText("appPages.collar.offline.lastSeen")).toBeTruthy();
    expect(screen.getByTestId("map").dataset.stale).toBe("true");
  });

  it("shows waiting for a collar that never checked in", () => {
    hero("waiting", { latest: null });
    expect(screen.getByText("appPages.collar.waiting.title")).toBeTruthy();
  });

  it("offers to play again on an idle demo collar", () => {
    const { onPlay } = hero("demo_idle", { device: { ...device, is_demo: true } });
    expect(screen.getByText("appPages.collar.demoIdle.title")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("says the recorded walk stopped and offers to try again", () => {
    const { onPlay } = hero("searching", { replayError: "stopped" });
    expect(screen.getByText("appPages.collar.replay.stopped")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.replay\.tryAgain/ }));
    expect(onPlay).toHaveBeenCalled();
  });

  it("says when there is no recording yet", () => {
    hero("searching", { replayError: "no_recording" });
    expect(screen.getByText("appPages.collar.replay.noRecording")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/CollarHero.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Upgrade `CollarMap.tsx`**

Replace the whole of `src/components/CollarMap.tsx` with:

```tsx
"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Minus, Plus } from "lucide-react";

// Literal hex, not var(--token) — Leaflet's SVG renderer writes stroke/fill
// as presentation attributes, which don't resolve CSS custom properties.
// Keep these in sync with globals.css.
const BRAND = "#1f5c47"; // --brand — the solid walked-route line
const AMBER = "#dc9a35"; // --amber — live position + waypoint dots
const SLATE = "#3f6472"; // --slate — route casing / the collar system's own "instrument" accent
const STALE = "#8a948f"; // a position the collar is no longer reporting

const GLIDE_MS = 800;

let pulseStyleInjected = false;
function ensureMarkerStyles() {
  if (pulseStyleInjected || typeof document === "undefined") return;
  pulseStyleInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes collar-live-pulse {
      0% { transform: scale(0.7); opacity: 0.5; }
      75%, 100% { transform: scale(2.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// The collar's position: a soft pulsing amber dot while live — the one marker on the page allowed
// to use amber as a fill, since it needs to say "live" at a glance — and a still grey dot once the
// collar stopped reporting.
function markerIcon(stale: boolean) {
  const colour = stale ? STALE : AMBER;
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:22px;height:22px;">
        ${stale ? "" : `<span style="position:absolute;inset:0;border-radius:9999px;background:${colour};animation:collar-live-pulse 2.2s ease-out infinite;"></span>`}
        <span style="position:absolute;inset:6px;border-radius:9999px;background:${colour};box-shadow:0 0 0 2px #fff, 0 2px 6px rgb(19 26 23 / 0.35);"></span>
      </div>
    `,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

interface CollarMapProps {
  lat: number;
  lng: number;
  label?: string;
  /** Earlier points (oldest first) drawn as a line behind the marker. */
  path?: { lat: number; lng: number }[];
  /** False while the collar has never reported a position. */
  showMarker?: boolean;
  /** Grey, still marker for a collar that went offline. */
  stale?: boolean;
  /** Changing this refits the view to the path (another collar, another day, a replay). */
  fitKey?: string;
  /** Labels for the glass zoom/locate buttons; omitted, there are none. */
  controls?: { zoomIn: string; zoomOut: string; locate: string };
}

export default function CollarMap({ lat, lng, label, path, showMarker = true, stale = false, fitKey, controls }: CollarMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeCasingRef = useRef<L.Polyline | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const waypointsRef = useRef<L.LayerGroup | null>(null);
  const fittedKeyRef = useRef<string | undefined>(undefined);
  const glideRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureMarkerStyles();
    const map = L.map(containerRef.current, { zoomControl: false }).setView([lat, lng], 15);
    map.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    // Two-stroke route: a wide, soft slate casing (the map "glows") underneath
    // a thinner solid pine line on top — the collar system's own register.
    routeCasingRef.current = L.polyline([], { color: SLATE, weight: 8, opacity: 0.25, lineCap: "round", lineJoin: "round" }).addTo(map);
    routeLineRef.current = L.polyline([], { color: BRAND, weight: 3, opacity: 0.9, lineCap: "round", lineJoin: "round" }).addTo(map);
    waypointsRef.current = L.layerGroup().addTo(map);
    markerRef.current = L.marker([lat, lng], { icon: markerIcon(stale) });
    mapRef.current = map;
    return () => {
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    markerRef.current?.setIcon(markerIcon(stale));
  }, [stale]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (showMarker) {
      if (!map.hasLayer(marker)) marker.setLatLng([lat, lng]).addTo(map);
      // Glide to the new position instead of jumping, so the dot reads as a moving dog.
      const from = marker.getLatLng();
      const start = performance.now();
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      const step = (t: number) => {
        const k = Math.min(1, (t - start) / GLIDE_MS);
        marker.setLatLng([from.lat + (lat - from.lat) * k, from.lng + (lng - from.lng) * k]);
        if (k < 1) glideRef.current = requestAnimationFrame(step);
      };
      glideRef.current = requestAnimationFrame(step);
      if (label) marker.bindPopup(label);
    } else if (map.hasLayer(marker)) {
      marker.remove();
    }

    const trail = path ?? [];
    const points = trail.map((p): [number, number] => [p.lat, p.lng]);
    if (showMarker) points.push([lat, lng]);
    routeCasingRef.current?.setLatLngs(points);
    routeLineRef.current?.setLatLngs(points);

    // Waypoint dots: a handful of small amber markers along the interior of the trail.
    waypointsRef.current?.clearLayers();
    if (trail.length > 3 && waypointsRef.current) {
      const stride = Math.max(1, Math.floor(trail.length / 6));
      for (let i = stride; i < trail.length; i += stride) {
        L.circleMarker([trail[i].lat, trail[i].lng], {
          radius: 3.5, color: "#fff", weight: 1.5, fillColor: AMBER, fillOpacity: 1,
        }).addTo(waypointsRef.current);
      }
    }

    // Fit once per fitKey; afterwards only follow the collar if it walks out of view, so a
    // presenter who zoomed in is not yanked back every 15 seconds.
    if (fittedKeyRef.current !== fitKey) {
      fittedKeyRef.current = fitKey;
      if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [32, 32], maxZoom: 17 });
      else map.setView([lat, lng], 16);
    } else if (showMarker && !map.getBounds().pad(-0.15).contains([lat, lng])) {
      map.panTo([lat, lng]);
    }
  }, [lat, lng, label, path, showMarker, fitKey]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {controls && (
        <div className="glass-panel absolute right-4 top-4 z-[800] flex flex-col rounded-[14px] border p-0.5">
          <button type="button" aria-label={controls.zoomIn} onClick={() => mapRef.current?.zoomIn()} className="grid h-9 w-9 place-items-center text-ink-soft hover:text-ink">
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label={controls.zoomOut} onClick={() => mapRef.current?.zoomOut()} className="grid h-9 w-9 place-items-center border-t border-ink/8 text-ink-soft hover:text-ink">
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" aria-label={controls.locate} onClick={() => mapRef.current?.setView([lat, lng], Math.max(16, mapRef.current.getZoom()))} className="grid h-9 w-9 place-items-center border-t border-ink/8 text-ink-soft hover:text-ink">
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write the hero pieces**

Create `src/components/collar/LazyCollarMap.tsx`:

```tsx
"use client";
import dynamic from "next/dynamic";

/** Leaflet touches window on import, so the map only ever loads in the browser. */
const LazyCollarMap = dynamic(() => import("@/components/CollarMap"), { ssr: false });

export default LazyCollarMap;
```

Create `src/components/collar/usePlaceName.ts`:

```ts
"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { lookupPlace } from "@/lib/collar/placeName";
import type { CollarPosition } from "@/lib/collar/types";

/** The place under the collar ("Vingio parkas"), or null while unknown or unavailable. */
export function usePlaceName(position: CollarPosition | null): string | null {
  const { locale } = useLanguage();
  const [name, setName] = useState<string | null>(null);
  const lat = position?.lat;
  const lng = position?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    let active = true;
    void lookupPlace(lat, lng, locale).then((found) => {
      if (active) setName(found);
    });
    return () => {
      active = false;
    };
  }, [lat, lng, locale]);

  return position ? name : null;
}
```

Create `src/components/collar/StatusCard.tsx`:

```tsx
"use client";
import { Satellite, Wifi } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { activityOf } from "@/lib/collar/stats";
import { timeAgo } from "@/lib/utils";
import type { CollarDevice, CollarPosition } from "@/lib/collar/types";
import LiveDot from "./LiveDot";

/** The glass card floating on the live map: speed first, then what the dog is doing and where. */
export default function StatusCard({ device, latest, place }: { device: CollarDevice; latest: CollarPosition; place: string | null }) {
  const { t } = useLanguage();
  const speed = latest.speed_kmh;
  const activity = speed == null ? null : activityOf(speed);

  return (
    <div className="glass-panel absolute left-4 top-4 z-[800] hidden w-60 rounded-[14px] border px-4 pb-3.5 pt-3 sm:block">
      <div className="flex items-center gap-2 text-xs">
        <LiveDot />
        <b className="tracking-[0.08em] text-ink">{t("appPages.collar.states.live")}</b>
        <span className="text-ink-soft">· {t("appPages.collar.updatedAgo", { ago: timeAgo(latest.recorded_at, t, "appPages.collar.ago") })}</span>
      </div>
      <div className="mt-2 font-display text-[34px] font-semibold leading-none tracking-tight text-ink">
        {speed == null ? "–" : speed.toFixed(1)}
        <small className="ml-1 text-[15px] font-medium tracking-normal text-ink-soft">{t("appPages.collar.speedUnit")}</small>
      </div>
      <div className="mt-1 text-[13px] text-ink-soft">
        {activity ? t(`appPages.collar.activity.${activity}`) : ""}
        {place ? `${activity ? " · " : ""}${place}` : ""}
      </div>
      <div className="mt-3 space-y-1 border-t border-ink/8 pt-2.5 text-xs text-ink-soft">
        {device.gps_satellites != null && (
          <div className="flex items-center gap-2">
            <Satellite className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
            {t("appPages.collar.satellitesLocked", { count: device.gps_satellites })}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Wifi className="h-3.5 w-3.5 text-slate" aria-hidden="true" />
          {t("appPages.collar.onWifi")}
        </div>
      </div>
    </div>
  );
}
```

Create `src/components/collar/StateCard.tsx`:

```tsx
import type { ReactNode } from "react";

/** The glass card at the foot of the map for every state that is not "live": what happened, what next. */
export default function StateCard({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="glass-panel absolute inset-x-3 bottom-3 z-[800] rounded-[14px] border px-4 py-3.5 sm:left-4 sm:right-auto sm:w-[360px]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {title}
      </h2>
      {children}
    </div>
  );
}
```

Create `src/components/collar/ReplayBanner.tsx`:

```tsx
"use client";
import { Play, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayProgress } from "@/context/CollarLiveContext";

/** Always says it is a recording: the committee must never mistake the replay for the live Pi. */
export default function ReplayBanner({ replay, onStop }: { replay: ReplayProgress | null; onStop: () => void }) {
  const { t } = useLanguage();
  const known = replay && replay.total > 0;
  return (
    <>
      <div className="glass-panel absolute inset-x-3 top-3 z-[800] rounded-[14px] border px-3.5 py-2.5 sm:left-4 sm:right-auto sm:w-[380px]">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          <Play className="h-3.5 w-3.5 text-amber-strong" aria-hidden="true" />
          {t("appPages.collar.replay.title")}
          <span className="ml-auto rounded-md bg-amber-soft px-1.5 py-0.5 text-[9.5px] font-bold tracking-[0.08em] text-amber-strong">DEMO</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-ink-soft">
          {t("appPages.collar.replay.note")}
          {known && <> · {t("appPages.collar.replay.progress", { done: replay.idx, total: replay.total })}</>}
        </p>
        <div
          role="progressbar"
          aria-label={t("appPages.collar.replay.title")}
          aria-valuemin={0}
          aria-valuemax={known ? replay.total : 0}
          aria-valuenow={known ? replay.idx : 0}
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: known ? `${(replay.idx / replay.total) * 100}%` : "0%" }} />
        </div>
      </div>
      <button type="button" onClick={onStop}
        className="glass-panel absolute bottom-3 right-3 z-[800] flex h-10 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-semibold text-ink">
        <Square className="h-3.5 w-3.5" aria-hidden="true" />
        {t("appPages.collar.stop")}
      </button>
    </>
  );
}
```

Create `src/components/collar/CollarHero.tsx`:

```tsx
"use client";
import { Clock, Play, WifiOff } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayError, ReplayProgress } from "@/context/CollarLiveContext";
import { formatClock, routeStats } from "@/lib/collar/stats";
import type { CollarDevice, CollarPosition, CollarState } from "@/lib/collar/types";
import { cn, timeAgo } from "@/lib/utils";
import LazyCollarMap from "./LazyCollarMap";
import ReplayBanner from "./ReplayBanner";
import StateCard from "./StateCard";
import StatusCard from "./StatusCard";
import LiveDot from "./LiveDot";
import { usePlaceName } from "./usePlaceName";

const VILNIUS = { lat: 54.6872, lng: 25.2797 };

interface HeroProps {
  state: CollarState;
  device: CollarDevice;
  latest: CollarPosition | null;
  trail: CollarPosition[];
  fitKey: string;
  now: number;
  replay: ReplayProgress | null;
  replayError: ReplayError | null;
  onPlay: () => void;
  onStop: () => void;
}

function PlayButton({ onPlay, label }: { onPlay: () => void; label: string }) {
  return (
    <button type="button" onClick={onPlay}
      className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-strong">
      <Play className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

/** The live map with whatever floats on it for the collar's current state (spec "Status rule"). */
export default function CollarHero({ state, device, latest, trail, fitKey, now, replay, replayError, onPlay, onStop }: HeroProps) {
  const { t, locale } = useLanguage();
  const place = usePlaceName(state === "live" ? latest : null);
  const center = latest ?? VILNIUS;
  const muted = state === "searching" || state === "waiting";
  const today = state === "live" ? routeStats(trail) : null;
  const minutesSilent = device.last_seen_at ? Math.max(1, Math.floor((now - Date.parse(device.last_seen_at)) / 60_000)) : 0;
  const sats = device.gps_satellites ?? 0;

  return (
    <>
      <div className="relative h-[330px] overflow-hidden rounded-[20px] shadow-[var(--shadow-md)] sm:h-[420px] lg:h-[486px]">
        <div className={cn("h-full w-full", muted && "grayscale-[60%] opacity-80")}>
          <LazyCollarMap
            lat={center.lat}
            lng={center.lng}
            path={trail.slice(0, -1)}
            showMarker={!!latest && state !== "waiting"}
            stale={state === "offline" || state === "demo_idle"}
            fitKey={fitKey}
            controls={{ zoomIn: t("appPages.collar.zoomIn"), zoomOut: t("appPages.collar.zoomOut"), locate: t("appPages.collar.locate") }}
          />
        </div>

        {state === "live" && latest && <StatusCard device={device} latest={latest} place={place} />}
        {state === "live" && latest && (
          <div className="glass-panel absolute bottom-3 left-3 z-[800] flex items-center gap-2 rounded-xl border px-3 py-2 text-[12.5px] font-medium sm:hidden">
            <LiveDot />
            {t("appPages.collar.updatedAgo", { ago: timeAgo(latest.recorded_at, t, "appPages.collar.ago") })}
            {place ? ` · ${place}` : ""}
          </div>
        )}
        {state === "live" && today && (
          <div className="glass-panel absolute bottom-4 left-4 z-[800] hidden items-center gap-3.5 rounded-xl border px-3.5 py-2 text-[13px] sm:flex">
            <span>{t("appPages.collar.today")}</span>
            <b>{t("appPages.collar.todaySummary", { km: today.distanceKm.toFixed(1), min: Math.round(today.durationMin) })}</b>
          </div>
        )}

        {state === "replaying" && <ReplayBanner replay={replay} onStop={onStop} />}

        {replayError ? (
          <StateCard title={t(replayError === "no_recording" ? "appPages.collar.replay.noRecording" : "appPages.collar.replay.stopped")}>
            {replayError === "stopped" && (
              <button type="button" onClick={onPlay} className="mt-3 inline-flex h-10 items-center rounded-xl border border-ink/10 bg-surface px-4 text-[13px] font-semibold text-ink">
                {t("appPages.collar.replay.tryAgain")}
              </button>
            )}
          </StateCard>
        ) : state === "searching" ? (
          <StateCard icon={<LiveDot className="[&>span]:bg-slate" />} title={t("appPages.collar.searching.title")}>
            <div className="mt-2 flex items-center gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 w-5 rounded-full", i < sats ? "bg-brand" : "bg-surface-2")} />
              ))}
              <span className="ml-1.5 text-[11.5px] text-ink-soft">{t("appPages.collar.searching.count", { count: sats })}</span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.searching.text")}</p>
            <PlayButton onPlay={onPlay} label={t("appPages.collar.play")} />
          </StateCard>
        ) : state === "waiting" ? (
          <StateCard icon={<Clock className="h-4 w-4 text-ink-soft" aria-hidden="true" />} title={t("appPages.collar.waiting.title")}>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.waiting.text")}</p>
            <PlayButton onPlay={onPlay} label={t("appPages.collar.play")} />
          </StateCard>
        ) : state === "offline" ? (
          <StateCard icon={<WifiOff className="h-4 w-4 text-ink-soft" aria-hidden="true" />} title={t("appPages.collar.offline.title", { minutes: minutesSilent })}>
            <p className="mt-1 text-[12px] font-medium text-ink">
              {t("appPages.collar.offline.lastSeen", { time: device.last_seen_at ? formatClock(device.last_seen_at, locale) : "–" })}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.offline.text")}</p>
            <PlayButton onPlay={onPlay} label={t("appPages.collar.play")} />
          </StateCard>
        ) : state === "demo_idle" ? (
          <StateCard title={t("appPages.collar.demoIdle.title")}>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{t("appPages.collar.demoIdle.text")}</p>
            <PlayButton onPlay={onPlay} label={t("appPages.collar.play")} />
          </StateCard>
        ) : null}
      </div>

      {state === "live" && latest && (
        <div className="mt-2.5 grid grid-cols-3 gap-2 sm:hidden">
          <div className="glass-card rounded-2xl border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.speed")}</p>
            <b className="text-lg font-semibold">{latest.speed_kmh == null ? "–" : latest.speed_kmh.toFixed(1)}</b>
          </div>
          <div className="glass-card rounded-2xl border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.today")}</p>
            <b className="text-lg font-semibold">{today ? today.distanceKm.toFixed(1) : "0.0"}</b>
          </div>
          <div className="glass-card rounded-2xl border px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.satellites")}</p>
            <b className="text-lg font-semibold">{device.gps_satellites ?? "–"}</b>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: Run the test to see it pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/CollarHero.test.tsx && npm run typecheck`
Expected: PASS (8 tests); tsc 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/CollarMap.tsx src/components/collar/LazyCollarMap.tsx src/components/collar/usePlaceName.ts src/components/collar/StatusCard.tsx src/components/collar/StateCard.tsx src/components/collar/ReplayBanner.tsx src/components/collar/CollarHero.tsx src/components/collar/__tests__/CollarHero.test.tsx && git commit -F - <<'EOF'
Add the collar page's live map with a card for every state

Live shows speed, activity, place and satellites in glass on the map;
searching, waiting and offline say why and offer the recorded walk,
which plays with a DEMO banner and progress. The marker now glides,
greys out when stale, and the map credits OpenStreetMap.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 11: The last 7 days and the route trail

**Files:**
- Create: `src/components/collar/useCollarTrail.ts`, `src/components/collar/WeekCard.tsx`
- Test: `src/components/collar/__tests__/useCollarTrail.test.tsx`, `src/components/collar/__tests__/WeekCard.test.tsx`

**Interfaces:**
- Consumes: Task 6 `loadPositions`; Task 3 `lastSevenDates`, `dayBounds`, `todayInputValue`, `summarizeWeek`, `weekdayShort`.
- Produces: `useCollarTrail(deviceId: string | null, latest: CollarPosition | null, day: string | null) → CollarPosition[]`; `<WeekCard deviceId selectedDay onSelectDay />` (`onSelectDay(null)` means today).

- [ ] **Step 1: Write the failing tests**

Create `src/components/collar/__tests__/useCollarTrail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCollarTrail } from "@/components/collar/useCollarTrail";
import type { CollarPosition } from "@/lib/collar/types";

const h = vi.hoisted(() => ({ loadPositions: vi.fn() }));
vi.mock("@/lib/collar/api", () => ({ loadPositions: (...a: unknown[]) => h.loadPositions(...a) }));

const p = (s: number, source: "collar" | "replay" = "collar"): CollarPosition => ({
  device_id: "c1", lat: 54.68 + s / 1000, lng: 25.23, speed_kmh: 4, recorded_at: new Date(Date.UTC(2026, 8, 26, 10, 0, s)).toISOString(), source,
});

beforeEach(() => {
  h.loadPositions.mockReset().mockResolvedValue([p(0), p(15)]);
});

describe("useCollarTrail", () => {
  it("loads today's real positions for the collar", async () => {
    const { result } = renderHook(() => useCollarTrail("c1", null, null));
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(h.loadPositions.mock.calls[0][3]).toBe("collar");
  });

  it("appends each new live position", async () => {
    const { result, rerender } = renderHook(({ latest }) => useCollarTrail("c1", latest, null), { initialProps: { latest: null as CollarPosition | null } });
    await waitFor(() => expect(result.current).toHaveLength(2));
    rerender({ latest: p(30) });
    expect(result.current).toHaveLength(3);
  });

  it("starts a fresh trail when a replay begins", async () => {
    const { result, rerender } = renderHook(({ latest }) => useCollarTrail("c1", latest, null), { initialProps: { latest: null as CollarPosition | null } });
    await waitFor(() => expect(result.current).toHaveLength(2));
    rerender({ latest: p(40, "replay") });
    expect(result.current.map((x) => x.source)).toEqual(["replay"]);
    rerender({ latest: p(42, "replay") });
    expect(result.current).toHaveLength(2);
  });

  it("shows a picked day's route and ignores live positions meanwhile", async () => {
    const { result, rerender } = renderHook(({ latest, day }) => useCollarTrail("c1", latest, day), {
      initialProps: { latest: null as CollarPosition | null, day: "2026-09-24" as string | null },
    });
    await waitFor(() => expect(result.current).toHaveLength(2));
    expect(h.loadPositions.mock.calls[0][1]).toBe("2026-09-23T21:00:00.000Z");
    rerender({ latest: p(50), day: "2026-09-24" });
    expect(result.current).toHaveLength(2);
  });
});
```

Create `src/components/collar/__tests__/WeekCard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WeekCard from "@/components/collar/WeekCard";

const h = vi.hoisted(() => ({ loadPositions: vi.fn() }));
vi.mock("@/lib/collar/api", () => ({ loadPositions: (...a: unknown[]) => h.loadPositions(...a) }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-26T12:00:00+03:00"));
  // The local day 2026-09-24 starts at 2026-09-23T21:00Z (Vilnius is UTC+3 in September).
  h.loadPositions.mockReset().mockImplementation(async (_id: string, from: string) =>
    from.startsWith("2026-09-23T21")
      ? [
          { device_id: "c1", lat: 54.68, lng: 25.28, speed_kmh: 4, recorded_at: "2026-09-25T10:00:00Z", source: "collar" },
          { device_id: "c1", lat: 54.69, lng: 25.28, speed_kmh: 5, recorded_at: "2026-09-25T10:15:00Z", source: "collar" },
        ]
      : [],
  );
});

afterEach(() => vi.useRealTimers());

describe("WeekCard", () => {
  it("adds up the last seven days of real positions and draws a bar per day", async () => {
    render(<WeekCard deviceId="c1" selectedDay={null} onSelectDay={() => {}} />);
    expect(await screen.findByText("1.1")).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: false }).length + screen.getAllByRole("button", { pressed: true }).length).toBe(7);
    for (const call of h.loadPositions.mock.calls) expect(call[3]).toBe("collar");
  });

  it("picks a day, and today again", async () => {
    const onSelectDay = vi.fn();
    render(<WeekCard deviceId="c1" selectedDay={null} onSelectDay={onSelectDay} />);
    await screen.findByText("1.1");
    const bars = screen.getAllByRole("button");
    fireEvent.click(bars[4]);
    expect(onSelectDay).toHaveBeenCalledWith("2026-09-24");
    fireEvent.click(bars[6]);
    expect(onSelectDay).toHaveBeenLastCalledWith(null);
  });

  it("says so when there were no walks", async () => {
    h.loadPositions.mockResolvedValue([]);
    render(<WeekCard deviceId="c1" selectedDay={null} onSelectDay={() => {}} />);
    // Once for the week, once for the activity card.
    expect(await screen.findAllByText("appPages.collar.week.empty")).toHaveLength(2);
  });
});
```

(The seven days ending 2026-09-26 are 09-20 … 09-26, so bar index 4 is 2026-09-24.)

- [ ] **Step 2: Run them to see them fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/useCollarTrail.test.tsx src/components/collar/__tests__/WeekCard.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the modules**

Create `src/components/collar/useCollarTrail.ts`:

```ts
"use client";
import { useEffect, useRef, useState } from "react";
import { loadPositions } from "@/lib/collar/api";
import { dayBounds, todayInputValue } from "@/lib/collar/stats";
import type { CollarPosition } from "@/lib/collar/types";

type Mode = "today" | "day" | "replay";

function append(list: CollarPosition[], position: CollarPosition): CollarPosition[] {
  const last = list[list.length - 1];
  if (last && last.recorded_at === position.recorded_at && last.lat === position.lat && last.lng === position.lng) return list;
  return [...list, position];
}

/**
 * The route drawn on the map: today's real positions growing as new ones arrive; a replay's
 * points from its first one; or a picked day's route (live points do not touch it).
 */
export function useCollarTrail(deviceId: string | null, latest: CollarPosition | null, day: string | null): CollarPosition[] {
  const [trail, setTrail] = useState<CollarPosition[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const modeRef = useRef<Mode>("today");

  useEffect(() => {
    if (!deviceId) {
      setTrail([]);
      return;
    }
    let active = true;
    modeRef.current = day ? "day" : "today";
    const { from, to } = dayBounds(day ?? todayInputValue());
    loadPositions(deviceId, from, to, "collar")
      .then((rows) => {
        if (active) setTrail(rows);
      })
      .catch(() => {
        if (active) setTrail([]);
      });
    return () => {
      active = false;
    };
  }, [deviceId, day, reloadKey]);

  useEffect(() => {
    if (!latest || day || latest.device_id !== deviceId) return;
    if (latest.source === "replay") {
      const fresh = modeRef.current !== "replay";
      modeRef.current = "replay";
      setTrail((prev) => append(fresh ? [] : prev, latest));
      return;
    }
    if (modeRef.current === "replay") {
      // Live again after a replay: bring back today's real route.
      modeRef.current = "today";
      setReloadKey((k) => k + 1);
      return;
    }
    setTrail((prev) => append(prev, latest));
  }, [latest, deviceId, day]);

  return trail;
}
```

Create `src/components/collar/WeekCard.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { loadPositions } from "@/lib/collar/api";
import { dayBounds, lastSevenDates, summarizeWeek, todayInputValue, weekdayShort, type WeekSummary } from "@/lib/collar/stats";
import { cn } from "@/lib/utils";

/**
 * The last seven days of real positions (never replays). One request per day, as before: a week
 * of pings from an active collar can pass 20k rows, which one range query would silently truncate.
 */
export default function WeekCard({
  deviceId, selectedDay, onSelectDay,
}: {
  deviceId: string;
  selectedDay: string | null;
  onSelectDay: (day: string | null) => void;
}) {
  const { t, locale } = useLanguage();
  const [summary, setSummary] = useState<WeekSummary | null>(null);
  const today = todayInputValue();

  useEffect(() => {
    let active = true;
    Promise.all(
      lastSevenDates().map(async (date) => {
        const { from, to } = dayBounds(date);
        return { date, points: await loadPositions(deviceId, from, to, "collar") };
      }),
    )
      .then((days) => {
        if (active) setSummary(summarizeWeek(days));
      })
      .catch(() => {
        if (active) setSummary(summarizeWeek([]));
      });
    return () => {
      active = false;
    };
  }, [deviceId]);

  const max = Math.max(0.1, ...(summary?.days.map((d) => d.distanceKm) ?? [0]));
  const shown = selectedDay ?? today;
  const mix = summary?.activity;

  return (
    <div className="mt-3.5 grid gap-3.5 sm:grid-cols-[2fr_1fr]">
      <section className="glass-card rounded-2xl border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.week.title")}</h2>
          {selectedDay ? (
            <button type="button" onClick={() => onSelectDay(null)} className="text-xs font-semibold text-brand">
              {t("appPages.collar.week.backToToday")}
            </button>
          ) : (
            <span className="text-xs text-ink-soft">{t("appPages.collar.week.hint")}</span>
          )}
        </div>
        {summary && summary.totalDistanceKm > 0 ? (
          <div className="mt-2 flex items-end gap-5">
            <div className="font-display text-3xl font-semibold leading-none tracking-tight">
              {summary.totalDistanceKm.toFixed(1)}
              <small className="ml-1 text-sm font-medium tracking-normal text-ink-soft">km</small>
            </div>
            <div className="grid h-16 flex-1 grid-cols-7 items-end gap-2">
              {summary.days.map((day) => {
                const active = day.date === shown;
                return (
                  <button
                    key={day.date}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${weekdayShort(day.date, locale)} ${day.distanceKm.toFixed(1)} km`}
                    onClick={() => onSelectDay(day.date === today ? null : day.date)}
                    className="flex h-full flex-col items-center justify-end gap-1"
                  >
                    <span
                      className={cn("w-full max-w-[30px] rounded-b-sm rounded-t-md", active ? "bg-brand" : "bg-slate-soft")}
                      style={{ height: `${Math.max(8, (day.distanceKm / max) * 100)}%` }}
                    />
                    <span className={cn("text-[10.5px] leading-none", active ? "font-bold text-brand" : "text-ink-soft")}>
                      {weekdayShort(day.date, locale).slice(0, 2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : summary ? (
          <p className="mt-3 text-sm text-ink-soft">{t("appPages.collar.week.empty")}</p>
        ) : null}
      </section>

      <section className="glass-card rounded-2xl border p-4">
        <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.week.activity")}</h2>
        {mix ? (
          <>
            <div className="mt-3.5 flex h-2 overflow-hidden rounded-full bg-surface-2">
              <i className="block h-full bg-[#c9d6db]" style={{ width: `${mix.restingPct}%` }} />
              <i className="block h-full bg-[#9cc4b0]" style={{ width: `${mix.walkingPct}%` }} />
              <i className="block h-full bg-[#e9c07e]" style={{ width: `${mix.runningPct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-[11.5px] text-ink-soft">
              <span>{t("appPages.collar.activity.resting")} <b className="font-semibold text-ink">{mix.restingPct}%</b></span>
              <span>{t("appPages.collar.activity.walking")} <b className="font-semibold text-ink">{mix.walkingPct}%</b></span>
              <span>{t("appPages.collar.activity.running")} <b className="font-semibold text-ink">{mix.runningPct}%</b></span>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">{t("appPages.collar.week.empty")}</p>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/useCollarTrail.test.tsx src/components/collar/__tests__/WeekCard.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/collar/useCollarTrail.ts src/components/collar/WeekCard.tsx src/components/collar/__tests__/useCollarTrail.test.tsx src/components/collar/__tests__/WeekCard.test.tsx && git commit -F - <<'EOF'
Show the collar's last seven days and draw a picked day's route

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 12: The `/collar` page — header, collar chips, empty state, rename and remove

**Files:**
- Create: `src/components/collar/CollarArt.tsx`, `src/components/collar/CollarEmpty.tsx`, `src/components/collar/CollarDialogs.tsx`, `src/components/collar/CollarHeader.tsx`, `src/components/collar/CollarPage.tsx`, `src/app/(app)/collar/page.tsx`
- Test: `src/components/collar/__tests__/CollarPage.test.tsx`

**Interfaces:**
- Consumes: Task 8 `useCollarLive`; Tasks 10–11 components; Task 2 `pairedAt`; Task 3 `formatDayMonth`; Task 9 `collarName`; Task 13's `PairingWizard` (default export, prop `onClose`) — Task 12 renders it, so create the Task 13 file as a stub first (Step 3).
- Produces: `<CollarPage />` at route `/collar`; `<CollarArt className? />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/collar/__tests__/CollarPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import CollarPage from "@/components/collar/CollarPage";
import { EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({ live: null as unknown as CollarLiveValue }));

vi.mock("@/context/CollarLiveContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/CollarLiveContext")>();
  return { ...actual, useCollarLive: () => h.live };
});
vi.mock("@/components/collar/CollarHero", () => ({ default: (p: { state: string }) => <div data-testid="hero">{p.state}</div> }));
vi.mock("@/components/collar/WeekCard", () => ({ default: () => <div data-testid="week" /> }));
vi.mock("@/components/collar/useCollarTrail", () => ({ useCollarTrail: () => [] }));
vi.mock("@/components/collar/PairingWizard", () => ({
  default: ({ onClose }: { onClose: () => void }) => <div data-testid="wizard"><button onClick={onClose}>close-wizard</button></div>,
}));

const reksas: CollarDevice = {
  id: "c1", label: "Reksas", is_demo: false, claimed_at: "2026-09-24T10:00:00Z", created_at: "2026-09-24T10:00:00Z",
  last_seen_at: "2026-09-26T11:59:58Z", gps_locked: true, gps_satellites: 7,
};

function live(over: Partial<CollarLiveValue> = {}): CollarLiveValue {
  return {
    ...EMPTY_COLLAR_LIVE,
    collars: [reksas],
    selected: reksas,
    state: "live",
    select: vi.fn(),
    startReplay: vi.fn(async () => {}),
    stopReplay: vi.fn(),
    rename: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    ...over,
  };
}

beforeEach(() => {
  h.live = live();
});

describe("CollarPage", () => {
  it("shows a spinner while the collars load", () => {
    h.live = live({ loading: true });
    render(<CollarPage />);
    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("offers pairing and the recorded walk when there is no collar", () => {
    h.live = live({ collars: [], selected: null, state: "no_collar" });
    render(<CollarPage />);
    expect(screen.getByRole("heading", { level: 1, name: "appPages.collar.empty.title" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.empty.pair" }));
    expect(screen.getByTestId("wizard")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(h.live.startReplay).toHaveBeenCalled();
  });

  it("names the collar, shows its state and the week", () => {
    render(<CollarPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Reksas" })).toBeTruthy();
    expect(screen.getByText("appPages.collar.states.live")).toBeTruthy();
    expect(screen.getByTestId("hero").textContent).toBe("live");
    expect(screen.getByTestId("week")).toBeTruthy();
  });

  it("plays the recorded walk, and stops it", () => {
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: /appPages\.collar\.play/ }));
    expect(h.live.startReplay).toHaveBeenCalled();
    h.live = live({ state: "replaying", replay: { deviceId: "c1", idx: 3, total: 64 } });
    render(<CollarPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /appPages\.collar\.stop/ })[0]);
    expect(h.live.stopReplay).toHaveBeenCalled();
  });

  it("names a demo collar in the page language and hides the week", () => {
    const demo = { ...reksas, id: "d1", is_demo: true, label: "Recorded walk" };
    h.live = live({ collars: [demo], selected: demo, state: "demo_idle" });
    render(<CollarPage />);
    expect(screen.getByRole("heading", { level: 1, name: "appPages.collar.demoName" })).toBeTruthy();
    expect(screen.queryByTestId("week")).toBeNull();
  });

  it("switches between collars with chips", () => {
    const second = { ...reksas, id: "c2", label: "Mica" };
    h.live = live({ collars: [reksas, second] });
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: "Mica" }));
    expect(h.live.select).toHaveBeenCalledWith("c2");
  });

  it("renames the collar from the menu", () => {
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "appPages.collar.rename" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("appPages.collar.nameLabel"), { target: { value: "Bobis" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "appPages.collar.save" }));
    expect(h.live.rename).toHaveBeenCalledWith("c1", "Bobis");
  });

  it("removes the collar after confirming", () => {
    render(<CollarPage />);
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.more" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "appPages.collar.remove" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "appPages.collar.remove" }));
    expect(h.live.remove).toHaveBeenCalledWith("c1");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/CollarPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: A stub for the wizard (replaced in Task 13)**

Create `src/components/collar/PairingWizard.tsx`:

```tsx
"use client";
/** Replaced in the next task; exists so the page compiles. */
export default function PairingWizard({ onClose }: { onClose: () => void }) {
  return <button type="button" onClick={onClose}>close</button>;
}
```

- [ ] **Step 4: Write the page pieces**

Create `src/components/collar/CollarArt.tsx`:

```tsx
/** The collar as drawn in the approved mockups: a pine strap and the Pi's case with a blinking light. */
export default function CollarArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 104" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="collar-art-case" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2d3833" />
          <stop offset="1" stopColor="#151b18" />
        </linearGradient>
      </defs>
      <rect x="10" y="40" width="280" height="30" rx="15" fill="#1f5c47" />
      <path d="M26 47.5H274M26 62.5H274" stroke="#3b8467" strokeWidth="1.4" strokeDasharray="5 4" />
      <rect x="26" y="35" width="26" height="40" rx="7" fill="none" stroke="#b9c3bd" strokeWidth="4" />
      <circle cx="258" cy="55" r="3.4" fill="#153f2f" />
      <circle cx="240" cy="55" r="3.4" fill="#153f2f" />
      <circle cx="222" cy="55" r="3.4" fill="#153f2f" />
      <rect x="100" y="18" width="104" height="72" rx="18" fill="url(#collar-art-case)" />
      <rect x="100.5" y="18.5" width="103" height="71" rx="17.5" fill="none" stroke="#3a4741" />
      <g transform="translate(137 33) scale(0.25)">
        <rect x="6" y="6" width="108" height="108" rx="26" fill="#131a17" />
        <circle cx="54" cy="44" r="19" fill="#1f5c47" />
        <circle cx="54" cy="77" r="21" fill="#1f5c47" />
        <rect x="32" y="27" width="16" height="66" rx="5" fill="#153f2f" />
        <circle cx="48" cy="60" r="6" fill="#dc9a35" />
      </g>
      <circle cx="186" cy="31" r="3.4" fill="#3fd18a" className="animate-pulse" />
      <text x="152" y="80" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="7.5" fontWeight="700" letterSpacing="1.6" fill="#8fa39a">
        GPS · WIFI · BLE
      </text>
    </svg>
  );
}
```

Create `src/components/collar/CollarEmpty.tsx`:

```tsx
"use client";
import { Play } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import type { ReplayError } from "@/context/CollarLiveContext";
import CollarArt from "./CollarArt";

/** The page before anything is paired: pair the real collar, or watch a recorded walk. */
export default function CollarEmpty({ onPair, onPlay, replayError }: { onPair: () => void; onPlay: () => void; replayError: ReplayError | null }) {
  const { t } = useLanguage();
  return (
    <section className="glass-card mx-auto mt-4 max-w-md rounded-2xl border p-6 text-center sm:mt-10 sm:p-8">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.pageLabel")}</p>
      <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-ink">{t("appPages.collar.empty.title")}</h1>
      <CollarArt className="mx-auto my-4 h-[104px] w-full max-w-[300px] rounded-2xl bg-gradient-to-br from-brand-softer to-white" />
      <p className="mx-auto max-w-xs text-sm text-ink-soft">{t("appPages.collar.empty.text")}</p>
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={onPair} className="h-11 rounded-xl bg-brand text-sm font-semibold text-white hover:bg-brand-strong">
          {t("appPages.collar.empty.pair")}
        </button>
        {/* Once the database says there is no recording, offering it again would only fail again. */}
        {replayError !== "no_recording" && (
          <button type="button" onClick={onPlay} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-ink/10 bg-surface/80 text-sm font-semibold text-ink hover:bg-surface">
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.play")}
          </button>
        )}
      </div>
      {replayError && (
        <p role="alert" className="mt-3 text-sm text-amber-strong">
          {t(replayError === "no_recording" ? "appPages.collar.replay.noRecording" : "appPages.collar.replay.stopped")}
        </p>
      )}
    </section>
  );
}
```

Create `src/components/collar/CollarDialogs.tsx`:

```tsx
"use client";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useLanguage } from "@/context/LanguageContext";

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const titleId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 glass-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-[var(--shadow-lg)]">
        <h2 id={titleId} className="font-display text-lg font-semibold text-ink">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function RenameDialog({ initial, onSave, onClose }: { initial: string; onSave: (label: string) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [label, setLabel] = useState(initial);
  const inputId = useId();
  return (
    <Dialog title={t("appPages.collar.renameTitle")} onClose={onClose}>
      <label htmlFor={inputId} className="mt-4 block text-sm font-medium text-ink">{t("appPages.collar.nameLabel")}</label>
      <input id={inputId} autoFocus value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40}
        className="mt-1.5 h-11 w-full rounded-xl border border-ink/10 bg-surface px-3.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" />
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl bg-surface-2 text-sm font-medium text-ink">{t("appPages.collar.cancel")}</button>
        <button type="button" disabled={!label.trim()} onClick={() => onSave(label.trim())} className="h-11 flex-1 rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50">
          {t("appPages.collar.save")}
        </button>
      </div>
    </Dialog>
  );
}

export function RemoveDialog({ name, onRemove, onClose }: { name: string; onRemove: () => void; onClose: () => void }) {
  const { t } = useLanguage();
  return (
    <Dialog title={t("appPages.collar.removeTitle", { name })} onClose={onClose}>
      <p className="mt-2 text-sm text-ink-soft">{t("appPages.collar.removeText")}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl bg-surface-2 text-sm font-medium text-ink">{t("appPages.collar.cancel")}</button>
        <button type="button" onClick={onRemove} className="h-11 flex-1 rounded-xl bg-danger text-sm font-semibold text-white">{t("appPages.collar.remove")}</button>
      </div>
    </Dialog>
  );
}
```

Create `src/components/collar/CollarHeader.tsx`:

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { Ellipsis, Play, Square } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatDayMonth } from "@/lib/collar/stats";
import { pairedAt } from "@/lib/collar/status";
import type { CollarDevice, CollarState } from "@/lib/collar/types";
import { cn } from "@/lib/utils";
import LiveDot from "./LiveDot";
import { collarName } from "./names";

const PILL: Record<Exclude<CollarState, "no_collar">, string> = {
  live: "bg-amber-soft text-amber-strong",
  replaying: "bg-amber-soft text-amber-strong",
  demo_idle: "bg-amber-soft text-amber-strong",
  searching: "bg-slate-soft text-slate",
  waiting: "bg-surface-2 text-ink-soft",
  offline: "bg-surface-2 text-ink-soft",
};

export default function CollarHeader({
  device, state, canPlay = true, onPlay, onStop, onRename, onRemove, onPairAnother,
}: {
  device: CollarDevice;
  state: Exclude<CollarState, "no_collar">;
  /** False once the database said there is no recording to play. */
  canPlay?: boolean;
  onPlay: () => void;
  onStop: () => void;
  onRename: () => void;
  onRemove: () => void;
  onPairAnother: () => void;
}) {
  const { t, locale } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const choose = (action: () => void) => () => {
    setMenuOpen(false);
    action();
  };

  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-soft">{t("appPages.collar.pageLabel")}</p>
        <div className="mt-0.5 flex items-center gap-3">
          <h1 className="truncate font-display text-[28px] font-semibold leading-tight tracking-tight text-ink sm:text-[34px]">{collarName(device, t)}</h1>
          <span className={cn("inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-bold tracking-[0.07em]", PILL[state])}>
            {(state === "live" || state === "replaying") && <LiveDot />}
            {t(`appPages.collar.states.${state}`)}
          </span>
        </div>
        <p className="mt-1 text-[13px] text-ink-soft">
          {device.is_demo ? t("appPages.collar.demoHardware") : t("appPages.collar.hardware", { date: formatDayMonth(pairedAt(device), locale) })}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {state === "replaying" ? (
          <button type="button" onClick={onStop} className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface/85 px-4 text-sm font-semibold text-ink">
            <Square className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.stop")}
          </button>
        ) : canPlay ? (
          <button type="button" onClick={onPlay} className="inline-flex h-10 items-center gap-2 rounded-xl border border-ink/10 bg-surface/85 px-4 text-sm font-semibold text-ink">
            <Play className="h-4 w-4" aria-hidden="true" />
            {t("appPages.collar.play")}
          </button>
        ) : null}
        <div ref={menuRef} className="relative">
          <button type="button" aria-label={t("appPages.collar.more")} aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-surface/85 text-ink">
            <Ellipsis className="h-4 w-4" aria-hidden="true" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-11 z-20 w-56 rounded-xl border border-ink/8 bg-surface p-1 shadow-[var(--shadow-lg)]">
              {!device.is_demo && (
                <button type="button" role="menuitem" onClick={choose(onRename)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-brand-softer">
                  {t("appPages.collar.rename")}
                </button>
              )}
              <button type="button" role="menuitem" onClick={choose(onPairAnother)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-brand-softer">
                {t("appPages.collar.pairAnother")}
              </button>
              <button type="button" role="menuitem" onClick={choose(onRemove)} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft">
                {t("appPages.collar.remove")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

Create `src/components/collar/CollarPage.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useCollarLive } from "@/context/CollarLiveContext";
import { cn } from "@/lib/utils";
import CollarEmpty from "./CollarEmpty";
import CollarHeader from "./CollarHeader";
import CollarHero from "./CollarHero";
import PairingWizard from "./PairingWizard";
import WeekCard from "./WeekCard";
import { RemoveDialog, RenameDialog } from "./CollarDialogs";
import { collarName } from "./names";
import { useCollarTrail } from "./useCollarTrail";

/** /collar (spec "Web — collar"): the live collar, how it connects, and every way it can fail. */
export default function CollarPage() {
  const { t } = useLanguage();
  const live = useCollarLive();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const selectedId = live.selected?.id ?? null;
  const trail = useCollarTrail(selectedId, live.latest, day);

  useEffect(() => {
    setDay(null);
  }, [selectedId]);

  if (live.loading) {
    return (
      <div role="status" aria-label={t("appPages.collar.loading")} className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    );
  }

  const device = live.selected;
  const wizard = wizardOpen && <PairingWizard onClose={() => setWizardOpen(false)} />;

  if (!device || live.state === "no_collar") {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
        <CollarEmpty onPair={() => setWizardOpen(true)} onPlay={() => void live.startReplay()} replayError={live.replayError} />
        {wizard}
      </div>
    );
  }

  const state = live.state;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <CollarHeader
        device={device}
        state={state}
        canPlay={live.replayError !== "no_recording"}
        onPlay={() => void live.startReplay()}
        onStop={live.stopReplay}
        onRename={() => setRenaming(true)}
        onRemove={() => setRemoving(true)}
        onPairAnother={() => setWizardOpen(true)}
      />

      {live.collars.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t("appPages.collar.collars")}>
          {live.collars.map((c) => (
            <button key={c.id} type="button" aria-pressed={c.id === device.id} onClick={() => live.select(c.id)}
              className={cn("h-9 rounded-full border px-3.5 text-sm font-medium", c.id === device.id ? "border-brand bg-brand-softer text-brand-strong" : "border-ink/10 bg-surface/80 text-ink-soft")}>
              {collarName(c, t)}
            </button>
          ))}
        </div>
      )}

      <CollarHero
        state={state}
        device={device}
        latest={day ? trail[trail.length - 1] ?? null : live.latest}
        trail={trail}
        fitKey={`${device.id}:${day ?? (state === "replaying" ? "replay" : "today")}`}
        now={live.now}
        replay={live.replay}
        replayError={live.replayError}
        onPlay={() => void live.startReplay()}
        onStop={live.stopReplay}
      />

      {!device.is_demo && <WeekCard deviceId={device.id} selectedDay={day} onSelectDay={setDay} />}

      {renaming && (
        <RenameDialog initial={device.label ?? ""} onClose={() => setRenaming(false)}
          onSave={(label) => {
            setRenaming(false);
            void live.rename(device.id, label);
          }} />
      )}
      {removing && (
        <RemoveDialog name={collarName(device, t)} onClose={() => setRemoving(false)}
          onRemove={() => {
            setRemoving(false);
            void live.remove(device.id);
          }} />
      )}
      {wizard}
    </div>
  );
}
```

Create `src/app/(app)/collar/page.tsx`:

```tsx
"use client";
import CollarPage from "@/components/collar/CollarPage";

/** The GPS collar (showcase, 2026-09-26). Everything lives in the component and the provider. */
export default function CollarRoute() {
  return <CollarPage />;
}
```

- [ ] **Step 5: Run the test and typecheck**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/CollarPage.test.tsx && npm run typecheck`
Expected: PASS (8 tests); tsc 0.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/collar/CollarArt.tsx src/components/collar/CollarEmpty.tsx src/components/collar/CollarDialogs.tsx src/components/collar/CollarHeader.tsx src/components/collar/CollarPage.tsx src/components/collar/PairingWizard.tsx "src/app/(app)/collar/page.tsx" src/components/collar/__tests__/CollarPage.test.tsx && git commit -F - <<'EOF'
Add the /collar page: header, collar switcher, empty state, rename, remove

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 13: The pairing wizard and the live check-in checklist

**Files:**
- Modify: `src/components/collar/PairingWizard.tsx` (replace the stub)
- Create: `src/components/collar/ConnectChecklist.tsx`
- Test: `src/components/collar/__tests__/PairingWizard.test.tsx`

**Interfaces:**
- Consumes: Task 8 `useCollarLive` (`pair`, `rename`, `selected`, `state`, `now`, `startReplay`); Task 6 `loadPetNames`; Task 1 pair-code helpers; Task 2 `isOnline`, `pairedAt`, `CHECKIN_TIMEOUT_MS`; Task 3 `formatClock`; Task 12 `CollarArt`.
- Produces: `<PairingWizard onClose />` (modal ≥ sm, bottom sheet below); `<ConnectChecklist onDone onPlay />`.

- [ ] **Step 1: Write the failing test**

Create `src/components/collar/__tests__/PairingWizard.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import PairingWizard from "@/components/collar/PairingWizard";
import { EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";
import type { CollarDevice } from "@/lib/collar/types";

const h = vi.hoisted(() => ({ live: null as unknown as CollarLiveValue, pets: ["Reksas", "Mica"] }));

vi.mock("@/context/CollarLiveContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/context/CollarLiveContext")>();
  return { ...actual, useCollarLive: () => h.live };
});
vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, loading: false }) }));
vi.mock("@/lib/collar/api", () => ({ loadPetNames: async () => h.pets }));

const NOW = Date.parse("2026-09-26T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const paired = (over: Partial<CollarDevice> = {}): CollarDevice => ({
  id: "c9", label: null, is_demo: false, claimed_at: ago(5_000), created_at: ago(5_000),
  last_seen_at: null, gps_locked: null, gps_satellites: null, ...over,
});

function live(over: Partial<CollarLiveValue> = {}): CollarLiveValue {
  return {
    ...EMPTY_COLLAR_LIVE,
    now: NOW,
    pair: vi.fn(async () => ({ deviceId: "c9", result: "paired" as const })),
    rename: vi.fn(async () => {}),
    startReplay: vi.fn(async () => {}),
    selected: paired(),
    state: "waiting",
    ...over,
  };
}

async function toCodeStep() {
  fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.on.next" }));
  return screen.getByLabelText("appPages.collar.wizard.code.label");
}

async function toChecklist() {
  const input = await toCodeStep();
  fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
  fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
  fireEvent.click(await screen.findByRole("button", { name: "appPages.collar.wizard.name.submit" }));
  await screen.findByText("appPages.collar.wizard.connect.paired");
}

beforeEach(() => {
  h.live = live();
  h.pets = ["Reksas", "Mica"];
});

afterEach(() => vi.useRealTimers());

describe("PairingWizard — the code", () => {
  it("cleans what is typed and pairs with the clean code", async () => {
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7k3q 9d2o" } });
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getAllByText("0").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    await waitFor(() => expect(h.live.pair).toHaveBeenCalledWith("7K3Q9D20"));
  });

  it("keeps the button off until eight characters are in", async () => {
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7K3Q" } });
    expect((screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([
    ["not_found", "appPages.collar.wizard.code.notFound"],
    ["taken", "appPages.collar.wizard.code.taken"],
  ] as const)("explains a %s code", async (result, message) => {
    h.live = live({ pair: vi.fn(async () => ({ deviceId: null, result })) });
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
  });

  it("keeps the code after a network error", async () => {
    h.live = live({ pair: vi.fn(async () => { throw new Error("Failed to fetch"); }) });
    render(<PairingWizard onClose={() => {}} />);
    const input = (await toCodeStep()) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    expect((await screen.findByRole("alert")).textContent).toBe("appPages.collar.wizard.code.network");
    expect(input.value).toBe("7K3Q-9D2M");
  });
});

describe("PairingWizard — who wears it", () => {
  it("offers the user's pets and saves the pick as the collar's name", async () => {
    render(<PairingWizard onClose={() => {}} />);
    const input = await toCodeStep();
    fireEvent.change(input, { target: { value: "7K3Q9D2M" } });
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.code.submit" }));
    fireEvent.click(await screen.findByRole("button", { name: "Mica" }));
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.name.submit" }));
    await waitFor(() => expect(h.live.rename).toHaveBeenCalledWith("c9", "Mica"));
  });
});

describe("PairingWizard — connecting", () => {
  it("ticks online as soon as the collar has checked in, and counts satellites", async () => {
    h.live = live({ selected: paired({ last_seen_at: ago(10_000), gps_satellites: 3 }), state: "searching" });
    render(<PairingWizard onClose={() => {}} />);
    await toChecklist();
    expect(screen.getByText("appPages.collar.wizard.connect.online")).toBeTruthy();
    expect(screen.getByText("appPages.collar.wizard.connect.satellitesCount")).toBeTruthy();
  });

  it("warns after 90 s without a check-in, and can keep waiting", async () => {
    h.live = live({ selected: paired({ claimed_at: ago(91_000) }) });
    render(<PairingWizard onClose={() => {}} />);
    await toChecklist();
    expect(screen.getByText("appPages.collar.wizard.connect.slowTitle")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.connect.keepWaiting" }));
    expect(screen.queryByText("appPages.collar.wizard.connect.slowTitle")).toBeNull();
  });

  it("plays the recorded walk instead, and closes", async () => {
    const onClose = vi.fn();
    render(<PairingWizard onClose={onClose} />);
    await toChecklist();
    fireEvent.click(screen.getByRole("button", { name: "appPages.collar.wizard.connect.playInstead" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(h.live.startReplay).toHaveBeenCalled();
  });

  it("closes onto the map once the first position arrives", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<PairingWizard onClose={onClose} />);
    await toChecklist();
    vi.useFakeTimers();
    h.live = live({ selected: paired({ last_seen_at: ago(1_000), gps_satellites: 7 }), state: "live" });
    rerender(<PairingWizard onClose={onClose} />);
    expect(screen.getByText("appPages.collar.wizard.connect.done")).toBeTruthy();
    act(() => vi.advanceTimersByTime(1200));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<PairingWizard onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/PairingWizard.test.tsx`
Expected: FAIL — the stub has no steps.

- [ ] **Step 3: Write `ConnectChecklist.tsx`**

```tsx
"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { useCollarLive } from "@/context/CollarLiveContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatClock } from "@/lib/collar/stats";
import { CHECKIN_TIMEOUT_MS, isOnline, pairedAt } from "@/lib/collar/status";
import { cn } from "@/lib/utils";
import { collarName } from "./names";

type ItemStatus = "done" | "active" | "warn" | "wait";

function Item({ status, title, detail, children }: { status: ItemStatus; title: string; detail?: string; children?: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 grid h-6 w-6 flex-shrink-0 place-items-center rounded-full border-2",
          status === "done" && "border-brand bg-brand text-white",
          status === "active" && "animate-spin border-brand-soft border-t-brand",
          status === "warn" && "border-amber bg-amber-soft text-amber-strong",
          status === "wait" && "border-ink/15",
        )}
      >
        {status === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
        {status === "warn" && <TriangleAlert className="h-3 w-3" strokeWidth={2.6} />}
      </span>
      <div className="min-w-0">
        <b className={cn("block text-[13.5px] leading-snug", status === "wait" ? "font-medium text-ink-soft" : "font-semibold text-ink")}>{title}</b>
        {detail && <small className="block text-xs text-ink-soft">{detail}</small>}
        {children}
      </div>
    </li>
  );
}

/**
 * Step 4 of pairing: the collar reporting in, live. It ticks itself off from the same provider
 * data the page uses, and after 90 s without a check-in it says what to check.
 */
export default function ConnectChecklist({ onDone, onPlay }: { onDone: () => void; onPlay: () => void }) {
  const { t, locale } = useLanguage();
  const { selected: device, state, now } = useCollarLive();
  const [waitFrom, setWaitFrom] = useState<number | null>(null);
  const live = state === "live";

  useEffect(() => {
    if (!live) return;
    const timer = setTimeout(onDone, 1200);
    return () => clearTimeout(timer);
  }, [live, onDone]);

  if (!device) return null;
  const online = isOnline(device, now);
  const since = now - (waitFrom ?? Date.parse(pairedAt(device)));
  const slow = !online && !live && since > CHECKIN_TIMEOUT_MS;
  const sats = device.gps_satellites ?? 0;

  return (
    <div>
      <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">
        {slow ? t("appPages.collar.wizard.connect.slowTitle") : t("appPages.collar.wizard.connect.title", { name: collarName(device, t) })}
      </h2>
      <ul className="my-3.5 space-y-2.5">
        <Item status="done" title={t("appPages.collar.wizard.connect.paired")} detail={formatClock(pairedAt(device), locale)} />
        <Item
          status={online || live ? "done" : slow ? "warn" : "active"}
          title={online || live ? t("appPages.collar.wizard.connect.online") : t("appPages.collar.wizard.connect.onlineWaiting")}
          detail={
            online && device.last_seen_at
              ? t("appPages.collar.wizard.connect.onlineDone", { time: formatClock(device.last_seen_at, locale) })
              : slow
                ? t("appPages.collar.wizard.connect.slowSeconds", { seconds: Math.floor(since / 1000) })
                : undefined
          }
        />
        <Item
          status={live ? "done" : online ? "active" : "wait"}
          title={t("appPages.collar.wizard.connect.satellites")}
          detail={online && !live ? t("appPages.collar.wizard.connect.satellitesCount", { count: sats }) : undefined}
        >
          {online && !live && (
            <div className="mt-1.5 flex gap-1" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={cn("h-1.5 w-[18px] rounded-full", i < sats ? "bg-brand" : "bg-surface-2")} />
              ))}
            </div>
          )}
        </Item>
        <Item status={live ? "done" : "wait"} title={t("appPages.collar.wizard.connect.first")} />
      </ul>

      {live ? (
        <p className="text-sm font-medium text-brand">{t("appPages.collar.wizard.connect.done")}</p>
      ) : slow ? (
        <>
          <ul className="mb-3 space-y-1.5 text-[12.5px] text-ink">
            {(["tipLight", "tipWifi", "tipBoot"] as const).map((tip) => (
              <li key={tip} className="flex gap-2 before:mt-[7px] before:h-1.5 before:w-1.5 before:flex-shrink-0 before:rounded-full before:bg-ink-soft">
                {t(`appPages.collar.wizard.connect.${tip}`)}
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button type="button" onClick={() => setWaitFrom(now)} className="h-11 flex-1 rounded-xl border border-ink/10 bg-surface text-[13px] font-semibold text-ink">
              {t("appPages.collar.wizard.connect.keepWaiting")}
            </button>
            <button type="button" onClick={onPlay} className="h-11 flex-1 rounded-xl bg-brand text-[13px] font-semibold text-white">
              {t("appPages.collar.wizard.connect.recordedWalk")}
            </button>
          </div>
        </>
      ) : (
        <p className="border-t border-ink/8 pt-3 text-xs leading-relaxed text-ink-soft">
          {t("appPages.collar.wizard.connect.indoors")}{" "}
          <button type="button" onClick={onPlay} className="font-semibold text-brand">
            {t("appPages.collar.wizard.connect.playInstead")}
          </button>
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Replace `PairingWizard.tsx`**

```tsx
"use client";
import { Fragment, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCollarLive } from "@/context/CollarLiveContext";
import { useLanguage } from "@/context/LanguageContext";
import { loadPetNames } from "@/lib/collar/api";
import { cleanPairCode, formatPairCode, isPairCode, PAIR_CODE_LENGTH } from "@/lib/collar/pairCode";
import { cn } from "@/lib/utils";
import CollarArt from "./CollarArt";
import ConnectChecklist from "./ConnectChecklist";

type Step = 1 | 2 | 3 | 4;
type CodeError = "notFound" | "taken" | "network" | null;

/**
 * Pairing, as approved (2026-09-26): switch it on → the sticker code → who wears it → watch it
 * check in. A dialog on desktop, a sheet from the bottom on phones.
 */
export default function PairingWizard({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const live = useCollarLive();
  const [step, setStep] = useState<Step>(1);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<CodeError>(null);
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [pets, setPets] = useState<string[]>([]);
  const [name, setName] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (step !== 3 || !user) return;
    let active = true;
    loadPetNames(user.id)
      .then((names) => {
        if (!active) return;
        setPets(names);
        setName((current) => current || names[0] || "");
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [step, user]);

  const submitCode = async () => {
    if (!isPairCode(code) || busy) return;
    setBusy(true);
    setCodeError(null);
    try {
      const result = await live.pair(code);
      if (result.result === "not_found") setCodeError("notFound");
      else if (result.result === "taken") setCodeError("taken");
      else {
        setDeviceId(result.deviceId);
        setStep(3);
      }
    } catch {
      setCodeError("network");
    } finally {
      setBusy(false);
    }
  };

  const submitName = async () => {
    setBusy(true);
    try {
      if (deviceId && name.trim()) await live.rename(deviceId, name.trim());
    } catch {
      // The name can be changed later from the menu; never block tracking on it.
    } finally {
      setBusy(false);
      setStep(4);
    }
  };

  const playInstead = async () => {
    await live.startReplay();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 glass-scrim" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={t("appPages.collar.empty.pair")}
        className="relative w-full rounded-t-3xl bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 shadow-[var(--shadow-lg)] sm:max-w-sm sm:rounded-2xl sm:p-6">
        <span className="mx-auto mb-3 block h-1.5 w-10 rounded-full bg-ink/15 sm:hidden" aria-hidden="true" />
        <button type="button" onClick={onClose} aria-label={t("appPages.collar.wizard.close")}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ink-soft hover:text-ink">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="mb-3.5 flex items-center gap-2.5 pr-8">
          <span className="whitespace-nowrap text-[11px] font-semibold text-ink-soft">{t("appPages.collar.wizard.step", { step })}</span>
          <div className="flex flex-1 gap-1" aria-hidden="true">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={cn("h-1 flex-1 rounded-full", i <= step ? "bg-brand" : "bg-surface-2")} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{t("appPages.collar.wizard.on.title")}</h2>
            <CollarArt className="my-3 h-[104px] w-full rounded-2xl bg-gradient-to-br from-brand-softer to-white" />
            <p className="text-[13px] text-ink-soft">{t("appPages.collar.wizard.on.text")}</p>
            <button type="button" onClick={() => setStep(2)} className="mt-4 h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white">
              {t("appPages.collar.wizard.on.next")}
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{t("appPages.collar.wizard.code.title")}</h2>
            <p className="mt-1 text-[13px] text-ink-soft">{t("appPages.collar.wizard.code.text")}</p>
            <label className="relative mt-4 block cursor-text">
              <span className="sr-only">{t("appPages.collar.wizard.code.label")}</span>
              <input
                value={formatPairCode(code)}
                onChange={(e) => {
                  setCode(cleanPairCode(e.target.value).slice(0, PAIR_CODE_LENGTH));
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitCode();
                }}
                autoFocus
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={PAIR_CODE_LENGTH + 1}
                aria-invalid={codeError ? true : undefined}
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
              <span aria-hidden="true" className="flex items-center justify-between gap-1">
                {Array.from({ length: PAIR_CODE_LENGTH }, (_, i) => (
                  <Fragment key={i}>
                    {i === 4 && <span className="h-0.5 w-2 flex-shrink-0 rounded bg-ink-soft" />}
                    <span
                      className={cn(
                        "grid h-11 w-8 place-items-center rounded-[9px] border-[1.5px] bg-white font-mono text-lg font-bold",
                        codeError && codeError !== "network"
                          ? "border-danger bg-danger-soft text-danger"
                          : i === code.length
                            ? "border-brand ring-[3px] ring-brand/15"
                            : "border-ink/15",
                      )}
                    >
                      {code[i] ?? ""}
                    </span>
                  </Fragment>
                ))}
              </span>
            </label>
            <p className="mb-3 mt-1.5 text-[11.5px] text-ink-soft">{t("appPages.collar.wizard.code.hint")}</p>
            {codeError && (
              <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2.5 text-[12.5px] leading-snug text-[#8e2f27]">
                {t(`appPages.collar.wizard.code.${codeError}`)}
              </p>
            )}
            <button type="button" onClick={() => void submitCode()} disabled={!isPairCode(code) || busy}
              className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50">
              {t("appPages.collar.wizard.code.submit")}
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-display text-[19px] font-semibold leading-tight text-ink">{t("appPages.collar.wizard.name.title")}</h2>
            <p className="mt-1 text-[13px] text-ink-soft">{t("appPages.collar.wizard.name.text")}</p>
            {pets.length > 0 && (
              <div className="my-3.5 flex flex-wrap gap-2">
                {pets.map((pet) => (
                  <button key={pet} type="button" aria-pressed={name === pet} onClick={() => setName(pet)}
                    className={cn("flex h-9 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-[13px] font-semibold", name === pet ? "border-brand bg-brand-softer text-brand-strong" : "border-ink/12 text-ink")}>
                    {pet}
                    {name === pet && <Check className="h-3.5 w-3.5" strokeWidth={2.6} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            )}
            <label className="mt-3 block text-xs font-semibold text-ink" htmlFor="collar-name">{t("appPages.collar.wizard.name.label")}</label>
            <input id="collar-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40}
              className="mb-4 mt-1.5 h-11 w-full rounded-xl border border-ink/12 px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand" />
            <button type="button" onClick={() => void submitName()} disabled={busy}
              className="h-11 w-full rounded-xl bg-brand text-sm font-semibold text-white disabled:opacity-50">
              {t("appPages.collar.wizard.name.submit")}
            </button>
          </div>
        )}

        {step === 4 && <ConnectChecklist onDone={onClose} onPlay={() => void playInstead()} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd C:/Users/lkspe/petbnb && npx vitest run src/components/collar/__tests__/PairingWizard.test.tsx && npm run typecheck`
Expected: PASS (11 tests); tsc 0.

- [ ] **Step 6: Full suite**

Run: `cd C:/Users/lkspe/petbnb && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add src/components/collar/PairingWizard.tsx src/components/collar/ConnectChecklist.tsx src/components/collar/__tests__/PairingWizard.test.tsx && git commit -F - <<'EOF'
Pair a collar with its sticker code and watch it check in, live

Four steps: switch it on, type the code (forgiving of case, dashes and
O/0), say who wears it, then a checklist that ticks as the collar
reports in. Unknown and taken codes, network errors and a silent collar
after 90 s each say what to do next.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 14: Remove the old collar panel; write the cleanup migration

**Files:**
- Modify: `src/app/(app)/profile/page.tsx` (drop the collars tab)
- Delete: `src/components/CollarsPanel.tsx`
- Modify: `src/components/__tests__/loginWall.test.tsx`, `src/components/__tests__/profileAvailability.test.tsx` (drop the CollarsPanel mock line)
- Modify: `src/lib/i18n/en/appPages.ts`, `src/lib/i18n/lt/appPages.ts` (drop the old `collars` section and `profile.tabMyCollars`)
- Create: `supabase/migrations/20260927090000_collar_showcase_cleanup.sql` (applied in Task 15, after the web release)

- [ ] **Step 1: Drop the tab**

In `src/app/(app)/profile/page.tsx`:
- Remove the line `import CollarsPanel from "@/components/CollarsPanel";`.
- In the lucide import, remove `Radar` (leave the others).
- Change `useState<"personal" | "sitter" | "collars">("personal")` to `useState<"personal" | "sitter">("personal")`.
- In the tabs array, remove the third entry `{ value: "collars" as const, label: t("appPages.profile.tabMyCollars"), icon: Radar }` (and its leading comma).
- Delete the block

```tsx
      {tab === "collars" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <CollarsPanel />
        </motion.div>
      )}
```

- [ ] **Step 2: Delete the panel and its mocks**

```bash
cd C:/Users/lkspe/petbnb && git rm src/components/CollarsPanel.tsx
```

In `src/components/__tests__/loginWall.test.tsx` and `src/components/__tests__/profileAvailability.test.tsx`, delete the line `vi.mock("@/components/CollarsPanel", () => ({ default: () => null }));`.

- [ ] **Step 3: Drop the old strings**

Check nothing else uses them: `grep -rn "appPages\.collars\.\|tabMyCollars" src --include=*.ts --include=*.tsx | grep -v "src/lib/i18n/"` → expect no output.
Then remove the whole `collars: { … },` section and the `tabMyCollars` line from both `src/lib/i18n/en/appPages.ts` and `src/lib/i18n/lt/appPages.ts`.

- [ ] **Step 4: Write the cleanup migration (do not apply yet)**

Create `supabase/migrations/20260927090000_collar_showcase_cleanup.sql`:

```sql
-- Showcase (spec 2026-09-26-showcase-collar-smartid-design.md), part 2 of 2. Apply only after the
-- web release that pairs collars by sticker code is live: the old Profile panel called
-- register_collar_device and deleted rows directly.
-- Owners may now only rename a collar directly; pairing, unpairing, the demo collar and replays go
-- through claim_collar / unpair_collar / create_demo_collar / replay_collar_point.

drop function if exists public.register_collar_device(text, text);

drop policy if exists "Owners manage their own collar devices" on public.collar_devices;

create policy "Owners read their collars" on public.collar_devices
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy "Owners rename their collars" on public.collar_devices
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke insert, update, delete on public.collar_devices from anon, authenticated;
grant update (label) on public.collar_devices to authenticated;
revoke select on public.collar_devices from anon;
```

- [ ] **Step 5: Full suite, typecheck, build**

Run: `cd C:/Users/lkspe/petbnb && npm test && npm run typecheck && npm run build`
Expected: all green; tsc 0; build succeeds (the route list shows `/collar`).

- [ ] **Step 6: Commit**

```bash
cd C:/Users/lkspe/petbnb && git add "src/app/(app)/profile/page.tsx" src/components/__tests__/loginWall.test.tsx src/components/__tests__/profileAvailability.test.tsx src/lib/i18n/en/appPages.ts src/lib/i18n/lt/appPages.ts supabase/migrations/20260927090000_collar_showcase_cleanup.sql && git commit -F - <<'EOF'
Retire the Profile collar tab now that the collar has its own page

The old panel and its .env pop-up go; the cleanup migration (applied
after the release) drops register_collar_device and limits owners to
renaming a collar directly.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 15: See it, release it, make it real

**Files:**
- Create (never commit): `src/app/dev/collar/page.tsx`
- Modify after release: `src/lib/database.types.ts` (regenerated), the cleanup migration's file name

- [ ] **Step 1: A sandbox for every state (uncommitted)**

Create `src/app/dev/collar/page.tsx` — it sits outside the login wall and fakes the provider:

```tsx
"use client";
/** TEMPORARY SANDBOX — never commit. /dev/collar?state=live|replaying|searching|waiting|offline|demo_idle|no_collar|wizard */
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import CollarPage from "@/components/collar/CollarPage";
import Sidebar from "@/components/Sidebar";
import { CollarLiveContext, EMPTY_COLLAR_LIVE, type CollarLiveValue } from "@/context/CollarLiveContext";
import type { CollarDevice, CollarState } from "@/lib/collar/types";
import PairingWizard from "@/components/collar/PairingWizard";

const now = Date.now();
const iso = (msAgo: number) => new Date(now - msAgo).toISOString();

function value(state: CollarState): CollarLiveValue {
  const device: CollarDevice = {
    id: "c1", label: "Reksas", is_demo: state === "demo_idle", claimed_at: iso(2 * 86_400_000), created_at: iso(2 * 86_400_000),
    last_seen_at: state === "offline" ? iso(12 * 60_000) : state === "waiting" ? null : iso(3_000),
    gps_locked: state === "live", gps_satellites: state === "live" ? 7 : 2,
  };
  const latest = state === "waiting" || state === "searching" ? null
    : { device_id: "c1", lat: 54.6831, lng: 25.2349, speed_kmh: 4.2, recorded_at: iso(state === "offline" ? 12 * 60_000 : 3_000), source: state === "replaying" ? ("replay" as const) : ("collar" as const) };
  return {
    ...EMPTY_COLLAR_LIVE,
    now,
    state,
    collars: state === "no_collar" ? [] : [device],
    selected: state === "no_collar" ? null : device,
    latest,
    latestReal: latest?.source === "collar" ? latest : null,
    replay: state === "replaying" ? { deviceId: "c1", idx: 23, total: 64 } : null,
    pair: async () => ({ deviceId: "c1", result: "paired" }),
  };
}

function Sandbox() {
  const params = useSearchParams();
  const raw = params.get("state") ?? "live";
  const state = (raw === "wizard" ? "waiting" : raw) as CollarState;
  return (
    <CollarLiveContext.Provider value={value(state)}>
      <Sidebar />
      <div className="lg:pl-64"><CollarPage /></div>
      {raw === "wizard" && <PairingWizard onClose={() => {}} />}
    </CollarLiveContext.Provider>
  );
}

export default function DevCollar() {
  return <Suspense><Sandbox /></Suspense>;
}
```

- [ ] **Step 2: Look at every state at 1280 and 390 px, in EN and LT**

Run `npm run dev`, then with the Chrome DevTools MCP tools (`new_page`, `resize_page`, `take_screenshot`) open `http://localhost:3000/dev/collar?state=<s>` for each of `live, replaying, searching, waiting, offline, demo_idle, no_collar, wizard`, at 1280×800 and 390×844, switching EN/LT with the sidebar's switcher. Compare against `docs/superpowers/specs/2026-09-26-showcase-mockups/collar-page.html` and `sidebar.html`. Check especially: nothing overflows at 390 px; the LT strings fit their buttons; the wizard is a bottom sheet at 390 px; the rail scrolls rather than clips at 720 px tall. Fix and commit anything off (never the sandbox file).

- [ ] **Step 3: Everything green**

Run: `cd C:/Users/lkspe/petbnb && npm test && npm run typecheck && npm run build`
Expected: all green. Record the test count.

- [ ] **Step 4: Release (needs Lukas's yes)**

The branch also carries demo-polish Task 14. Ask Lukas: "Push `feat/showcase` to `main` (fast-forward; Vercel deploys it), then apply the collar cleanup migration?" On yes:

```bash
cd C:/Users/lkspe/petbnb && git fetch origin && git switch main && git merge --ff-only feat/showcase && git push origin main && git switch feat/showcase
```

Wait until https://petbnb.lt serves the new build (the `/collar` route answers 200 when signed in; or the deployment shows Ready in Vercel).

- [ ] **Step 5: Apply the cleanup migration and check it (after the deploy)**

`mcp__claude_ai_Supabase__apply_migration` with name `collar_showcase_cleanup` and the file's contents. Then `execute_sql`:

```sql
begin;
select set_config('t.a', (select id::text from public.profiles order by created_at limit 1), true);
insert into public.collar_devices (id, owner_id, device_secret_hash, claimed_at, label)
values ('00000000-0000-4000-8000-0000000c0222', current_setting('t.a')::uuid, 'x', now(), 'Before');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('t.a'), 'role', 'authenticated')::text, true);
update public.collar_devices set label = 'After' where id = '00000000-0000-4000-8000-0000000c0222';
do $$ begin
  if (select label from public.collar_devices where id = '00000000-0000-4000-8000-0000000c0222') <> 'After' then raise exception 'rename failed'; end if;
  begin
    update public.collar_devices set owner_id = null where id = '00000000-0000-4000-8000-0000000c0222';
    raise exception 'owner_id should not be updatable';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.collar_devices where id = '00000000-0000-4000-8000-0000000c0222';
    raise exception 'a direct delete should be refused';
  exception when insufficient_privilege then null;
  end;
  if exists (select 1 from pg_proc where proname = 'register_collar_device') then raise exception 'register_collar_device still exists'; end if;
end $$;
rollback;
select 'cleanup checks passed' as result;
```

Expected: `cleanup checks passed`. Rename the migration file to the version `list_migrations` reports, regenerate `src/lib/database.types.ts` with `generate_typescript_types`, run `npm run typecheck`, commit both, and push (same yes).

- [ ] **Step 6: Make it real (Lukas, with the Pi)**

1. `cd iot-collar && .venv/Scripts/python -m tools.provision` → run the printed insert in the SQL editor (prod write: Lukas's yes), print the sticker, copy `.env` and the updated `collar/` code to the Pi (`scp -r collar .env <user>@petbnb-collar.local:~/petbnb-collar/`), restart the service.
2. On petbnb.lt, signed in: Collar → Pair a collar → the sticker code. Indoors: expect "Collar online" and "Finding satellites" in the checklist, then the **searching** card.
3. Outdoors: expect **live**, the dot moving, the sidebar card live on every page. Walk 30–40 minutes somewhere public.
4. Copy the walk into `collar_recordings` (README "Recording a walk"; prod write: yes). Back indoors: Play a recorded walk → the DEMO banner, the dot moving, the sidebar card moving on other pages; Stop.
5. Switch the Pi off: after 90 s expect **offline** with "Last seen HH:MM".
6. Record every outcome in the checkpoint.
