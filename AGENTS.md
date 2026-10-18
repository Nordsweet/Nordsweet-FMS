# Agents working on Nordsweet FMS

The app is being ported from the legacy planner (branch `main`, untouched reference) to the typed
Next.js/T3 app in `nextjs/` (branch `develop`, auto-deploys to dev.fms.lab.vibecde.com).

Before changing anything, read:

1. [docs/agents/CONVERSION_GUIDE.md](docs/agents/CONVERSION_GUIDE.md) — scope, architecture, the
   porting workflow, gates and pitfalls.
2. [docs/agents/LEGACY_MAP.md](docs/agents/LEGACY_MAP.md) — where legacy code lives, storage keys,
   and the work board: claim your area there first.

Gates (from `nextjs/`): `pnpm format:write && pnpm check && pnpm build && pnpm test:e2e`.
Never commit to `main`; never force-push `develop`.

Finish every piece of work by pushing it to `develop` (run the gates first; merge `origin/develop`
before pushing). Stage only your own files: other agents may have uncommitted work in the same
checkout, so push from a clean `git worktree` if the merge would touch their files.

The map app consumes the aviation API contract (`~/Developer/aviation-api-collector`, `docs/API.md` is
the source of truth). After backend changes to `/traffic`, `/stream` or `/status`, update the schemas,
client and tests here. If the frontend needs a new field, change the API repo and its `docs/API.md` in
the same piece of work.

## Tooling in this repo

Ponytail, Karpathy guidelines and Superpowers are declared for the team in `.claude/settings.json`;
Claude Code offers to install them when the folder is first trusted. At the start of a thread run
`claude plugin list`, use what is enabled, install only what is missing:

```
claude plugin marketplace add obra/superpowers-marketplace
claude plugin marketplace add DietrichGebert/ponytail
claude plugin marketplace add forrestchang/andrej-karpathy-skills
claude plugin install superpowers@superpowers-marketplace
claude plugin install ponytail@ponytail
claude plugin install andrej-karpathy-skills@karpathy-skills
```

- Ponytail: shortest working solution first, no speculative abstractions.
- Karpathy guidelines: think before coding, simplicity, surgical changes, goal-driven execution.
- Superpowers: use its skills for planning, TDD and debugging.
- CodeGraph: in every thread call `codegraph_explore` (or `codegraph explore "<question>"`) before
  grep/find/Read to locate code and see the blast radius before editing. Rebuild the index with
  `codegraph init -y`.

## Finishing work

After every change, without asking: run the gates from `nextjs/` (`pnpm format:write && pnpm check`,
which is lint + typecheck + unit tests; add `pnpm build && pnpm test:e2e` as in the gates above), then
commit and push to `develop`. Never push red.
