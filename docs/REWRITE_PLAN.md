# Nordsweet FMS — T3 rewrite plan

Goal: production-grade T3 app (Next.js App Router, TypeScript, Tailwind, zod; no backend for now),
static export + offline PWA. Legacy code is a feature spec, not a design to copy. Screens are
regrouped by what the pilot does, not by the old HTML files.

## What exists today

| Area | Legacy source | Size |
|---|---|---|
| Planner (one engine) | `runtime/index.js` | 33k lines, 1,531 functions |
| ├ Weather / ATIS pad / NOTAM / AWOS | | ~7.7k |
| ├ Route, profile, TOC/TOD, procedures | | ~5.6k |
| ├ Performance (T/O, LDG, climb, cruise, glide) | | ~4.3k |
| ├ Taxi routing on ground data | | ~3.7k |
| ├ In-flight mode (GPS, COMMs, direct-to, FREDA, debrief) | | ~2.0k |
| ├ Fuel, W&B, checklists (voice) | | ~3.4k |
| └ Utils, settings, i18n, saved flights | | ~4.7k |
| Airspace map (custom canvas tiles, airspaces, AUP, traffic, route editing) | `runtime/airspaces-map.js` + `airspace-tools.js` | 5.2k + 1.2k |
| PFD (canvas, GPS/GPX/sim) | `runtime/PFD.js` | 1.8k |
| Chart browser (PDF) | `runtime/chart-browser.js` | 2.3k |
| Data editors: checklist/aircraft, ground, waypoints/procedures, frequencies, airspaces | 5 runtimes | 11.7k |

Facts that shape the design:
- Map runs in an iframe inside the planner and talks via `postMessage` (`nordsweet:*` messages).
- Editors are local authoring tools that download `.js` data files (`window.NORDSWEET_*` globals).
- Performance = POH tables (pressure altitude × temperature × weight) with per-aircraft hand-written
  lookup functions; only 5 of 12 aircraft profiles have performance data.
- ~35 `localStorage` keys (`nordsweet.*`), `.nord` JSON flight files, external APIs called from the
  browser (AVWX, atis.guru, Notamify, Open-Meteo, airoTEC AWOS, PANSA/ANS CZ AUP, adsb.fi,
  airplanes.live, SafeSky, Google/OSM/OpenAIP tiles) — some through the public `codetabs` CORS proxy.
- 3 regression tests total.

## Target architecture

```
src/
  app/                 routes only (thin)
  domain/              pure TS, no React/DOM — 100% unit tested
    units, geo, atmosphere (ISA, PA/DA), wind
    performance/       generic table interpolation + per-aircraft table data
    fuel, weight-balance (envelope polygon), route (legs, profile, TOC/TOD)
    weather/           METAR/TAF/ATIS parsing, comms
  data/                zod schemas + JSON datasets (airports, navaids, waypoints, procedures,
                       airspaces, frequencies, ground, aircraft) — loaded lazily, typed
  features/<name>/     components, hooks, feature store slice
  components/ui/       shadcn/ui (Radix) primitives, cockpit dark theme
  lib/                 api clients (TanStack Query), storage, i18n
```

- **State:** Zustand + `persist`, one versioned store with migrations that read the old
  `nordsweet.*` keys once, so users keep their data.
- **Server data:** TanStack Query for weather/NOTAM/traffic with caching, retries, offline fallback.
- **Map:** MapLibre GL (WebGL) replacing the 5k-line canvas renderer; planner and map share the
  store directly — no iframe, no `postMessage`.
- **PWA:** Serwist instead of the hand-written `sw.js` + precache script.
- **Data pipeline:** one-off script converts the legacy `window.NORDSWEET_*` files to JSON validated
  by zod; editors (later) write JSON.
- **Quality gates:** ESLint (typescript-eslint strict) + Prettier, Vitest, Playwright, CI on all.
- **Correctness:** before replacing any calculation, golden tests run the legacy function (in `vm`,
  like the existing tests) and the new one on the same inputs. Differences are reviewed against
  the POH, not auto-accepted — the legacy output may be wrong.

Transition: new app lives alongside legacy routes; each area is cut over when it reaches parity,
then its legacy runtime is deleted.

## Phases (essential first)

Estimates are Claude working time.

### 1. Foundation — 4–6 h
Tooling (ESLint, Prettier, Vitest, Playwright, CI), shadcn/ui + theme, app shell with navigation,
Zustand store with legacy-key migration, data pipeline (legacy JS → JSON + zod), `domain/`
units/geo/atmosphere/wind with tests.

### 2. Core flight plan (MVP) — 12–20 h
The thing a pilot needs before every flight:
- Aircraft selection (type + registration profiles).
- Departure / destination / alternate with airport search; route via waypoints.
- Cruise altitude/speed → nav log (TC/MH with wind, distance, GS, ETE) and vertical profile (TOC/TOD).
- Fuel plan (taxi, climb, cruise, reserve, alternate).
- Weight & balance with CG envelope chart.
- Take-off / landing performance per runway (generic table engine, all 5 aircraft), crosswind/tailwind.
- Save / load / import / export `.nord` (backwards compatible), saved & company flights.

### 3. Weather & NOTAM — 8–12 h
METAR/TAF (AVWX), winds aloft feeding the nav log (Open-Meteo), waypoint WX, AWOS, NOTAMs
(Notamify), ATIS pad (parse + manual entry, community ATIS). Settings for API tokens.

### 4. Map — 10–16 h
MapLibre map: basemaps, airports/waypoints, route display + editing (add point, direct-to,
speed/altitude restrictions), airspaces with AUP activation (PL/CZ, today/tomorrow), labels,
point inspector, GPX/OpenAir import.

### 5. In-flight — 8–14 h
Flight mode (GPS tracking, active leg, ETA updates), COMMs frequency hand-off, direct-to,
FREDA check, flight debrief, PFD (canvas component), live traffic (ADS-B / SafeSky).

### 6. Ground & procedures — 10–16 h
SID/STAR/approach procedures and runway/SID change, taxi routing on ground data, chart browser (PDF).

### 7. Checklists, economy, settings, i18n — 4–6 h
Checklists with voice + autoscroll, route economy, settings, PL/EN dictionaries.

### 8. Data authoring tools — 3–8 h
Dev-only `/tools/*` routes (or CLI scripts) that edit the JSON datasets; scope depends on which
editors are still used.

### 9. Cleanup — 3–5 h
Delete `src/runtime/`, root-level legacy copy and its GitHub Pages workflow, enable Tailwind
Preflight, Serwist PWA, Playwright smoke suite in CI.

**Total: ~62–103 h.**

## Open questions
1. Which aircraft/registrations are actually flown? (12 profiles, 5 with performance data.)
2. Is the root-level legacy copy + `static.yml` GitHub Pages deploy still needed?
3. Company flights / `companyAuth` — who uses it, and how should it work without a backend?
4. Keep both Polish and English UI?
5. Which editors are still used, and by whom?
6. Map basemap: OSM only, or keep Google / OpenAIP / SkyVector (need keys)?
7. CORS: the `codetabs` public proxy is a reliability/privacy risk; acceptable until a backend exists?
