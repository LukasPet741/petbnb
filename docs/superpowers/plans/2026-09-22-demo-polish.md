# Demo polish: reviews, booking timeline, onboarding ring, availability. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** make the trust story visible at the thesis defence: verified sitter → free dates → booking progress → reviews.

**Architecture:** four independent parts, built in this order on one branch. The first three (A to C)
are app-only and need no database change except one seed script. Part D follows the approved spec:
one migration, pure TS rules that mirror the database, and a calendar component used in three places.

**Tech Stack:** Next 16.2 (read `node_modules/next/dist/docs/` before touching routing), React 19, Tailwind 4,
framer-motion 12, Supabase (Postgres 17), vitest + Testing Library.

**Spec:** Parts A to C: this plan (picked by Lukas on 2026-09-22 from the "eye candy" list: items 1, 2, 4 and 5).
Part D: `docs/superpowers/specs/2026-09-16-sitter-availability-design.md`. Deviations from that spec are listed at the top of Part D.

## Global Constraints

- Branch `feat/demo-polish` off `main`. One commit per task. **Never `git add -A`**; add the named files.
- **Never commit `src/app/dev/`** (sandboxes live there and stay untracked), `docs/security/`.
- **Prod writes need Lukas's explicit yes in that moment:** Task 3 (seed reviews), Task 9 (migration), Task 15 (demo days off), `git push`.
- **Prod sends real email.** Any prod insert into `bookings` fires `booking_event_notify` → `notifications` → `booking-notify`. Seed scripts disable that trigger inside their transaction.
- Every new string exists in **EN and LT** (`src/lib/i18n/en/*.ts`, `src/lib/i18n/lt/*.ts`); `parity.test.ts` enforces it. Tests render without a provider, so `t` returns the key.
- Motion respects `useReducedMotion()` from framer-motion. Reduced means no pulse, no draw-in, and the final state renders at once.
- Tap targets ≥ 44px (`min-h-11`), layout works at 390px. Buttons inside `<form>` carry `type="button"`.
- Raw `<img>`, no dark mode, no new dependencies.
- Database functions: `search_path = ''`, fully-qualified names, trusted roles `postgres`, `supabase_admin`, `service_role` skip triggers, execute revoked from `public, anon`.
- Apply migrations with the Supabase MCP `apply_migration` (project `jktykrbvwgagcjyuxypo`), then rename the local file to the stamped version (stamp quirk, see `project-reference`).
- Commands: `npm test` (vitest run), `npx vitest run <path>`, `npm run typecheck`, `npm run build`.

## File map

| File | Part | Responsibility |
|---|---|---|
| `src/components/Stars.tsx` | A | optional staggered pop-in of filled stars |
| `supabase/seed/2026-09-22-demo-reviews.sql` | A | 10 completed bookings + owner reviews between `@petbnb.test` accounts, and a rollback |
| `src/lib/booking-timeline.ts` | B | pure: status + dates → four steps with done/current/todo |
| `src/components/BookingTimeline.tsx` | B | the track, pulsing current dot |
| `src/components/BookingCard.tsx` | B | renders the timeline |
| `src/lib/sitter-onboarding.ts` | C | pure: profile → checklist + percent |
| `src/components/dashboard/OnboardingRing.tsx` | C | SVG ring + checklist links |
| `src/components/dashboard/DashboardView.tsx`, `src/app/(app)/dashboard/page.tsx` | C | show it to unfinished sitters |
| `src/lib/availability.ts` | D | pure rules mirroring the database |
| `supabase/migrations/<stamp>_sitter_availability.sql` | D | table, RLS, 3 functions, trigger |
| `src/components/AvailabilityCalendar.tsx` | D | two-month calendar, edit and view modes |
| `src/hooks/useBusyDays.ts` | D | one RPC read for a sitter's busy days |
| profile, browse, browse/[id], bookings/new, bookings pages + `MessageThread.tsx` | D | wiring + hint mapping |

---

## Part A: Reviews that show

Browse cards already render `RatingSummary` when `sitter_ratings` has a row (`SitterCard.tsx:121`), and the profile already has `ReviewList`. Production has **0 reviews**, so nothing shows. Part A adds a little motion and then fills the data.

### Task 1: Stars pop in

**Files:**
- Modify: `src/components/Stars.tsx`
- Test: `src/components/__tests__/Stars.test.tsx`

**Interfaces:**
- Produces: `Stars` accepts `animate?: boolean` (default `false`). `RatingSummary` passes `animate` through as a new optional prop `animate?: boolean`.

- [ ] **Step 1: Write the failing test** (append to `Stars.test.tsx`)

```tsx
describe("animate", () => {
  it("renders the same stars whether or not it animates", () => {
    const { container: still } = render(<Stars value={4.5} />);
    const { container: moving } = render(<Stars value={4.5} animate />);
    const states = (c: HTMLElement) => [...c.querySelectorAll("[data-star]")].map((n) => n.getAttribute("data-star"));
    expect(states(moving)).toEqual(states(still));
    expect(states(moving)).toEqual(["full", "full", "full", "full", "half"]);
  });

  it("marks itself as animated so the pop-in is opt-in", () => {
    const { container } = render(<Stars value={3} animate />);
    expect(container.querySelector("[data-animated='true']")).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/components/__tests__/Stars.test.tsx`
Expected: FAIL on the second test (no `data-animated`).

- [ ] **Step 3: Implement**

In `Stars.tsx`: import `{ motion, useReducedMotion } from "framer-motion"`, add the prop, and wrap each star:

```tsx
export default function Stars({ value, size = "sm", animate = false }: { value: number; size?: StarSize; animate?: boolean }) {
  const { t, locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const moving = animate && !reduceMotion;
  // ...existing fill/iconClass/safeValue...
  return (
    <span role="img" aria-label={/* unchanged */} data-animated={moving || undefined} className="inline-flex items-center gap-0.5">
      {Array.from({ length: MAX_STARS }, (_, i) => {
        const state = stateAt(i, fill);
        return (
          <motion.span
            key={i}
            data-star={state}
            className="inline-flex"
            initial={moving && state !== "empty" ? { scale: 0.4, opacity: 0 } : false}
            whileInView={moving ? { scale: 1, opacity: 1 } : undefined}
            viewport={{ once: true }}
            transition={{ type: "spring", stiffness: 420, damping: 18, delay: i * 0.06 }}
          >
            {/* unchanged icon markup */}
          </motion.span>
        );
      })}
    </span>
  );
}
```

`whileInView` rather than `animate`, so cards further down the grid pop in as they scroll into view. In `RatingSummary.tsx` add `animate?: boolean` to the props and pass it to `<Stars value={average} size={size} animate={animate} />`. In `SitterCard.tsx:121` pass `animate`.

- [ ] **Step 4: Run it and see it pass.** The full file, plus `RatingSummary.test.tsx` and `SitterCard.test.tsx`:
`npx vitest run src/components/__tests__/Stars.test.tsx src/components/__tests__/RatingSummary.test.tsx src/components/__tests__/SitterCard.test.tsx`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Stars.tsx src/components/RatingSummary.tsx src/components/SitterCard.tsx src/components/__tests__/Stars.test.tsx
git commit -m "Let rating stars pop in on browse cards"
```

### Task 2: Seed script for demo reviews (written, not run)

**Files:**
- Create: `supabase/seed/2026-09-22-demo-reviews.sql`

**Why this shape:** production accounts split cleanly (checked 2026-09-22): **24 seed sitters** (`verification_method = 'seed'`, `@petbnb.test`), **16 seed owners with pets** (`@petbnb.test`), and 3 real accounts. The script touches only `@petbnb.test` accounts, so no real person gets a review they did not earn. Each review needs a `completed` booking (FK + RLS rules). Running as `postgres` skips `enforce_booking_rules`. `booking_event_notify` is disabled inside the transaction, so **no notification row and no email** is created. Every seeded booking carries `notes = '[demo seed 2026-09-22]'`, so the rollback is one delete.

- [ ] **Step 1: Write the file**

```sql
-- Demo reviews for the thesis defence (2026-09-22). Touches ONLY @petbnb.test seed accounts.
-- Run as postgres via the Supabase MCP execute_sql, with Lukas's yes. No email: the booking
-- event trigger is disabled inside the transaction and re-enabled before commit.
-- Rollback: see the bottom of this file.
begin;

alter table public.bookings disable trigger booking_event_notify;

do $$
declare
  bodies text[] := array[
    'Rudis grįžo laimingas ir pavargęs, gavau nuotraukų kiekvieną dieną. Tikrai kreipsimės vėl.',
    'Very calm with our anxious cat. Sent updates without being asked. Highly recommend.',
    'Puikus bendravimas, viskas kaip sutarta. Šuo net nenorėjo eiti namo.',
    'Reliable and kind. Our dog came back clean, fed and happy.',
    'Labai atsakinga globėja, atsiuntė vaizdo įrašą iš pasivaikščiojimo parke.',
    'Arrived on time every day, followed the feeding schedule to the minute.',
    'Katinas priprato per vieną dieną. Ačiū už kantrybę!',
    'Great with a puppy full of energy. Long walks, lots of patience.',
    'Viskas buvo gerai, tik norėčiau šiek tiek daugiau nuotraukų. Vis tiek rekomenduoju.',
    'Second booking with this sitter and just as good as the first.'
  ];
  ratings int[] := array[5, 5, 5, 5, 5, 5, 4, 5, 4, 5];
  s record;
  p record;
  i int := 0;
  v_booking uuid;
  v_service text;
  v_start timestamptz;
begin
  for s in
    select pr.id, pr.services
    from public.profiles pr
    join auth.users u on u.id = pr.id
    where pr.is_sitter and pr.verification_method = 'seed' and u.email like '%@petbnb.test'
    order by pr.id
    limit 10
  loop
    i := i + 1;

    select pe.id, pe.owner_id into p
    from public.pets pe
    join auth.users u on u.id = pe.owner_id
    where u.email like '%@petbnb.test' and pe.owner_id <> s.id
    order by md5(pe.id::text || s.id::text)
    limit 1;

    v_service := coalesce(
      (select e.key from jsonb_each_text(s.services) e where e.value = 'true' and e.key <> 'grooming' order by e.key limit 1),
      'walking');
    v_start := date_trunc('day', now()) - make_interval(days => 8 + i * 5) + interval '9 hours';

    insert into public.bookings (owner_id, sitter_id, pet_id, service, start_at, end_at, status, days, notes)
    values (p.owner_id, s.id, p.id, v_service, v_start, v_start + interval '2 days', 'completed', 2, '[demo seed 2026-09-22]')
    returning id into v_booking;

    insert into public.reviews (booking_id, author_id, subject_id, direction, rating, body, communication, pet_wellbeing, reliability, created_at)
    values (v_booking, p.owner_id, s.id, 'owner_to_sitter', ratings[i], bodies[i], ratings[i], 5, ratings[i], v_start + interval '3 days');
  end loop;
end $$;

alter table public.bookings enable trigger booking_event_notify;

-- Check before committing: expect 10, 10, 0.
select
  (select count(*) from public.bookings where notes = '[demo seed 2026-09-22]') as seeded_bookings,
  (select count(*) from public.reviews r join public.bookings b on b.id = r.booking_id where b.notes = '[demo seed 2026-09-22]') as seeded_reviews,
  (select count(*) from public.notifications where created_at > now() - interval '5 minutes') as new_notifications;

commit;

-- ROLLBACK (run only to remove the demo data; reviews cascade with their booking):
-- begin;
-- alter table public.bookings disable trigger booking_event_notify;
-- delete from public.bookings where notes = '[demo seed 2026-09-22]';
-- alter table public.bookings enable trigger booking_event_notify;
-- commit;
```

- [ ] **Step 2: Dry run inside a rolled-back transaction** (read-only in effect; still ask Lukas, since it runs on prod). Replace `commit;` with `rollback;` and run via MCP `execute_sql`. Expected: the check row reads `10 | 10 | 0`, and no error. If `reviews` refuses the `created_at` column or a check fails, fix the script and dry-run again.

- [ ] **Step 3: Commit the script** (it contains no secrets; the repo is public, and fake review text for fake accounts is fine)

```bash
git add supabase/seed/2026-09-22-demo-reviews.sql
git commit -m "Add a demo review seed for the @petbnb.test accounts, with its rollback"
```

### Task 3: Run the seed on prod (NEEDS LUKAS'S YES)

- [ ] **Step 1:** Ask: "Seed 10 demo bookings + reviews on prod, seed accounts only, no email?" Stop until yes.
- [ ] **Step 2:** Run the file as written (with `commit;`) through `execute_sql`. Expected check row: `10 | 10 | 0`.
- [ ] **Step 3: Verify from catalogs and the view, not from the success flag:**

```sql
select tgname, tgenabled from pg_trigger where tgrelid = 'public.bookings'::regclass and tgname = 'booking_event_notify';  -- tgenabled = 'O'
select count(*) from public.sitter_ratings;  -- 10
select count(*) from public.notifications where created_at > now() - interval '10 minutes';  -- 0
```

- [ ] **Step 4:** Nothing to commit. Record the counts in the checkpoint.

---

## Part B: Booking timeline

### Task 4: `timelineSteps`, pure

**Files:**
- Create: `src/lib/booking-timeline.ts`
- Test: `src/lib/__tests__/booking-timeline.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type TimelineStepKey = "requested" | "accepted" | "inProgress" | "completed";
  export type StepState = "done" | "current" | "todo";
  export interface TimelineStep { key: TimelineStepKey; state: StepState }
  export function timelineSteps(status: string, endAt: string, now: number): TimelineStep[] | null; // startAt dropped 2026-09-23: unused
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { timelineSteps } from "@/lib/booking-timeline";

const START = "2026-10-01T09:00:00+03:00";
const END = "2026-10-03T09:00:00+03:00";
const at = (iso: string) => Date.parse(iso);
const states = (s: ReturnType<typeof timelineSteps>) => s?.map((x) => x.state);

describe("timelineSteps", () => {
  it("pending: the request is sent and acceptance is what happens next", () => {
    expect(states(timelineSteps("pending", START, END, at("2026-09-22T12:00:00+03:00")))).toEqual(["done", "current", "todo", "todo"]);
  });

  it("signed before the start: accepted, waiting for the stay", () => {
    expect(states(timelineSteps("signed", START, END, at("2026-09-30T12:00:00+03:00")))).toEqual(["done", "done", "current", "todo"]);
  });

  it("signed during the stay: in progress", () => {
    const steps = timelineSteps("signed", START, END, at("2026-10-02T12:00:00+03:00"));
    expect(states(steps)).toEqual(["done", "done", "current", "todo"]);
  });

  it("signed after the end: waiting for the sitter to mark it completed", () => {
    expect(states(timelineSteps("signed", START, END, at("2026-10-04T12:00:00+03:00")))).toEqual(["done", "done", "done", "current"]);
  });

  it("completed: every step done", () => {
    expect(states(timelineSteps("completed", START, END, at("2026-10-05T12:00:00+03:00")))).toEqual(["done", "done", "done", "done"]);
  });

  it("cancelled and declined have no timeline, since the status badge already says it", () => {
    expect(timelineSteps("cancelled", START, END, at("2026-09-22T12:00:00+03:00"))).toBeNull();
    expect(timelineSteps("declined", START, END, at("2026-09-22T12:00:00+03:00"))).toBeNull();
  });

  it("keeps the step order fixed", () => {
    expect(timelineSteps("pending", START, END, 0)?.map((s) => s.key)).toEqual(["requested", "accepted", "inProgress", "completed"]);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/booking-timeline.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Where a booking is on its way from request to done, as four steps for BookingTimeline.
 *
 * "current" is the step the booking is waiting on, not the last one reached: a pending request
 * is waiting on acceptance, so "accepted" pulses. A signed booking past its end is waiting on
 * the sitter's "mark completed" (enforce_completion_timing allows it only after the end).
 * Cancelled and declined return null: the status badge already says so, and a track stopped
 * halfway reads as a bug.
 */
export type TimelineStepKey = "requested" | "accepted" | "inProgress" | "completed";
export type StepState = "done" | "current" | "todo";
export interface TimelineStep { key: TimelineStepKey; state: StepState }

const KEYS: TimelineStepKey[] = ["requested", "accepted", "inProgress", "completed"];

function withCurrent(current: number): TimelineStep[] {
  return KEYS.map((key, i) => ({ key, state: i < current ? "done" : i === current ? "current" : "todo" }));
}

export function timelineSteps(status: string, startAt: string, endAt: string, now: number): TimelineStep[] | null {
  if (status === "pending") return withCurrent(1);
  if (status === "completed") return withCurrent(KEYS.length);
  if (status !== "signed") return null;
  return withCurrent(now >= Date.parse(endAt) ? 3 : 2);
}
```


- [ ] **Step 4:** Run it again. Expected: PASS (7 tests).
- [ ] **Step 5: Commit**

```bash
git add src/lib/booking-timeline.ts src/lib/__tests__/booking-timeline.test.ts
git commit -m "Work out where a booking is on its way from request to done"
```

### Task 5: `BookingTimeline` on the booking cards

**Files:**
- Create: `src/components/BookingTimeline.tsx`
- Modify: `src/components/BookingCard.tsx` (pending card after the price line, and the resolved card under the row, before `reviewSlot`)
- Modify: `src/lib/i18n/en/appPages.ts`, `src/lib/i18n/lt/appPages.ts` (`appPages.bookings.timeline`)
- Test: `src/components/__tests__/BookingTimeline.test.tsx`, extend `BookingCard.test.tsx`

**Interfaces:**
- Consumes: `timelineSteps` from Task 4.
- Produces: `<BookingTimeline status startAt endAt now? />`, which renders nothing when `timelineSteps` returns null.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import BookingTimeline from "@/components/BookingTimeline";

const START = "2026-10-01T09:00:00+03:00";
const END = "2026-10-03T09:00:00+03:00";

describe("BookingTimeline", () => {
  it("lists the four steps in order and marks the current one for screen readers", () => {
    render(<BookingTimeline status="pending" startAt={START} endAt={END} now={Date.parse("2026-09-22T12:00:00+03:00")} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-state"))).toEqual(["done", "current", "todo", "todo"]);
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("list", { name: "appPages.bookings.timeline.label" })).toBeInTheDocument();
  });

  it("renders nothing for a cancelled booking", () => {
    const { container } = render(<BookingTimeline status="cancelled" startAt={START} endAt={END} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

In `BookingCard.test.tsx`, add: a pending booking renders `getByRole("list", { name: "appPages.bookings.timeline.label" })`; a cancelled one does not (`queryByRole(...)` is null).

- [ ] **Step 2:** `npx vitest run src/components/__tests__/BookingTimeline.test.tsx src/components/__tests__/BookingCard.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement the component**

```tsx
"use client";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { timelineSteps } from "@/lib/booking-timeline";
import { cn } from "@/lib/utils";

/** Requested → accepted → in progress → completed, with the step the booking waits on pulsing. */
export default function BookingTimeline({ status, startAt, endAt, now = Date.now(), className }: {
  status: string; startAt: string; endAt: string; now?: number; className?: string;
}) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const steps = timelineSteps(status, endAt, now);
  if (!steps) return null;

  return (
    <ol aria-label={t("appPages.bookings.timeline.label")} className={cn("grid grid-cols-4 gap-1", className)}>
      {steps.map((step, i) => (
        <li key={step.key} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
          <div className="relative flex w-full items-center">
            <span className={cn("h-0.5 flex-1", i === 0 ? "opacity-0" : step.state === "todo" ? "bg-ink/10" : "bg-brand")} />
            <span className={cn(
              "relative grid h-5 w-5 flex-shrink-0 place-items-center rounded-full",
              step.state === "done" && "bg-brand text-white",
              step.state === "current" && "bg-white ring-2 ring-brand",
              step.state === "todo" && "bg-white ring-1 ring-ink/15",
            )}>
              {step.state === "done" && <Check className="h-3 w-3" aria-hidden="true" />}
              {step.state === "current" && (
                <>
                  <span className="h-2 w-2 rounded-full bg-brand" />
                  {!reduceMotion && (
                    <motion.span aria-hidden="true" className="absolute inset-0 rounded-full ring-2 ring-brand"
                      animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }} />
                  )}
                </>
              )}
            </span>
            <span className={cn("h-0.5 flex-1", i === steps.length - 1 ? "opacity-0" : steps[i + 1].state === "todo" ? "bg-ink/10" : "bg-brand")} />
          </div>
          <span className={cn("text-[11px] leading-tight", step.state === "todo" ? "text-ink-soft/70" : "font-medium text-ink")}>
            {t(`appPages.bookings.timeline.${step.key}`)}
          </span>
        </li>
      ))}
    </ol>
  );
}
```


- [ ] **Step 4: Wire it into `BookingCard.tsx`**
  - Pending card: directly after `{priceLine && ...}` insert `<BookingTimeline status={booking.status} startAt={booking.start_at} endAt={booking.end_at} className="mt-4 max-w-sm" />`.
  - Resolved card: after the closing `</div>` of the flex row and before `{reviewSlot}` insert `<BookingTimeline status={booking.status} startAt={booking.start_at} endAt={booking.end_at} className="mt-3" />`. It self-hides for cancelled and declined.

- [ ] **Step 5: Strings.** In `en/appPages.ts` under `bookings`:
  ```ts
  timeline: { label: "Booking progress", requested: "Requested", accepted: "Accepted", inProgress: "In progress", completed: "Completed" },
  ```
  In `lt/appPages.ts` under `bookings`:
  ```ts
  timeline: { label: "Užsakymo eiga", requested: "Užklausa", accepted: "Priimta", inProgress: "Vyksta", completed: "Baigta" },
  ```

- [ ] **Step 6:** `npx vitest run src/components/__tests__/BookingTimeline.test.tsx src/components/__tests__/BookingCard.test.tsx src/lib/i18n`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add src/components/BookingTimeline.tsx src/components/BookingCard.tsx src/components/__tests__/BookingTimeline.test.tsx src/components/__tests__/BookingCard.test.tsx src/lib/i18n/en/appPages.ts src/lib/i18n/lt/appPages.ts
git commit -m "Show each booking's progress from request to completed"
```

---

## Part C: Sitter onboarding ring

### Task 6: `onboardingSteps`, pure

**Files:**
- Create: `src/lib/sitter-onboarding.ts`
- Test: `src/lib/__tests__/sitter-onboarding.test.ts`

**Interfaces:**
- Consumes: `askingPrice(prices, service, days)` from `src/lib/pricing.ts`; `SERVICE_LABELS`, `ServiceType` from `src/lib/types.ts`.
- Produces:
  ```ts
  export type OnboardingKey = "photo" | "bio" | "services" | "prices" | "verified";
  export interface OnboardingStep { key: OnboardingKey; done: boolean; href: string }
  export interface OnboardingInput { avatar_url: string | null; about_me: string | null; services: unknown; prices?: unknown; verification_method?: string | null }
  export function onboardingSteps(p: OnboardingInput): OnboardingStep[];
  export function onboardingPercent(steps: OnboardingStep[]): number; // 0..100, whole number
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { onboardingSteps, onboardingPercent } from "@/lib/sitter-onboarding";

const blank = { avatar_url: null, about_me: null, services: {}, prices: {}, verification_method: "none" };
const done = (p: Parameters<typeof onboardingSteps>[0]) => Object.fromEntries(onboardingSteps(p).map((s) => [s.key, s.done]));

describe("onboardingSteps", () => {
  it("a fresh sitter has everything left to do", () => {
    expect(done(blank)).toEqual({ photo: false, bio: false, services: false, prices: false, verified: false });
    expect(onboardingPercent(onboardingSteps(blank))).toBe(0);
  });

  it("a whitespace bio is not a bio", () => {
    expect(done({ ...blank, about_me: "   " }).bio).toBe(false);
  });

  it("prices count only when every offered service has one", () => {
    const services = { walking: true, boarding: true };
    const half = { walking: { amount: 10, days: 1 } };
    const full = { walking: { amount: 10, days: 1 }, boarding: { amount: 30, days: 1 } };
    expect(done({ ...blank, services, prices: half }).prices).toBe(false);
    expect(done({ ...blank, services, prices: full }).prices).toBe(true);
  });

  it("no services means no prices step done either", () => {
    expect(done({ ...blank, prices: { walking: { amount: 10, days: 1 } } }).prices).toBe(false);
  });

  it("verified is anything but 'none', matching sitterBlocker", () => {
    expect(done({ ...blank, verification_method: "smart_id_demo" }).verified).toBe(true);
    expect(done({ ...blank, verification_method: "seed" }).verified).toBe(true);
  });

  it("links photo, bio, services and prices to /profile and verification to the Smart-ID demo", () => {
    const hrefs = Object.fromEntries(onboardingSteps(blank).map((s) => [s.key, s.href]));
    expect(hrefs).toEqual({ photo: "/profile", bio: "/profile", services: "/profile", prices: "/profile", verified: "/smart-id-demo" });
  });

  it("percent rounds to a whole number", () => {
    expect(onboardingPercent(onboardingSteps({ ...blank, avatar_url: "x" }))).toBe(20);
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/sitter-onboarding.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import { askingPrice } from "@/lib/pricing";
import { SERVICE_LABELS, type ServiceType, type SitterPrices } from "@/lib/types";

/**
 * What a sitter still has to do before owners can book them, for the dashboard's ring.
 * "verified" matches sitterBlocker: anything but 'none' is bookable (enforce_sitter_verified).
 */
export type OnboardingKey = "photo" | "bio" | "services" | "prices" | "verified";
export interface OnboardingStep { key: OnboardingKey; done: boolean; href: string }
export interface OnboardingInput {
  avatar_url: string | null;
  about_me: string | null;
  services: unknown;
  prices?: unknown;
  verification_method?: string | null;
}

export function onboardingSteps(p: OnboardingInput): OnboardingStep[] {
  const services = (p.services ?? {}) as Partial<Record<ServiceType, boolean>>;
  const offered = (Object.keys(SERVICE_LABELS) as ServiceType[]).filter((k) => services[k] === true);
  const prices = (p.prices ?? {}) as SitterPrices;
  return [
    { key: "photo", done: Boolean(p.avatar_url), href: "/profile" },
    { key: "bio", done: Boolean(p.about_me?.trim()), href: "/profile" },
    { key: "services", done: offered.length > 0, href: "/profile" },
    { key: "prices", done: offered.length > 0 && offered.every((s) => askingPrice(prices, s, 1) !== null), href: "/profile" },
    { key: "verified", done: Boolean(p.verification_method) && p.verification_method !== "none", href: "/smart-id-demo" },
  ];
}

export function onboardingPercent(steps: OnboardingStep[]): number {
  return steps.length === 0 ? 0 : Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}
```

Check that `SitterPrices` is exported from `src/lib/types.ts` (it types `Profile.prices`). If it lives in `pricing.ts`, import it from there.

- [ ] **Step 4:** Run it again. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add src/lib/sitter-onboarding.ts src/lib/__tests__/sitter-onboarding.test.ts
git commit -m "Work out what a new sitter still has to do to be bookable"
```

### Task 7: The ring on the dashboard

**Files:**
- Create: `src/components/dashboard/OnboardingRing.tsx`
- Modify: `src/components/dashboard/DashboardView.tsx` (new optional prop, rendered between the header and `NextUpCard`)
- Modify: `src/app/(app)/dashboard/page.tsx` (computes it for sitters)
- Modify: `src/lib/i18n/en/appShell.ts`, `src/lib/i18n/lt/appShell.ts` (`appShell.dashboard.onboarding`)
- Test: extend `src/components/__tests__/dashboardView.test.tsx`

**Interfaces:**
- Consumes: `OnboardingStep`, `onboardingPercent` (Task 6).
- Produces: `DashboardViewProps.onboarding?: OnboardingStep[] | null`. It renders only when present and below 100%.

- [ ] **Step 1: Write the failing tests** (append to `dashboardView.test.tsx`)

```tsx
describe("onboarding ring", () => {
  const steps = [
    { key: "photo", done: true, href: "/profile" },
    { key: "bio", done: false, href: "/profile" },
    { key: "services", done: true, href: "/profile" },
    { key: "prices", done: true, href: "/profile" },
    { key: "verified", done: false, href: "/smart-id-demo" },
  ] as const;

  it("shows a sitter how far along they are and links each missing step", () => {
    render(<DashboardView {...props({ onboarding: [...steps] })} />);
    expect(screen.getByRole("progressbar", { name: "appShell.dashboard.onboarding.title" })).toHaveAttribute("aria-valuenow", "60");
    expect(hrefOf("appShell.dashboard.onboarding.steps.verified")).toBe("/smart-id-demo");
    expect(hrefOf("appShell.dashboard.onboarding.steps.bio")).toBe("/profile");
  });

  it("disappears once everything is done, and for non-sitters", () => {
    const { rerender } = render(<DashboardView {...props({ onboarding: steps.map((s) => ({ ...s, done: true })) })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    rerender(<DashboardView {...props({ onboarding: null })} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/__tests__/dashboardView.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `OnboardingRing.tsx`**

```tsx
"use client";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { onboardingPercent, type OnboardingStep } from "@/lib/sitter-onboarding";

const R = 34;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** "Your profile is 60% ready": a ring that fills as a sitter becomes bookable, and the steps left. */
export default function OnboardingRing({ steps }: { steps: OnboardingStep[] }) {
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const percent = onboardingPercent(steps);
  const offset = CIRCUMFERENCE * (1 - percent / 100);

  return (
    <section className="glass-card rounded-[var(--radius-card)] border p-5 sm:p-6 grid gap-5 sm:grid-cols-[auto_1fr] items-center">
      <div role="progressbar" aria-label={t("appShell.dashboard.onboarding.title")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="relative mx-auto h-24 w-24">
        <svg viewBox="0 0 80 80" className="h-24 w-24 -rotate-90" aria-hidden="true">
          <circle cx="40" cy="40" r={R} fill="none" strokeWidth="7" className="stroke-ink/10" />
          <motion.circle cx="40" cy="40" r={R} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-brand"
            strokeDasharray={CIRCUMFERENCE}
            initial={{ strokeDashoffset: reduceMotion ? offset : CIRCUMFERENCE }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: reduceMotion ? 0 : 1.1, ease: [0.25, 0.46, 0.45, 0.94] }} />
        </svg>
        <span className="absolute inset-0 grid place-items-center font-display text-xl font-semibold text-ink tabular-nums">{percent}%</span>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold text-ink tracking-tight">{t("appShell.dashboard.onboarding.title")}</h2>
        <p className="text-sm text-ink-soft mt-0.5">{t("appShell.dashboard.onboarding.subtitle")}</p>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {steps.map((step) => (
            <li key={step.key}>
              {step.done ? (
                <span className="flex min-h-11 items-center gap-2 text-sm text-ink-soft line-through decoration-ink/20">
                  <Check className="h-4 w-4 text-brand" aria-hidden="true" />{t(`appShell.dashboard.onboarding.steps.${step.key}`)}
                </span>
              ) : (
                <Link href={step.href} className="group flex min-h-11 items-center gap-2 rounded-[var(--radius-input)] px-2 -mx-2 text-sm font-medium text-ink hover:bg-white/60">
                  <span className="h-4 w-4 rounded-full ring-1 ring-ink/25" aria-hidden="true" />
                  {t(`appShell.dashboard.onboarding.steps.${step.key}`)}
                  <ChevronRight className="ml-auto h-4 w-4 text-ink-soft group-hover:text-brand" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Wire it in**
  - `DashboardView.tsx`: add `onboarding?: OnboardingStep[] | null;` to `DashboardViewProps`, and after `</motion.header>`:
    ```tsx
    {props.onboarding && onboardingPercent(props.onboarding) < 100 && (
      <motion.div variants={fadeUp}><OnboardingRing steps={props.onboarding} /></motion.div>
    )}
    ```
  - `dashboard/page.tsx`: `onboarding={isSitter && profile ? onboardingSteps(profile) : null}`. The `my_profile` row carries `avatar_url`, `about_me`, `services`, `prices`, `verification_method` (the profile page reads all five from the same hook).

- [ ] **Step 5: Strings.** `en/appShell.ts` under `dashboard`:
  ```ts
  onboarding: {
    title: "Get bookable",
    subtitle: "Owners can book you once these are done.",
    steps: { photo: "Add a profile photo", bio: "Write a few words about you", services: "Choose your services", prices: "Price every service", verified: "Confirm your identity with Smart-ID" },
  },
  ```
  `lt/appShell.ts` under `dashboard`:
  ```ts
  onboarding: {
    title: "Pasiruoškite užsakymams",
    subtitle: "Šeimininkai galės jus užsakyti, kai atliksite šiuos žingsnius.",
    steps: { photo: "Įkelkite profilio nuotrauką", bio: "Parašykite kelis žodžius apie save", services: "Pasirinkite paslaugas", prices: "Nurodykite kiekvienos paslaugos kainą", verified: "Patvirtinkite tapatybę su Smart-ID" },
  },
  ```

- [ ] **Step 6:** `npx vitest run src/components/__tests__/dashboardView.test.tsx src/lib/i18n && npm run typecheck`. Expected: PASS, tsc 0.
- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/OnboardingRing.tsx src/components/dashboard/DashboardView.tsx "src/app/(app)/dashboard/page.tsx" src/components/__tests__/dashboardView.test.tsx src/lib/i18n/en/appShell.ts src/lib/i18n/lt/appShell.ts
git commit -m "Show new sitters a progress ring towards being bookable"
```

---

## Part D: Availability (spec 2026-09-16)

**Deviations from the spec, each for a stated reason. Tell Lukas before Task 9:**
1. `sitter_is_free(...) → boolean` becomes **`sitter_availability_problem(...) → text`** (`null | 'sitter_unavailable' | 'already_booked'`), with an optional `p_ignore_booking`. The trigger needs the reason for its hint and must skip the row being accepted. A boolean wrapper would have no caller.
2. **`sitter_busy_days` returns `(day, kind)`** with `kind` `'off'` or `'booked'`, not bare dates. The spec's calendar has distinct "away" and "booked" states. The form also needs to tell a day off (the database will refuse, so block) from a booked day (a stay ending at 10:00 and one starting at 14:00 the same day do not clash, so warn only). It still never says by whom.
3. **`sitter_days_off` SELECT is own rows only**, tighter than the spec's "all authenticated". Other people read through `sitter_busy_days`, so the table itself needs no wider read.
4. The browse filter works at **day level**: a signed booking touching any day in the range hides the sitter. That is slightly strict at handover days, and fine for a search filter.

### Task 8: `availability.ts`, pure rules

**Files:**
- Create: `src/lib/availability.ts`
- Test: `src/lib/__tests__/availability.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type AvailabilityProblem = "sitter_unavailable" | "already_booked";
  export type BusyKind = "off" | "booked";
  export function vilniusDay(instant: Date | string): string;            // "YYYY-MM-DD" in Europe/Vilnius
  export function addDays(day: string, n: number): string;
  export function daysInStay(startIso: string, endIso: string): string[]; // Vilnius days touched by [start, end)
  export function daysBetween(from: string, to: string): string[];       // inclusive
  export function busyMap(rows: { day: string; kind: BusyKind }[]): Map<string, BusyKind>; // 'booked' wins
  export function formClash(startIso: string, endIso: string, busy: Map<string, BusyKind>): { block: boolean; kind: BusyKind } | null;
  export function monthGrid(year: number, month0: number): (string | null)[]; // Monday-first, padded to whole weeks
  export function problemFromHint(hint: string | undefined | null): AvailabilityProblem | null;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import { vilniusDay, addDays, daysInStay, daysBetween, busyMap, formClash, monthGrid, problemFromHint } from "@/lib/availability";

describe("vilniusDay", () => {
  it("uses Vilnius, not UTC: 23:30 UTC on the 30th is already the 1st in Vilnius (UTC+3 in summer)", () => {
    expect(vilniusDay("2026-09-30T23:30:00Z")).toBe("2026-10-01");
  });
  it("handles winter time (UTC+2)", () => {
    expect(vilniusDay("2026-12-31T22:30:00Z")).toBe("2027-01-01");
  });
});

describe("addDays / daysBetween", () => {
  it("crosses month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(daysBetween("2026-09-29", "2026-10-02")).toEqual(["2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  });
  it("an inverted range is empty", () => {
    expect(daysBetween("2026-10-02", "2026-10-01")).toEqual([]);
  });
});

describe("daysInStay (half-open, mirrors the SQL)", () => {
  it("a stay ending at midnight does not touch the next day", () => {
    expect(daysInStay("2026-10-01T09:00:00+03:00", "2026-10-03T00:00:00+03:00")).toEqual(["2026-10-01", "2026-10-02"]);
  });
  it("a one-hour walk covers one day", () => {
    expect(daysInStay("2026-10-01T09:00:00+03:00", "2026-10-01T10:00:00+03:00")).toEqual(["2026-10-01"]);
  });
  it("crosses a month end", () => {
    expect(daysInStay("2026-09-30T09:00:00+03:00", "2026-10-01T09:00:00+03:00")).toEqual(["2026-09-30", "2026-10-01"]);
  });
});

describe("busyMap", () => {
  it("booked wins when a day is both off and booked", () => {
    const m = busyMap([{ day: "2026-10-01", kind: "off" }, { day: "2026-10-01", kind: "booked" }, { day: "2026-10-02", kind: "off" }]);
    expect(m.get("2026-10-01")).toBe("booked");
    expect(m.get("2026-10-02")).toBe("off");
  });
});

describe("formClash", () => {
  const busy = busyMap([{ day: "2026-10-02", kind: "off" }, { day: "2026-10-05", kind: "booked" }]);
  it("a day off inside the stay blocks, since the database refuses exactly this", () => {
    expect(formClash("2026-10-01T09:00:00+03:00", "2026-10-03T09:00:00+03:00", busy)).toEqual({ block: true, kind: "off" });
  });
  it("a booked day only warns, since times may not overlap", () => {
    expect(formClash("2026-10-05T14:00:00+03:00", "2026-10-06T09:00:00+03:00", busy)).toEqual({ block: false, kind: "booked" });
  });
  it("a free stay is null", () => {
    expect(formClash("2026-10-07T09:00:00+03:00", "2026-10-08T09:00:00+03:00", busy)).toBeNull();
  });
  it("half-filled input is null", () => {
    expect(formClash("", "", busy)).toBeNull();
  });
});

describe("monthGrid", () => {
  it("October 2026 starts on a Thursday, so three blanks come first (Monday-first)", () => {
    const g = monthGrid(2026, 9);
    expect(g.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(g.length % 7).toBe(0);
    expect(g.filter(Boolean)).toHaveLength(31);
  });
});

describe("problemFromHint", () => {
  it("maps the two database hints and ignores the rest", () => {
    expect(problemFromHint("sitter_unavailable")).toBe("sitter_unavailable");
    expect(problemFromHint("already_booked")).toBe("already_booked");
    expect(problemFromHint("price_changed")).toBeNull();
    expect(problemFromHint(undefined)).toBeNull();
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/__tests__/availability.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
/**
 * Sitter availability, mirrored from the database (migration <stamp>_sitter_availability).
 * The database is the boundary; this says the same thing earlier and in the visitor's language.
 *
 * Days are calendar days in Europe/Vilnius, because a day off is a day to a person, not a UTC
 * window. A stay [start, end) touches every Vilnius day from start's day to the day of the last
 * instant before end, matching `(p_end - interval '1 microsecond') at time zone 'Europe/Vilnius'`.
 */
export type AvailabilityProblem = "sitter_unavailable" | "already_booked";
export type BusyKind = "off" | "booked";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vilnius", year: "numeric", month: "2-digit", day: "2-digit" });

export function vilniusDay(instant: Date | string): string {
  return dayFmt.format(new Date(instant));
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysInStay(startIso: string, endIso: string): string[] {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
  return daysBetween(vilniusDay(new Date(start)), vilniusDay(new Date(end - 1)));
}

export function busyMap(rows: { day: string; kind: BusyKind }[]): Map<string, BusyKind> {
  const map = new Map<string, BusyKind>();
  for (const { day, kind } of rows) if (map.get(day) !== "booked") map.set(day, kind);
  return map;
}

/** What the booking form should say about a typed stay: block on a day off, warn on a booked day. */
export function formClash(startIso: string, endIso: string, busy: Map<string, BusyKind>): { block: boolean; kind: BusyKind } | null {
  if (!startIso || !endIso) return null;
  const days = daysInStay(startIso, endIso);
  if (days.some((d) => busy.get(d) === "off")) return { block: true, kind: "off" };
  if (days.some((d) => busy.get(d) === "booked")) return { block: false, kind: "booked" };
  return null;
}

export function monthGrid(year: number, month0: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month0, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const count = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= count; d++) cells.push(new Date(Date.UTC(year, month0, d)).toISOString().slice(0, 10));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function problemFromHint(hint: string | undefined | null): AvailabilityProblem | null {
  return hint === "sitter_unavailable" || hint === "already_booked" ? hint : null;
}
```

Note: the `datetime-local` values in `/bookings/new` are local strings without an offset. Pass `new Date(form.start_at).toISOString()` into `formClash`, the same conversion the submit uses.

- [ ] **Step 4:** Run it again. Expected: PASS. (Vitest runs Node with full ICU, so `Europe/Vilnius` resolves. If CI Node 22 disagrees, that is the first suspect.)
- [ ] **Step 5: Commit**

```bash
git add src/lib/availability.ts src/lib/__tests__/availability.test.ts
git commit -m "Add availability rules that mirror the database, in Vilnius days"
```

### Task 9: Migration (write → dry-run → APPLY ONLY WITH LUKAS'S YES)

**Files:**
- Create: `supabase/migrations/20260922120000_sitter_availability.sql` (renamed to the stamped version after apply)
- Modify: `src/lib/database.types.ts` (copy the new table + 3 functions from generator output; do not regenerate the whole file, see `project-reference`)

- [ ] **Step 1: Write the migration**

```sql
-- Sitter availability: days off, enforced by the database.
-- Spec: docs/superpowers/specs/2026-09-16-sitter-availability-design.md (deviations: plan 2026-09-22, Part D).
-- Mirrored in src/lib/availability.ts; change both.

create table public.sitter_days_off (
  sitter_id  uuid not null references public.profiles(id) on delete cascade,
  day        date not null,
  created_at timestamptz not null default now(),
  primary key (sitter_id, day)
);

alter table public.sitter_days_off enable row level security;

-- Own rows only. Everyone else learns busy days through sitter_busy_days, which never says why.
create policy sitter_days_off_select_own on public.sitter_days_off
  for select to authenticated using (sitter_id = (select auth.uid()));
create policy sitter_days_off_insert_own on public.sitter_days_off
  for insert to authenticated with check (sitter_id = (select auth.uid()));
create policy sitter_days_off_delete_own on public.sitter_days_off
  for delete to authenticated using (sitter_id = (select auth.uid()));

revoke all on public.sitter_days_off from anon, authenticated;
grant select, insert, delete on public.sitter_days_off to authenticated;

-- The one truth. Null when free; otherwise the hint the app maps to a sentence.
-- DEFINER because it must see days off and signed bookings the caller cannot read.
-- Half-open: a stay ending the morning another begins does not clash.
create or replace function public.sitter_availability_problem(
  p_sitter uuid, p_start timestamptz, p_end timestamptz, p_ignore_booking uuid default null
) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.sitter_days_off d
      where d.sitter_id = p_sitter
        and d.day between (p_start at time zone 'Europe/Vilnius')::date
                      and ((p_end - interval '1 microsecond') at time zone 'Europe/Vilnius')::date
    ) then 'sitter_unavailable'
    when exists (
      select 1 from public.bookings b
      where b.sitter_id = p_sitter and b.status = 'signed'
        and b.id is distinct from p_ignore_booking
        and b.start_at < p_end and p_start < b.end_at
    ) then 'already_booked'
  end
$$;

create or replace function public.enforce_sitter_availability()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare
  v_problem text;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then
    return new;
  end if;
  if tg_op = 'INSERT' or (new.status = 'signed' and old.status is distinct from 'signed') then
    v_problem := public.sitter_availability_problem(
      new.sitter_id, new.start_at, new.end_at,
      case when tg_op = 'UPDATE' then new.id end);
    if v_problem is not null then
      raise exception 'The sitter is not free for these dates'
        using errcode = 'check_violation', hint = v_problem;
    end if;
  end if;
  return new;
end
$$;

create trigger enforce_sitter_availability
  before insert or update of status on public.bookings
  for each row execute function public.enforce_sitter_availability();

-- Days in [p_from, p_to] that are taken, and whether by a day off or an accepted booking.
-- Never by whom. Capped at ~13 months per call.
create or replace function public.sitter_busy_days(p_sitter uuid, p_from date, p_to date)
returns table (day date, kind text)
language sql stable security definer set search_path = ''
as $$
  select d.day, 'off'::text
  from public.sitter_days_off d
  where d.sitter_id = p_sitter and d.day between p_from and p_to and p_to - p_from <= 400
  union
  select g::date, 'booked'::text
  from public.bookings b
  cross join lateral generate_series(
    (b.start_at at time zone 'Europe/Vilnius')::date,
    ((b.end_at - interval '1 microsecond') at time zone 'Europe/Vilnius')::date,
    interval '1 day') g
  where b.sitter_id = p_sitter and b.status = 'signed'
    and p_to - p_from <= 400
    and b.end_at   > (p_from::timestamp at time zone 'Europe/Vilnius')
    and b.start_at < ((p_to + 1)::timestamp at time zone 'Europe/Vilnius')
    and g::date between p_from and p_to
  order by 1
$$;

-- Sitters browse hides for a day range (inclusive), in one call per page load.
create or replace function public.sitters_unavailable_between(p_from date, p_to date)
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select d.sitter_id from public.sitter_days_off d where d.day between p_from and p_to
  union
  select b.sitter_id from public.bookings b
  where b.status = 'signed'
    and b.end_at   > (p_from::timestamp at time zone 'Europe/Vilnius')
    and b.start_at < ((p_to + 1)::timestamp at time zone 'Europe/Vilnius')
$$;

revoke all on function public.sitter_availability_problem(uuid, timestamptz, timestamptz, uuid) from public, anon;
revoke all on function public.enforce_sitter_availability() from public, anon, authenticated;
revoke all on function public.sitter_busy_days(uuid, date, date) from public, anon;
revoke all on function public.sitters_unavailable_between(date, date) from public, anon;
grant execute on function public.sitter_availability_problem(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.sitter_busy_days(uuid, date, date) to authenticated;
grant execute on function public.sitters_unavailable_between(date, date) to authenticated;
```

- [ ] **Step 2: Dry run on prod inside a transaction that rolls back** (ask first; nothing persists). Paste the migration between `begin;` and the tests below, then `rollback;`. All test data is created inside the transaction as `postgres`, with `booking_event_notify` disabled so no notification or email is written:

```sql
begin;
alter table public.bookings disable trigger booking_event_notify;
-- <migration body here>

-- Fixtures: one seed sitter S, one seed owner O with pet P.
create temp table t as
select (select pr.id from public.profiles pr join auth.users u on u.id = pr.id where pr.verification_method = 'seed' and u.email like '%@petbnb.test' order by pr.id limit 1) s,
       pe.owner_id o, pe.id p
from public.pets pe join auth.users u on u.id = pe.owner_id where u.email like '%@petbnb.test' order by pe.id limit 1;

insert into public.sitter_days_off (sitter_id, day) select s, current_date + 10 from t;
insert into public.bookings (owner_id, sitter_id, pet_id, service, start_at, end_at, status, days)
select o, s, p, 'walking', (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '9 hours',
       (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '10 hours', 'signed', 1 from t;

-- 1. Function answers: expect sitter_unavailable, already_booked, null (handover later that day).
select public.sitter_availability_problem(s, (current_date + 10)::timestamp at time zone 'Europe/Vilnius' + interval '9 hours', (current_date + 11)::timestamp at time zone 'Europe/Vilnius' + interval '9 hours') from t;
select public.sitter_availability_problem(s, (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '9 hours 30 minutes', (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '11 hours') from t;
select public.sitter_availability_problem(s, (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '14 hours', (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '15 hours') from t;

-- 2. Busy days: expect (current_date+10, off) and (current_date+20, booked).
select * from public.sitter_busy_days((select s from t), current_date, current_date + 30);

-- 3. As the owner, an insert over the day off is refused with hint sitter_unavailable.
select set_config('request.jwt.claims', json_build_object('sub', o, 'role', 'authenticated')::text, true) from t;
set local role authenticated;
do $$ begin
  insert into public.bookings (owner_id, sitter_id, pet_id, service, start_at, end_at, status)
  select o, s, p, 'walking', (current_date + 10)::timestamp at time zone 'Europe/Vilnius' + interval '9 hours',
         (current_date + 10)::timestamp at time zone 'Europe/Vilnius' + interval '10 hours', 'pending' from t;
  raise exception 'EXPECTED A REFUSAL';
exception when check_violation then raise notice 'refused as expected: %', sqlerrm;
end $$;
reset role;

-- 4. A cancelled booking frees its dates: expect null.
update public.bookings set status = 'cancelled' where sitter_id = (select s from t) and start_at::date >= current_date + 19 and status = 'signed';
select public.sitter_availability_problem(s, (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '9 hours 30 minutes', (current_date + 20)::timestamp at time zone 'Europe/Vilnius' + interval '11 hours') from t;

-- 5. Catalogs.
select tgname from pg_trigger where tgrelid = 'public.bookings'::regclass and tgname = 'enforce_sitter_availability';
select proname, prosecdef, proconfig from pg_proc where proname in ('sitter_availability_problem','sitter_busy_days','sitters_unavailable_between','enforce_sitter_availability');
select policyname, cmd from pg_policies where tablename = 'sitter_days_off';
rollback;
```

`execute_sql` returns only the last result, so run it in pieces if needed, but always inside one `begin … rollback`. Also test "a sitter cannot accept a second overlapping request" the same way: two `pending` rows, impersonate S, update the first to `signed` (passes), then the second (refused, `already_booked`). If `enforce_booking_rules` refuses the fixture updates for `authenticated` (price rules on accept), set `agreed_price = asking_price`, or leave `asking_price` null so the status-only accept path applies.

- [ ] **Step 3: Ask Lukas for the yes.** Say what it adds: 1 table, 3 functions, 1 trigger; nothing existing changes; seeded sitters stay bookable.
- [ ] **Step 4: Apply** with MCP `apply_migration` (name `sitter_availability`). Rename the local file to the stamped version from `list_migrations`.
- [ ] **Step 5: Verify from catalogs** (queries 5 above, without the rollback wrapper) and `get_advisors` security. Expected: no new advisor beyond the known list in `project-notes` thread 11.
- [ ] **Step 6: Types.** Run MCP `generate_typescript_types`, copy only `sitter_days_off` (Tables) and the three functions (Functions) into `src/lib/database.types.ts`, then `npm run typecheck`. Expected: 0.
- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/<stamp>_sitter_availability.sql src/lib/database.types.ts
git commit -m "Let sitters mark days off, and make the database refuse bookings that clash"
```

### Task 10: `AvailabilityCalendar` + `useBusyDays`

**Files:**
- Create: `src/components/AvailabilityCalendar.tsx`, `src/hooks/useBusyDays.ts`
- Modify: `src/lib/i18n/en/appPages.ts`, `src/lib/i18n/lt/appPages.ts` (`appPages.availability`)
- Test: `src/components/__tests__/AvailabilityCalendar.test.tsx`

**Interfaces:**
- Consumes: `monthGrid`, `addDays`, `busyMap`, `BusyKind` (Task 8); RPC `sitter_busy_days` (Task 9).
- Produces:
  ```ts
  // useBusyDays.ts
  export function useBusyDays(sitterId: string | null, from: string, to: string): { busy: Map<string, BusyKind>; reload: () => void; loading: boolean };
  // AvailabilityCalendar.tsx
  export default function AvailabilityCalendar(props: {
    busy: Map<string, BusyKind>;
    today: string;               // "YYYY-MM-DD", from vilniusDay(new Date())
    mode: "edit" | "view";
    onToggle?: (day: string, makeOff: boolean) => void;  // edit mode only; never called for booked or past days
    savingDay?: string | null;
  }): JSX.Element;
  ```

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import { busyMap } from "@/lib/availability";

const today = "2026-10-10";
const busy = busyMap([{ day: "2026-10-12", kind: "off" }, { day: "2026-10-14", kind: "booked" }]);
const day = (iso: string) => screen.getByRole("button", { name: new RegExp(iso) });

describe("AvailabilityCalendar", () => {
  it("shows two months, starting with today's", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="view" />);
    expect(screen.getAllByRole("grid")).toHaveLength(2);
  });

  it("edit mode: tapping a free day asks to make it a day off, tapping a day off frees it", () => {
    const onToggle = vi.fn();
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={onToggle} />);
    fireEvent.click(day("2026-10-11"));
    fireEvent.click(day("2026-10-12"));
    expect(onToggle.mock.calls).toEqual([["2026-10-11", true], ["2026-10-12", false]]);
  });

  it("booked and past days cannot be toggled", () => {
    const onToggle = vi.fn();
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={onToggle} />);
    expect(day("2026-10-14")).toBeDisabled();
    expect(day("2026-10-09")).toBeDisabled();
  });

  it("view mode: nothing is a toggle, and every state is said in words", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="view" />);
    expect(day("2026-10-12")).toBeDisabled();
    expect(day("2026-10-12")).toHaveAccessibleName(/appPages\.availability\.state\.off/);
    expect(day("2026-10-14")).toHaveAccessibleName(/appPages\.availability\.state\.booked/);
    expect(day("2026-10-11")).toHaveAccessibleName(/appPages\.availability\.state\.free/);
  });

  it("every day is a real button, so it cannot submit the profile form around it", () => {
    render(<AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={() => {}} />);
    expect(day("2026-10-11")).toHaveAttribute("type", "button");
  });
});
```

- [ ] **Step 2:** `npx vitest run src/components/__tests__/AvailabilityCalendar.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement `useBusyDays.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { busyMap, type BusyKind } from "@/lib/availability";

/** One RPC read of a sitter's taken days. Failure renders as "all free", since the database still refuses clashes. */
export function useBusyDays(sitterId: string | null, from: string, to: string) {
  const [busy, setBusy] = useState<Map<string, BusyKind>>(new Map());
  const [loading, setLoading] = useState(Boolean(sitterId));
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!sitterId) return;
    let active = true;
    setLoading(true);
    supabase.rpc("sitter_busy_days", { p_sitter: sitterId, p_from: from, p_to: to }).then(({ data }) => {
      if (!active) return;
      setBusy(busyMap(((data ?? []) as { day: string; kind: string }[]).map((r) => ({ day: r.day, kind: r.kind === "booked" ? "booked" : "off" }))));
      setLoading(false);
    });
    return () => { active = false; };
  }, [sitterId, from, to, tick]);

  return { busy, reload, loading };
}
```

- [ ] **Step 4: Implement `AvailabilityCalendar.tsx`**

```tsx
"use client";
import { useLanguage } from "@/context/LanguageContext";
import { monthGrid, type BusyKind } from "@/lib/availability";
import { cn } from "@/lib/utils";

const INTL = { en: "en-GB", lt: "lt-LT" } as const;
// 2026-10-05 was a Monday: used only to print weekday names Monday-first.
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 5 + i)));

export default function AvailabilityCalendar({ busy, today, mode, onToggle, savingDay }: {
  busy: Map<string, BusyKind>; today: string; mode: "edit" | "view";
  onToggle?: (day: string, makeOff: boolean) => void; savingDay?: string | null;
}) {
  const { t, locale } = useLanguage();
  const intl = INTL[locale as keyof typeof INTL] ?? "en-GB";
  const [y, m] = today.split("-").map(Number);
  const months = [0, 1].map((k) => new Date(Date.UTC(y, m - 1 + k, 1)));
  const monthName = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(intl, { weekday: "short", timeZone: "UTC" });
  const dayName = new Intl.DateTimeFormat(intl, { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2">
        {months.map((first) => {
          const cells = monthGrid(first.getUTCFullYear(), first.getUTCMonth());
          const label = monthName.format(first);
          return (
            <div key={label}>
              <h3 className="mb-2 text-sm font-semibold capitalize text-ink">{label}</h3>
              <div role="grid" aria-label={label} className="grid grid-cols-7 gap-1">
                {WEEK.map((d) => <span key={d.toISOString()} role="columnheader" className="text-center text-[11px] font-medium uppercase text-ink-soft">{weekday.format(d)}</span>)}
                {cells.map((iso, i) => {
                  if (!iso) return <span key={`pad-${i}`} role="gridcell" />;
                  const kind = busy.get(iso);
                  const past = iso < today;
                  const state = kind === "booked" ? "booked" : kind === "off" ? "off" : "free";
                  const disabled = mode === "view" || past || state === "booked" || savingDay === iso;
                  return (
                    <span key={iso} role="gridcell">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => onToggle?.(iso, state === "free")}
                        aria-label={`${iso} ${dayName.format(new Date(`${iso}T00:00:00Z`))}: ${t(`appPages.availability.state.${state}`)}`}
                        aria-pressed={mode === "edit" && !past && state !== "booked" ? state === "off" : undefined}
                        className={cn(
                          "grid min-h-11 w-full place-items-center rounded-[10px] text-sm tabular-nums transition-colors",
                          state === "free" && "bg-white/70 text-ink",
                          state === "off" && "bg-amber/15 text-amber-strong line-through decoration-amber-strong/60",
                          state === "booked" && "bg-brand text-white",
                          past && "opacity-35",
                          iso === today && "ring-2 ring-ink/70",
                          !disabled && "hover:ring-2 hover:ring-brand cursor-pointer",
                          savingDay === iso && "animate-pulse",
                        )}
                      >
                        {Number(iso.slice(8))}
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-4 text-xs text-ink-soft">
        {(["free", "off", "booked"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded", s === "free" && "bg-white ring-1 ring-ink/15", s === "off" && "bg-amber/30", s === "booked" && "bg-brand")} aria-hidden="true" />
            {t(`appPages.availability.state.${s}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Check that `bg-amber`, `text-amber-strong` and `bg-brand` exist as theme tokens (they are used in `Stars.tsx` and `DashboardView.tsx`). `amber/15` needs the token to be a colour Tailwind can apply opacity to. If it is not, use `bg-amber-soft`, or whatever the `glass-system.test.ts` palette lists.

- [ ] **Step 5: Strings.** `en/appPages.ts`, new top-level section:
  ```ts
  availability: {
    heading: "Availability",
    editHint: "Tap the days you can't take pets. Everyone is free by default.",
    viewHint: "Days marked away or booked can't be requested.",
    state: { free: "Free", off: "Away", booked: "Booked" },
    saveFailed: "Couldn't save that day. Please try again.",
  },
  ```
  `lt/appPages.ts`:
  ```ts
  availability: {
    heading: "Užimtumas",
    editHint: "Pažymėkite dienas, kai negalite priimti gyvūnų. Numatyta, kad esate laisvi.",
    viewHint: "Dienų, pažymėtų kaip „Išvykęs“ ar „Užimta“, užsakyti negalima.",
    state: { free: "Laisva", off: "Išvykęs", booked: "Užimta" },
    saveFailed: "Nepavyko išsaugoti dienos. Bandykite dar kartą.",
  },
  ```

- [ ] **Step 6:** Run the calendar tests + `src/lib/i18n`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add src/components/AvailabilityCalendar.tsx src/hooks/useBusyDays.ts src/components/__tests__/AvailabilityCalendar.test.tsx src/lib/i18n/en/appPages.ts src/lib/i18n/lt/appPages.ts
git commit -m "Add a two-month availability calendar with free, away and booked days"
```

### Task 11: Editable calendar in `/profile` (Sitter tab)

**Files:**
- Modify: `src/app/(app)/profile/page.tsx`: a new glass card inside the `isSitter` block, after the prices fieldset's card and before the submit button.

- [ ] **Step 1: Implement.** Toggling writes immediately and does not wait for "Save profile", because it is a separate table:

```tsx
const today = vilniusDay(new Date());
const horizon = addDays(today, 70);
const { busy, reload } = useBusyDays(isSitter ? user?.id ?? null : null, today, horizon);
const [savingDay, setSavingDay] = useState<string | null>(null);
const [dayError, setDayError] = useState("");

const toggleDay = async (day: string, makeOff: boolean) => {
  if (!user) return;
  setSavingDay(day); setDayError("");
  const { error: err } = makeOff
    ? await supabase.from("sitter_days_off").insert({ sitter_id: user.id, day })
    : await supabase.from("sitter_days_off").delete().eq("sitter_id", user.id).eq("day", day);
  if (err) setDayError(t("appPages.availability.saveFailed"));
  reload();
  setSavingDay(null);
};
```

```tsx
<div className="glass-card rounded-2xl border p-6 sm:p-7">
  <h2 className="font-medium text-ink">{t("appPages.availability.heading")}</h2>
  <p className="text-sm text-ink-soft mt-0.5 mb-4">{t("appPages.availability.editHint")}</p>
  <AvailabilityCalendar busy={busy} today={today} mode="edit" onToggle={toggleDay} savingDay={savingDay} />
  {dayError && <p role="alert" className="mt-3 text-sm text-danger">{dayError}</p>}
</div>
```

Hooks go at the top of the component with the others, never inside the JSX branch.

- [ ] **Step 2: Test.** Add to an existing profile test file, or create `src/components/__tests__/profileAvailability.test.tsx` following the Supabase mock pattern in `browsePage.test.tsx`: with `is_sitter` true, the calendar grid renders, and clicking a free day calls `from("sitter_days_off").insert` with `{ sitter_id, day }`, while submitting nothing. Run it and see it pass.
- [ ] **Step 3:** `npm run typecheck`. Expected: 0.
- [ ] **Step 4: Commit** `git add "src/app/(app)/profile/page.tsx" <test file>` → `git commit -m "Let sitters tap their days off on their profile"`.

### Task 12: Read-only calendar on `/browse/[id]`

**Files:**
- Modify: `src/app/(app)/browse/[id]/page.tsx`: a new glass card between "Services & rate" and "Reviews".

- [ ] **Step 1: Implement** (hook above the early returns, like `useSitterRatings`):

```tsx
const today = vilniusDay(new Date());
const { busy } = useBusyDays(sitter?.id ?? null, today, addDays(today, 70));
```

```tsx
<motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}
  className="glass-card rounded-2xl border p-6">
  <h2 className="font-semibold text-ink">{t("appPages.availability.heading")}</h2>
  <p className="text-sm text-ink-soft mt-0.5 mb-4">{t("appPages.availability.viewHint")}</p>
  <AvailabilityCalendar busy={busy} today={today} mode="view" />
</motion.div>
```

- [ ] **Step 2: Test.** Extend the sitter-profile test, if one exists (`grep -l "browse/\[id\]" src/components/__tests__`), or add one with the mocked RPC returning `[{ day, kind: "off" }]`. The grid renders and that day's accessible name contains `state.off`. Run it and see it pass.
- [ ] **Step 3: Commit** → `git commit -m "Show owners which days a sitter is taken before they ask"`.

### Task 13: Date filter in `/browse`

**Files:**
- Modify: `src/lib/browse-filters.ts`: `filtersFromSearch` also returns `from` and `to` (valid `YYYY-MM-DD`, `from <= to`, else both null).
- Modify: `src/app/(app)/browse/page.tsx`
- Test: `src/lib/__tests__/browse-filters.test.ts`, `src/components/__tests__/browsePage.test.tsx`

- [ ] **Step 1: Failing tests** for `filtersFromSearch("?from=2026-10-01&to=2026-10-05")` → `from: "2026-10-01", to: "2026-10-05"`; `?from=2026-10-05&to=2026-10-01` → both null; `?from=nonsense` → both null. In `browsePage.test.tsx`: with both dates set and the RPC mock returning one sitter's id, that sitter's card is gone and the count drops by one.
- [ ] **Step 2:** Run them and watch them fail.
- [ ] **Step 3: Implement**
  - `browse-filters.ts`:
    ```ts
    const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
    // inside filtersFromSearch:
    const rawFrom = params.get("from"), rawTo = params.get("to");
    const datesOk = rawFrom && rawTo && ISO_DAY.test(rawFrom) && ISO_DAY.test(rawTo) && rawFrom <= rawTo;
    return { city, service, from: datesOk ? rawFrom : null, to: datesOk ? rawTo : null };
    ```
  - `browse/page.tsx`: state `from`/`to` (strings, `""` = unset), seeded from `filtersFromSearch`. Add two `<input type="date" min={today}>` in the chip row (`h-11 rounded-full border border-ink/10 bg-white/80 px-4 text-sm`, `aria-label={t("appPages.browse.fromLabel")}` / `toLabel`). One effect:
    ```ts
    const [unavailable, setUnavailable] = useState<Set<string>>(new Set());
    useEffect(() => {
      if (!from || !to || from > to) { setUnavailable(new Set()); return; }
      supabase.rpc("sitters_unavailable_between", { p_from: from, p_to: to })
        .then(({ data }) => setUnavailable(new Set((data ?? []) as string[])));
    }, [from, to]);
    ```
    In `beforeService` add `if (unavailable.has(s.id)) return false;`. Add `from || to` to `anyFilter`, and reset both in `clearAll`. Mirror them into the URL with `history.replaceState` so a demo link reproduces the view.
  - Strings: `appPages.browse.fromLabel` "From" / "Nuo", `toLabel` "To" / "Iki".
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5: Commit** → `git commit -m "Filter browse to sitters free on the chosen dates"`.

### Task 14: Clashes in the booking form and on accept

**Files:**
- Modify: `src/app/(app)/bookings/new/page.tsx`, `src/app/(app)/bookings/page.tsx` (`handleAccept`, `handleUpdateStatus`), `src/components/MessageThread.tsx:385`
- Modify: i18n `appPages.bookingsNew.{sitterUnavailable, alreadyBooked, busyWarning}`, `appPages.bookings.{sitterUnavailable, alreadyBooked}`, `messages.offer.{sitterUnavailable, alreadyBooked}`
- Test: extend the booking-form test (`grep -l "bookings/new" src/components/__tests__`, or add `bookingsNewAvailability.test.tsx`)

- [ ] **Step 1: Failing tests.** With the RPC mock returning `{ day: <start day>, kind: "off" }`: after both dates are typed, an alert with `appPages.bookingsNew.sitterUnavailable` shows and submit is disabled. With `kind: "booked"`: a non-alert note `appPages.bookingsNew.busyWarning` shows and submit stays enabled. With the RPC `create_booking_request` mock erroring `{ hint: "already_booked" }`, the error text is `appPages.bookingsNew.alreadyBooked`.
- [ ] **Step 2:** Run them and watch them fail.
- [ ] **Step 3: Implement**
  - Form: `const { busy } = useBusyDays(bookableSitter?.id ?? null, today, addDays(today, 400));` and
    ```ts
    const clash = form.start_at && form.end_at && !rangeProblem
      ? formClash(new Date(form.start_at).toISOString(), new Date(form.end_at).toISOString(), busy) : null;
    ```
    Add `!clash?.block` to `canSubmit`. Under the date grid:
    ```tsx
    {clash?.block && <p role="alert" className="text-sm text-danger">{t("appPages.bookingsNew.sitterUnavailable")}</p>}
    {clash && !clash.block && <p className="text-sm text-amber-strong">{t("appPages.bookingsNew.busyWarning")}</p>}
    ```
    In the submit error branch:
    ```ts
    const problem = problemFromHint(err.hint);
    setError(t(problem === "sitter_unavailable" ? "appPages.bookingsNew.sitterUnavailable" : problem === "already_booked" ? "appPages.bookingsNew.alreadyBooked" : "appPages.bookingsNew.submitError"));
    ```
  - `bookings/page.tsx` `handleAccept` and `handleUpdateStatus`, and `MessageThread.tsx:385`: before the existing `price_changed` check, map `problemFromHint(error.hint)` to the matching `…sitterUnavailable` / `…alreadyBooked` key.
  - Strings (EN / LT):
    - `bookingsNew.sitterUnavailable`: "This sitter is away on some of these days. Pick other dates." / "Šiomis dienomis globėjas išvykęs. Pasirinkite kitas datas."
    - `bookingsNew.alreadyBooked`: "This sitter was booked for these dates in the meantime. Pick other dates." / "Šioms datoms globėjas jau užsakytas. Pasirinkite kitas datas."
    - `bookingsNew.busyWarning`: "The sitter already has a booking on one of these days. They may not be able to accept." / "Vieną iš šių dienų globėjas jau turi užsakymą, todėl gali nepriimti."
    - `bookings.sitterUnavailable` / `messages.offer.sitterUnavailable`: "You've marked some of these days as away. Free them in your profile to accept." / "Kai kurias šias dienas pažymėjote kaip išvykimo. Atlaisvinkite jas profilyje, kad priimtumėte."
    - `bookings.alreadyBooked` / `messages.offer.alreadyBooked`: "You already accepted a booking that overlaps these dates." / "Jau priėmėte užsakymą, kuris sutampa su šiomis datomis."
- [ ] **Step 4:** Run the tests, `npm run typecheck`. Expected: PASS, 0.
- [ ] **Step 5: Commit** → `git commit -m "Say when a sitter isn't free, before sending and when accepting"`.

### Task 15: Demo days off on prod (NEEDS LUKAS'S YES)

Browse looks unchanged until someone is away (spec, Risks). Mark **3 seed sitters** away for a few days next week, so the calendar and the date filter have something to show.

- [ ] **Step 1:** Ask for the yes. Then:

```sql
insert into public.sitter_days_off (sitter_id, day)
select pr.id, current_date + g
from (select pr.id from public.profiles pr join auth.users u on u.id = pr.id
      where pr.verification_method = 'seed' and u.email like '%@petbnb.test' order by pr.id desc limit 3) pr
cross join generate_series(5, 9) g
on conflict do nothing;
select count(*) from public.sitter_days_off;  -- 15
```

No trigger on this table sends anything. Rollback: `delete from public.sitter_days_off where sitter_id in (<those 3 ids>);`.

---

## Final: verification (the "check and test" day)

- [ ] `npm test`: all green. Record the file/test counts (baseline **80 / 1710**).
- [ ] `npm run typecheck` → 0; `npm run build` → 0.
- [ ] Sandboxes in `src/app/dev/` (untracked, never committed): `/dev/booking` shows the timeline in every status; `/dev/dashboard` shows the ring at 0/60/100%; a new `/dev/availability` shows both calendar modes. Check each at **1280 and 390px, EN and LT**, and with the OS "reduce motion" setting on (no pulse, ring drawn at once).
- [ ] Prod click-through (after Lukas pushes): browse cards show stars; one seed sitter's profile shows reviews + calendar with away days; browse date filter hides the 3 away sitters for next week; booking over an away day is blocked inline.
- [ ] Update `project-notes.md`: checkpoint + Status rewrite (health numbers, branch, migrations applied, seed counts).
