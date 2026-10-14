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
