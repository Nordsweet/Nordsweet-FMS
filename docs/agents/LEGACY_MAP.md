# Legacy map and work board

Companion to [CONVERSION_GUIDE.md](CONVERSION_GUIDE.md). Paths are inside the extracted legacy app
(`scripts/legacy/extract-main.sh` → `/tmp/nordsweet-legacy/nextjs/`). Line numbers are approximate
(legacy `main` keeps moving) — grep for the function names.

## 1. Legacy files

| Legacy file | Lines | What it is | New home |
|---|---:|---|---|
| `src/runtime/index.js` + `src/views/index.jsx` | 33.4k | The planner: aircraft/route/fuel/W&B tabs, weather & ATIS pad, performance, taxi, in-flight mode, checklists, saved flights, settings | `features/plan`, `features/fly`, `features/checklists`, `app/(app)/settings` |
| `src/runtime/airspaces-map.js` + `airspace-tools.js` | 4.8k + 1.2k | Canvas map: airspaces, AUP, route editing, traffic | `features/map` (MapLibre) |
| `src/runtime/PFD.js` | 1.8k | PFD (GPS/GPX/sim) | out of scope until asked |
| `src/runtime/chart-browser.js` | 2.3k | PDF charts + taxi overlay | out of scope until asked (charts are links today) |
| `src/runtime/*-editor.js` (5) | 11.7k | Data editors | out of scope (future backend admin) |
| `public/aircraft-data/*.js` | — | Aircraft profiles + POH tables | `public/data/aircraft.json` (`src/data/aircraft.ts`) |
| `public/navdata.js`, `Waypoints/`, `procedure-data.js`, `ground-data.js`, `airport-frequencies*.js`, `airports*.js` | — | Reference data | `public/data/*.json`; VFR points from the Aviation API |
| `public/comms.js` | — | FIS sectors / COMMs | not ported (backlog) |

## 2. Planner runtime (`index.js`) by area

Function-name areas (count of functions) — grep `^function (get|render|build|handle|…)<Area>`:

| Area | Fns | Grep for | Notes |
|---|---:|---|---|
| ATIS pad / D-ATIS | 220 | `Atis`, `Datis` | structured ATIS pad + community ATIS |
| Route planner | 190 | `Planner`, `Route`, `Procedure`, `Waypoint` | Route tab, vertical profile, economy, waypoint WX |
| Taxi / ground | 130 | `Taxi`, `Ground`, `Runway` | |
| In-flight | 110 | `Flight`, `Freda`, `Debrief`, `Utility` | timers, events, FREDA, debrief |
| Checklists | 48 | `Checklist` | voice, autoscroll |
| Cruise | 38 | `Cruise` | cruise tiles (OAT, wind, RPM/MAP) |
| Aircraft | 35 | `Aircraft` | profiles, registration, last state |
| Fuel | 32 | `FuelPlanning`, `Fuel` | Fuel tab (constants `FUEL_*` ~line 270) |
| W&B | 27 | `WeightBalance` | W&B tab (constants `WEIGHT_BALANCE_*` ~line 340) |
| Weather | 30 | `Wx`, `Metar`, `Notam`, `Condition` | conditions source, AWOS |
| Performance | 20 | `Performance`, `Takeoff`, `Climb`, `P2006T`, `Sd4`, `Fr172h` | T/O, LDG, climb, glide |
| Company | 15 | `Company` | out of scope |
| Charts | 18 | `Chart` | out of scope |

State defaults: the `state = {…}` object (~line 1500). DOM refs: `refs = {…}` (~line 40).

## 3. Legacy localStorage keys

| Key | New home | Status |
|---|---|---|
| `nordsweet.language.v1`, `homeAirport.v1`, `pilotWeightKg.v1` | `stores/settings.ts` | migrated |
| `nordsweet.savedRoutes.v1` | IndexedDB flights (`api/flights.ts`) | migrated once |
| `nordsweet.aircraftLastState.v1`, `fuelIndicationModes.v1` | `stores/aircraft-state.ts` | migrated |
| `nordsweet.aircraftType.v1`, `aircraftRegistration.v1`, `lastRoute.v1` | draft flight (`stores/flight.ts`) | **open** (`.nord` route fields are imported/exported) |
| `nordsweet.fuelPlanning.v1` | flight fuel overrides | **open** (Fuel tab) |
| `nordsweet.weightBalance.v1` | flight stations / W&B | **open** (W&B tab) |
| `nordsweet.checklistAutoscroll.v1`, `checklistVoiceGender.v1`, `checklistVoiceUri.v1` | settings | **open** |
| `nordsweet.atisAutoscroll.v1`, `tecnamPro.communityAtis.v1` | — | **open** |
| `nordsweet.flight*`, `savedFlights.v1` | — | **open** — check what they hold |
| `nordsweet.avwxToken.v1`, `notamifyToken.v1` | — | dropped on purpose (collector holds tokens) |
| `nordsweet.companyAuth.v1`, `frequencyEditorDraft.v1` | — | out of scope |

## 4. Work board

Claim a row before you start (owner = agent/session name + date), commit the claim, release it when
merged to `develop`. One owner per row.

| Area | Status | Owner | Notes |
|---|---|---|---|
| Look & feel (palette, panels, tabs, header) | done | claude 2026-10-12 | desktop; phone/iPad pass later |
| Planner › Aircraft tab | done | claude 2026-10-12 | type list, registration profiles, FREDA indication, last state/MTH |
| Planner › Fuel tab | done | claude 2026-10-13 | rows, overrides, FOB/fuel added, notes; matches legacy (see §5) |
| Planner › W&B tab | done | claude 2026-10-13 | sheet, linked fuel, envelope chart; matches legacy |
| Planner › Route tab | done | claude 2026-10-13 | `domain/route-plan.ts` (+ `route-economy.ts`): tokens, airways, SID/STAR/APPROACH (NONE/AUTO/id + inline variant), thresholds, TOC/TOD/SOC, ALT at point, waypoint WX, schedule, ECO; dialogs; load route. Matches legacy leg for leg (main 1888742) |
| Route: pilot-entered restrictions and map-anchored waypoint insertion | open | | legacy map editor features; route uses procedure restrictions and nearest-leg insertion |
| Weather / ATIS pad parser, waypoint forecasts, AWOS | open | | API boundary only |
| Performance (charts/readouts, runway use, glide, persisted conditions) | open | | |
| Taxi diagram / ground connectivity | open | | |
| In-flight (timers, events, phases, FREDA detail, debrief, last-state save, COMMs hand-off, proximity alerts) | open | | `public/comms.js` |
| Map (point/route editing, GPX/OpenAir import, offline tiles, layer prefs) | in progress | Codex 2026-10-13 | In-flight map architecture and functional parity |
| Airspace browser, traffic page | open | | |
| Checklists (voice gender/voice, autoscroll toggle) | open | | |
| Settings & remaining legacy key migration (§3) | open | | |
| Saved flights library (rename, route-only import, GPX/KML route export) | open | | |
| PFD, chart viewer, editors, company flights | out of scope | | only if the owner asks |

## 5. Known legacy bugs / intended differences

Record every one you find here (and assert it in a test).

- Route economy suggests "S.L." for every waypoint (below the airports) — don't copy.
- Pressure altitude 30 ft/hPa in legacy; we use the exact formula.
- Fuel "Final reserve" note says "METAR temp from <landing airport>" but legacy uses the current
  conditions temperature.
- Production legacy doesn't load `C172.SP-ANT-data.js`; `main` has it (ported as FR172H SP-ANT).
- Aircraft summary mentions legacy data file names; the new app states the same facts without file
  names.
- Fuel: SD-4 climb fuel flow comes from its POH fuel/time-to-climb chart (16.6 L/h); legacy ignored
  that chart and extrapolated the cruise table to 95% power, so its alternate row is ~2 L higher.
- Fuel: with block fuel below trip fuel, legacy's landing weight drops below zero-fuel weight (it
  subtracts fuel that isn't on board); ours stops at zero fuel.
- W&B: legacy's "Phase" card (active performance phase) is not shown; the new app has no global
  phase selector.
- Offline cache: data persisted by TanStack Query is tied to the build id (`BUILD_ID` in
  `next.config.js`); keep it that way, or reference data cached by an older release can crash new
  code (happened on iOS after the Aircraft tab release).
- Fuel: verified row-for-row against legacy for P2006T, R172K, FR172H, C152, Husky (with and without
  alternates) using `/tmp/parity`-style scenario runs; the R172K case is an e2e test
  (`e2e/fuel.spec.ts`).
- Data: procedures come from the waypoint package only (`Waypoints/Poland.js`, 108 incl. 2 approaches)
  as legacy loads them, and airways from `navdata.js` — `scripts/legacy/import-route-data.cjs`.
  Airport runways/thresholds/elevations include legacy's ground-data overrides (e.g. EPKK RWY 07
  TORA 2312 m) — `scripts/legacy/import-airport-overrides.mjs`.
- Route climb gradient: legacy always uses the P2006T climb table; ours uses the selected aircraft's
  (450 ft/NM without one). Identical for P2006T; TOC moves for other types.
- Route runway choice (and so AUTO SID/STAR): legacy uses the departure conditions wind for both
  airports; ours uses each airport's METAR. Without METARs both pick the longest runway.
- Economy modal: legacy let every point go to sea level ("S.L." everywhere); airports now stay at or
  above their elevation and en-route points 1000 ft above the higher airport. Legacy also always
  showed "Waypoint WX" as wind source; ours says "Cruise tile" until waypoint WX is entered.
- Route tab: no CALCULATE button (the route recalculates as you type, as legacy did on input).
  The pre-port nav log table, manual wind/fuel-flow inputs and Open-Meteo winds aloft were removed
  (not in legacy; Open-Meteo broke the single-data-source rule).
- Map, fly mode and export use the route's fixes without TOC/TOD.

