# Converting legacy Nordsweet code to the T3 app — guide for agents

You are one of several agents porting the legacy planner (branch `main`, a pile of HTML/JS runtimes
wrapped in Next.js) to the typed app on `develop` (`nextjs/`). Read this whole file before you
start, then claim your area in [LEGACY_MAP.md](LEGACY_MAP.md).

## 1. What "done" means

- **Same inputs and outputs as the legacy screen.** Every field, option, default, button, modal,
  computed value, warning and note the pilot sees in legacy must exist in the new screen, with the
  same numbers. Verify against the live legacy app
  (<https://nordsweet-performance-calculator.mrnordsweet.chatgpt.site>) and its source.
- **Not pixel parity.** The look is already matched globally (palette, panels, pill tabs, inputs —
  see `src/styles/globals.css` and `src/components/ui/*`). Don't spend effort on styling beyond
  using the existing components. Desktop first; phone/iPad layouts come later.
- **Production-grade code, not a transliteration.** Legacy is the *specification*, not code to keep:
  no DOM globals, no `window.*` data, no string-built HTML, no untyped state.
- **Owner's scope decisions (don't override them):**
  - Backlog = the work board in [LEGACY_MAP.md §4](LEGACY_MAP.md#4-work-board) ("Option A": close
    the real functional gaps).
  - **Out of scope until the owner asks:** the five data editors, company flights (need a backend
    with real auth), the PFD screen and the PDF chart viewer with taxi overlay.
  - The [Aviation API Collector](https://aviation.lab.vibecde.com/llms.txt) is the single source for
    everything it provides (weather, ATIS, NOTAM, traffic, airspace, VFR points). Never reintroduce
    client-side API tokens, the codetabs CORS proxy or page scraping that the collector replaced.
  - UI in Polish and English (every string through i18n).
  - Offline must keep working.
- **Legacy bugs:** don't silently copy *or* silently fix them. Port the behaviour; if it's clearly
  wrong (e.g. economy suggesting "S.L." for every waypoint), fix it, record the intended difference
  in a test, and list it in your hand-off note so the owner can decide.

## 2. Where things go (architecture)

```
nextjs/src/
  app/(app)/<route>/page.tsx   thin routes; all UI in features/
  domain/                      pure TS calculations — no React, no DOM, no fetch. Unit + golden tested.
  data/                        zod schemas (aircraft.ts, flight.ts, schemas.ts, nord.ts)
  api/                         the "dummy backend": api.<router>.<proc>.queryOptions()/mutationOptions()
                               shaped like future tRPC. Bundled JSON (public/data/*.json), Aviation API,
                               IndexedDB. Components never fetch directly.
  stores/                      Zustand + persist: flight.ts (the flight being planned), settings.ts,
                               aircraft-state.ts (per-airframe), inflight.ts. Each migrates its legacy
                               localStorage keys once (readLegacy* + a test).
  features/<area>/             components and hooks per screen (plan/, fly/, map/, checklists/)
  components/ui/               shadcn/ui primitives already restyled like legacy — use them, don't restyle
  i18n/messages.ts             PL + EN; `useT()`; keys `area.section.thing`
public/data/*.json             reference data (source of truth; minified)
scripts/legacy/                tooling for porting (below)
tests/                         golden tests + fixtures recorded from legacy
e2e/                           Playwright
```

Rules that keep it consistent:

- Units in names (`altitudeFt`, `fuelL`, `distanceNm`, `fuelFlowLph`, `weightKg`).
- Per-flight state goes in `flightSchema` (`src/data/flight.ts`); give every new field a
  `.default(...)` so saved flights and `.nord` files from before still parse. Device/airframe state
  goes in its own persisted store.
- Derived values are computed (`features/plan/use-plan.ts` is the planner's single derivation
  hook), never stored.
- Keep `.nord` export readable by the legacy app (`src/data/nord.ts`).
- Comment only the *why*. A known limitation gets `// shortcut: <limit>, <when to upgrade>`.

## 3. The porting workflow (do it in this order)

### 3.1 Get the legacy source

```bash
cd nextjs
scripts/legacy/extract-main.sh          # origin/main -> /tmp/nordsweet-legacy (LEGACY_DIR)
node scripts/legacy/dump-profiles.cjs   # merged aircraft profiles as legacy sees them
```

`main` is still being changed by another developer. Re-run `extract-main.sh` before you start and
note the `main` commit you ported from in your commit message.

### 3.2 Inventory the live screen

```bash
LD_LIBRARY_PATH=/tmp/libs/root/usr/lib/x86_64-linux-gnu \
  node scripts/legacy/crawl.mjs '#aircraftFuelPanel' '[data-aircraft-tab="fuel"]' > fuel.json
```

It dumps every visible control (label, type, options, value, placeholder) and the visible text, plus
a full-page screenshot in `$LEGACY_DIR`. Crawl **every state**: empty, filled, each modal/popover
(click its button), each select option that changes the layout. Write the inventory down (a table in
your hand-off note) — it is your acceptance checklist. The `LD_LIBRARY_PATH` is needed only on the
owner's homelab machine (Chromium libs).

Production may lag `main` (e.g. it doesn't load the `C172.SP-ANT` data file). `main` is the
reference; note differences.

### 3.3 Find the legacy code

The planner is one 33k-line file: `nextjs/src/runtime/index.js` (~1,500 functions, none exported).
CodeGraph indexes the new app well but the legacy runtime poorly — use `rg` on the extracted copy:

- by DOM id from the crawl: `rg -n 'aircraftFuelPanel|refs\.plannerAltitude' index.js`
- by label text: `rg -n '"Contingency' index.js`
- by function-name area (see LEGACY_MAP §2): `rg -n '^function getFuelPlanning' index.js`
- constants sit at the top (lines ~200–520): `rg -n '^const FUEL_' index.js`
- storage keys: `rg -n 'LOCAL_STORAGE_KEY = ' index.js`

Read the whole call chain down to the leaves before porting. Legacy reads inputs from DOM `refs.*`
and `state.*`; trace each to its default (`state` defaults ~line 1500, `defaultValue` in
`src/views/*.jsx`).

### 3.4 Port the calculation into `src/domain`

- Same constants, same rounding (`Math.ceil` per row, etc.), same fallbacks — named constants at the
  top of the module.
- Pure functions with typed input objects; return the details the UI's notes need (bases, fallbacks
  used), not formatted strings.
- Reuse what exists: `atmosphere.ts`, `grid.ts` (POH grids), `cruise-performance.ts` (legacy cruise
  lookups incl. eco-time/eco-distance), `climb.ts`, `navlog.ts`, `weight-balance.ts`, `wind.ts`,
  `geo.ts`.
- Known legacy conventions: ISA for table lookups is 15 − 2 °C/1000 ft (matched in
  `cruise-performance.ts`); pressure altitude is 30 ft/hPa in legacy (we use the correct formula —
  an intended difference); temperature lapse for fuel is 2 °C/1000 ft.

### 3.5 Prove it with golden tests

Record the legacy function's own outputs on a grid of inputs and compare:

```bash
node scripts/legacy/record-cruise.cjs   # example: writes tests/fixtures/legacy-cruise.json
```

Copy that pattern: `load([...function names], { perfFiles, publicFiles, prelude })` from
`scripts/legacy/legacy-functions.cjs` pulls the named functions into a VM; stub the globals they
touch in `prelude`. Then a Vitest test (`tests/cruise-golden.test.ts`) compares ours to 6 decimals.
If numbers differ because *our data* differs (e.g. R172K fuel flows were rounded during conversion),
fix the data in `public/data/*.json` from the legacy source — not the test.

For whole screens, also compare the rendered UI: run the same scenario in legacy and the new app
with Playwright and diff the values (inventory → acceptance).

### 3.6 Build the UI

- Use `Section`, `NumberField` (`features/plan/fields.tsx`), `Input`, `Select`, `Label`, `Button`,
  `Tabs` from `components/ui`. Legacy labels, order and defaults; PL + EN keys in `messages.ts`.
- Modals/popovers: use the existing `Sheet`/`DropdownMenu`/`Tooltip`; add a shadcn `Dialog` if you
  need one (`pnpm dlx shadcn@latest add dialog`) — one person adds it, others reuse.
- The planner tabs live in `src/app/(app)/page.tsx`. Inactive tabs stay mounted but hidden, so
  e2e tests must click the tab first (`tab(page, "Fuel")` helper in `e2e/plan.spec.ts`).

### 3.7 Gates, commit, deploy

```bash
cd nextjs
pnpm format:write
pnpm check                         # lint + typecheck + vitest
pnpm build                         # static export
LD_LIBRARY_PATH=/tmp/libs/root/usr/lib/x86_64-linux-gnu pnpm test:e2e
```

All four must pass. Commit per area/tab with a message that says what was ported and the `main`
commit it came from. `develop` is pre-production: every push auto-deploys to
<https://dev.fms.lab.vibecde.com> (Tailscale-only) within ~2 minutes via the homelab timer
(`deploy/`). Never push a red build there. Work on your own branch and rebase onto `develop`
before pushing; never force-push `develop`; never commit to `main`.

Commits are authored as the owner and end with the agent trailer the harness gives you, e.g.:

```bash
git -c user.name="Jakub Kosciukiewicz" -c user.email="jakub.kosciukiewicz@vibecde.com" commit
```

## 4. Coordinating with other agents

- Claim an area in LEGACY_MAP §4 (edit the table, commit it first) before writing code; release it
  when done. Don't edit files owned by another claimed area — ask in your hand-off instead.
- Shared hotspots — keep changes there minimal and rebase often: `src/data/flight.ts`,
  `src/features/plan/use-plan.ts`, `src/i18n/messages.ts`, `src/app/(app)/page.tsx`,
  `public/data/aircraft.json`.
- Add i18n keys in your own block (grouped by area prefix) in both `pl` and `en` to avoid merge
  conflicts.
- Hand-off note (in the PR/commit body or LEGACY_MAP notes): inventory checklist status, intended
  differences, legacy bugs found, anything skipped.

## 5. Pitfalls already hit (save yourself the time)

- Prettier wraps at 80 columns: scripted find/replace on source often misses; read the file first.
  `tests/fixtures` and `public` are Prettier-ignored (keep fixtures minified).
- `.next` holds stale typed-route types after moving routes: `rm -rf .next`.
- Persisted TanStack Query cache + 60 s default `staleTime` can show stale local data after reload;
  local IndexedDB queries use `staleTime: 0`.
- Lint: no `setState` inside `useEffect` (use `key` remount or `useSyncExternalStore`);
  `expect.closeTo` is `any` (use `toBeCloseTo`); prefer `??` over `||`.
- MapLibre's worker is copied to `public/` and served as JS (both dev server and nginx).
- The legacy runtime's numbers depend on hidden defaults (`state.cruiseOatTens = "1"`,
  `cruiseOatOnes = "5"` → cruise OAT 15 °C; performance temp input defaults 15; QNH 1013). Find
  them before concluding a number differs.
- Legacy is sometimes internally inconsistent (Route tab ETE uses the typed airspeed, the Fuel trip
  row uses its own economy speed). Port both behaviours faithfully and flag it.
