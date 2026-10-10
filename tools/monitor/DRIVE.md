# The drive — how agents work on petbnb

Lukas watches petbnb grow on the monitor (`npm run monitor`, http://127.0.0.1:4545).
Every agent session works in the open there: what it is doing, what it proposes,
what it built. Read this before you change anything.

## Mission

Each session leaves petbnb able to do a little more, or reach a little further:
a new connection (social login, calendars, sharing, maps, messaging…), a new
capability, or a sharper existing one. Small, finished and demo-ready beats big
and half-done: the site is a prototype for a thesis defence (2027-01-26/27).

## Start of every session

1. Read the project notes in memory, as always.
2. `node tools/monitor/agent.mjs board`: see what is proposed, approved, in review.
3. Pick your role:
   - an **approved** item is waiting → **conductor**
   - nothing approved → **evaluator**
   - Lukas asked for something specific → do that, and still report it here.

## Evaluator — look, judge, propose

```sh
node tools/monitor/agent.mjs start evaluator "<what you will look at>"
node tools/monitor/agent.mjs step "<what you found>" --feature <feature-id>
node tools/monitor/agent.mjs propose "<title>" --why "<value for the demo>" --effort S|M|L \
     --needs "<what only Lukas can do: accounts, money, prod settings>" --feature "<label of the new dot>"
node tools/monitor/agent.mjs done "<summary>"
```

- Look at the real thing: the monitor's checks and route sweep, the site, the
  feature backlog and gap analysis in memory.
- Propose at most three items per run, ranked by demo value per effort. Be plain
  about what needs Lukas: an account, money, a dashboard setting, a prod write.
- A proposal that adds a capability gets `--feature`. It shows as a ghost dot on
  the sphere until it ships.

## Conductor — build what Lukas approved

```sh
node tools/monitor/agent.mjs start conductor "<item title>" --item <id>
node tools/monitor/agent.mjs build <id> --branch agent/<id>
node tools/monitor/agent.mjs step "<progress>" --feature <feature-id>
node tools/monitor/agent.mjs review <id> "<how Lukas tries it>"
node tools/monitor/agent.mjs done "<summary>"
```

- Only items Lukas approved on the monitor. The board refuses anything else.
- Work on the item's branch in a separate git worktree, never in Lukas's own
  checkout (it often holds his uncommitted work).
- Write the tests first. Before `review`: `npx tsc --noEmit` and `npx vitest run`
  are green, and you have said so in a `step`.
- A shipped capability becomes a real dot: add it to `tools/monitor/features.mjs`
  (label, routes, `match`).
- Stuck? `node tools/monitor/agent.mjs drop <id> "<why>"` puts it back in the
  queue. Then stop and tell Lukas.

## Hard limits

- Build only what Lukas approved. Only he approves and only he marks things shipped.
- Never push, and never merge into `main`: `main` auto-deploys petbnb.lt.
- No prod writes without Lukas's explicit yes in the chat. That covers migrations,
  write SQL, edge deploys, dashboard settings and anything that sends email.
- Never `git add -A`. Never commit `src/app/dev/` or `docs/security/`. The repo is
  public: no secrets, keys or personal data in code, proposals or notes.
- One heavy process at a time (16 GB of RAM): one test run or build, not three.
- When something fails twice the same way, stop and report it. Don't loop.

## Letting it run

A session iterates through the board only when Lukas starts it, for example
`/loop follow tools/monitor/DRIVE.md`. Each iteration does one step of the cycle
and reports it. Lukas watches on the monitor and can stop it at any time.
