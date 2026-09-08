# SETUP — bring this project up on a new machine

**Read this top to bottom before running anything.** It is written for Claude Code on a
fresh Windows machine, doing the setup for Lukas. Every version below is what the project
was actually verified against on 2026-09-08, not a guess.

Work through the phases in order. Phases 0–3 are blocking; Phase 6 is optional.

---

## 0. What you cannot get from this repository

Three things are **not** in git and cannot be reconstructed from it. Get them from Lukas
before starting, because two of them block the build.

| Missing | Where it lives | Blocking? |
|---|---|---|
| `.env.local` | Old machine, or Vercel/Supabase dashboards (§3) | **Yes** — build and dev both fail without it |
| Claude Code config + project memory | Old machine's `C:\Users\<user>\.claude\` (§5) | No, but you are working blind without it |
| `node_modules/` | Reinstalled by `npm ci` (§2) | Reinstalled, not transferred |

If Lukas copied a **handoff bundle** across (a `petbnb-handoff` folder or zip, made on the
old machine), it contains the first two. Ask where he put it before falling back to the
manual routes below.

---

## 1. Prerequisites

Verified working set from the old machine. Newer patch versions are fine; do not go below
the minimums.

| Tool | Old machine had | Minimum | Needed for |
|---|---|---|---|
| **Node.js** | 22.11.0 | **20.9.0** (Next 16 refuses to run below this) | everything |
| npm | 10.9.0 | ships with Node | everything |
| **Git** | 2.47.0.windows.2 | any recent | everything |
| GitHub CLI (`gh`) | 2.93.0 | any recent | reading CI runs and deployments (§7) |
| Claude Code | 2.1.263 | latest | you |
| Python | 3.12.6 | 3.11+ | `iot-collar/` only (§6) |

CI pins **Node 22** (`.github/workflows/ci.yml`), so install Node 22 rather than 24 — it
keeps local results and CI results comparable.

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
winget install --id GitHub.cli -e
winget install --id Python.Python.3.12 -e   # only if you want the collar project
```

Close and reopen the terminal after installing, then confirm:

```powershell
node -v; npm -v; git --version; gh --version
```

`node -v` must print `v20.9.0` or higher. If it prints nothing, PATH has not refreshed —
open a new terminal rather than debugging it.

---

## 2. Clone and install

```powershell
cd C:\Users\<user>
git clone https://github.com/LukasPet741/petbnb.git
cd petbnb
npm ci
```

Use `npm ci`, not `npm install`. `package-lock.json` is committed and `ci` installs it
exactly; `install` is free to bump ranges and would silently change the dependency tree
that every verified result in this project was produced against.

The install is large (Next 16 + React 19 + Tailwind v4 + Vitest) and the npm cache on a new
machine is cold, so expect several minutes and require network.

---

## 3. Environment variables — the blocking step

Create `.env.local` in the repo root. It is gitignored (`.env*` is), so it must be
recreated by hand. `.env.example` lists every key with its source.

Six variables, plus one Vercel writes itself:

| Key | Public? | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes, ships to the browser | Supabase dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes, ships to the browser | same page |
| `SUPABASE_SERVICE_ROLE_KEY` | **NO — full database access, bypasses RLS** | same page, "service_role" |
| `RESEND_API_KEY` | **NO** | Resend dashboard → API Keys |
| `RESEND_FROM_EMAIL` | not a secret | the verified sender on the Resend domain |
| `NEXT_PUBLIC_SITE_URL` | not a secret | `http://localhost:3000` locally. **This holds the local value even on the old machine — it is not a source for the production domain.** |

Three routes to fill it, best first:

1. **From the handoff bundle** — copy its `.env.local` into the repo root. Done.
2. **`npx vercel env pull .env.local`** — pulls the linked project's variables. Requires
   `npx vercel login` first, and the account must have access to the team that owns the
   project. It also writes a `VERCEL_OIDC_TOKEN` line, which is expected and harmless.
3. **By hand from the dashboards**, using the table above. Ask Lukas to open them; do not
   ask him to paste secrets into the chat if a file copy will do.

**Never commit this file, and never paste its contents into a commit message, an artifact
or an issue. This repository is public.**

Sanity check once it exists — prints which keys are set, and no values:

```powershell
node -e "require('fs').readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).forEach(l=>{const i=l.indexOf('=');console.log(l.slice(0,i), l.slice(i+1).trim()?'SET':'EMPTY')})"
```

---

## 4. Verify the setup — do not skip, and do not report success without it

Run all four. These are the exact commands, and the exact numbers the old machine produced
on 2026-09-08 at commit `a053567`.

```powershell
npx vitest run      # expect: 33 files, 1092 tests, all passing
npx tsc --noEmit    # expect: no output, exit 0
npx next build      # expect: exit 0, route table printed
npm run dev         # then open http://localhost:3000
```

Test and type counts only grow, so more than 1092 passing is fine; **fewer, or any
failure, means the setup is wrong** — almost always a missing or truncated `.env.local`.

If `tsc` or `next build` fails on a file that does not exist in the source tree, the
`.next/` cache is stale: `Remove-Item -Recurse -Force .next` and retry. This has bitten
this project before.

The dev server should render the landing page with a photographic hero and a frosted
search card. The language switcher is in the header; the site defaults to Lithuanian.

---

## 5. Restore the Claude Code environment

This is what makes the next session continue rather than restart. None of it is in this
repository — `.claude/` is gitignored — so it all comes from the handoff bundle.

On the old machine these lived under `C:\Users\<user>\.claude\`:

```
CLAUDE.md                                   personal standing instructions
settings.json                               model, effort, plugins, and the SessionStart hook
hooks/inject-project-notes.mjs              injects the project notes at session start
projects/C--Users-lkspe-petbnb/memory/      the project notes and memory files
```

Copy them into the new machine's `C:\Users\<user>\.claude\`, keeping the same relative
paths. Two things to fix afterwards, both of which fail silently if forgotten:

1. **The hook path inside `settings.json` is absolute.** If the Windows username differs on
   the new machine, edit the `SessionStart` command to the new path.
2. **The memory folder name encodes the project path** — `C--Users-lkspe-petbnb` is
   `C:\Users\lkspe\petbnb` with the separators replaced by `-`. If the clone lives anywhere
   else, rename that folder to match, or the hook finds nothing and loads empty without
   complaining.

Verify by starting a session in the repo: the project notes should appear in context
unasked. If they do not, run the hook directly —
`node "C:/Users/<user>/.claude/hooks/inject-project-notes.mjs"` — and read the error.

`settings.json` also lists five plugins (superpowers, frontend-design, chrome-devtools-mcp,
cloudflare, github) and their marketplace; they reinstall from that config. Skills under
`.claude/skills/` are separate files and copy across as-is.

**`.mcp.json` is committed to this repo** and wires the Supabase MCP server, so that one
needs no restoring — it will just ask to authenticate on first use.

---

## 6. Optional extras

- **Vercel CLI** — `npm i -g vercel`, then `vercel login` and `vercel link`. Only needed for
  `env pull` and manual deploys; pushes to `main` deploy on their own.
- **Supabase CLI** — use `npx supabase …`, no global install. `supabase start` (a local
  Postgres stack) needs **Docker Desktop**, a heavy install that no part of the web app
  requires: this project develops against the hosted project.
- **Chrome + the Claude in Chrome extension** — needed to render the site in a real browser.
  The extension requires Chrome to already be running before a session can drive a tab.
- **`iot-collar/`** — a separate Python project (the Raspberry Pi GPS collar) sharing the
  same Supabase backend. It takes no part in `npm ci` or the test suite:
  `pip install -r iot-collar/requirements.txt`. `bluezero` is Linux-only, so a full install
  succeeds on the Pi and not on Windows. Skip unless working on the collar.

---

## 7. Before changing anything, know these four

Not setup steps — the things that make a first session on a new machine go wrong.

1. **Read `AGENTS.md`.** This Next.js differs from what any model was trained on. The
   authority is `node_modules/next/dist/docs/` — read the relevant guide there before
   writing framework code. Not memory, not recall.
2. **Production is live and sends real email to real people.** Every `notifications` INSERT
   triggers one. Do not insert a test notification. Do not apply a migration to production,
   and do not run `supabase db push`, without asking Lukas first.
3. **Production is `https://petbnb.lt`**, auto-deployed from a push to `main`. A similarly
   named `.vercel.app` host belongs to a different account and is not this project —
   verifying against it produces confident nonsense. Use `petbnb.lt`, or
   `gh api repos/LukasPet741/petbnb/deployments` for what a commit actually deployed.
4. **`NEXT_SESSION.md` is stale.** It predates the test suite, CI and the live deployment,
   and describes a design system that has since been replaced. It is kept for history. The
   current state of the project is the memory notes from §5; without them, ask Lukas rather
   than trusting that file.

---

## 8. Done means

- [ ] `node -v` ≥ 20.9, repo cloned, `npm ci` completed
- [ ] `.env.local` present with all six keys set
- [ ] `npx vitest run` — 33+ files, 1092+ tests, zero failures
- [ ] `npx tsc --noEmit` — exit 0
- [ ] `npx next build` — exit 0
- [ ] `npm run dev` — landing page renders at `localhost:3000`
- [ ] Claude config restored and the notes hook verified firing (§5)

Report what actually ran and what it printed. A checkbox ticked without its command run is
worse than an unticked one.
