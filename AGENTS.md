# Agents working on Nordsweet FMS

The app was ported from the legacy planner (the git tag `legacy-planner`, untouched reference) to the
typed Next.js/T3 app in `nextjs/`. `develop` is where all work happens and auto-deploys to
dev.fms.lab.vibecde.com; `main` holds the same app and is only moved when the user asks.

Before changing anything, read:

1. [docs/agents/CONVERSION_GUIDE.md](docs/agents/CONVERSION_GUIDE.md) — scope, architecture, the
   porting workflow, gates and pitfalls.
2. [docs/agents/LEGACY_MAP.md](docs/agents/LEGACY_MAP.md) — where legacy code lives, storage keys,
   and the work board: claim your area there first.

Gates (from `nextjs/`): `pnpm format:write && pnpm check && pnpm build && pnpm test:e2e`.
Commit and push to `develop`. Commit or push to `main` (merge, fast-forward, anything) **only when the
user explicitly asks for it in that thread**; a standing instruction to "finish work" or "push" means
`develop`. Never force-push `develop` or `main`.

Finish every piece of work by pushing it to `develop` (run the gates first; merge `origin/develop`
before pushing). Stage only your own files: other agents may have uncommitted work in the same
checkout, so push from a clean `git worktree` if the merge would touch their files.

The map app consumes the aviation API contract (`~/Developer/aviation-api-collector`, `docs/API.md` is
the source of truth). After backend changes to `/traffic`, `/stream` or `/status`, update the schemas,
client and tests here. If the frontend needs a new field, change the API repo and its `docs/API.md` in
the same piece of work.

## User data

What a pilot creates (saved flights, custom aircraft, airframe hours and fuel, finished flights,
settings, favorites) lives on the Aviation API; the browser keeps an offline copy and renders from
it. Contract: `~/Developer/aviation-api-collector/docs/API.md`, section "User data"; design and
limits: [docs/agents/USER_DATA.md](docs/agents/USER_DATA.md). Code: `nextjs/src/api/userdata/`. Never
change the backend from here: list what is missing as a backend request in USER_DATA.md.

## Tooling in this repo

Ponytail, Karpathy guidelines and Superpowers are declared for the team in `.claude/settings.json`;
Claude Code offers to install them when the folder is first trusted. At the start of a Claude Code
thread run `claude plugin list`, use what is enabled, install only what is missing:

```
claude plugin marketplace add obra/superpowers-marketplace
claude plugin marketplace add DietrichGebert/ponytail
claude plugin marketplace add forrestchang/andrej-karpathy-skills
claude plugin install superpowers@superpowers-marketplace
claude plugin install ponytail@ponytail
claude plugin install andrej-karpathy-skills@karpathy-skills
```

These plugins are Claude Code only; Codex follows the rules below by hand.

- Ponytail: shortest working solution first, no speculative abstractions.
- Karpathy guidelines: think before coding, simplicity, surgical changes, goal-driven execution.
- Superpowers: use its skills for planning, TDD and debugging.

Cloudflare's [security-audit skill](https://github.com/cloudflare/security-audit-skill) is not a
plugin; install it once per machine as a user skill (Codex: copy it to `~/.codex/skills/` instead):

```
git clone --depth 1 https://github.com/cloudflare/security-audit-skill /tmp/security-audit-skill
mkdir -p ~/.claude/skills && cp -r /tmp/security-audit-skill/skills/security-audit ~/.claude/skills/
```

- Security audit: use it for security questions and reviews of trust boundaries (API input, imports,
  storage, deploy); run its full audit workflow only when asked for one.

## CodeGraph

The index lives in `.codegraph/` (gitignored). In every thread, in any agent, call `codegraph_explore`
(MCP tool) or `codegraph explore "<question>"` (shell) BEFORE grep/find/reading files, to find or
understand code, and again before editing to see the blast radius. Name files or symbols in the query.
`codegraph impact <symbol>` and `codegraph affected <files>` show what a change touches and which tests
to run. If `codegraph` is missing or the index is empty: `npm install -g @colbymchenry/codegraph`,
`codegraph install -y -t claude,codex`, `codegraph init -y`; update with `codegraph upgrade`; refresh
with `codegraph sync`.

## Finishing work

After every change, without asking: run the gates from `nextjs/` (`pnpm format:write && pnpm check`,
which is lint + typecheck + unit tests; add `pnpm build && pnpm test:e2e` as in the gates above), then
commit and push to `develop`, which auto-deploys to dev.fms.lab.vibecde.com. Never push red.
