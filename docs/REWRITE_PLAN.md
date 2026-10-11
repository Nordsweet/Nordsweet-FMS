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
- **Dummy backend:** all data goes through `src/api/` — typed procedures with zod input/output
  shaped like future tRPC routers (`aircraft.list`, `flights.save`, `weather.metar`, …). Today a
  local adapter implements them: reference data from bundled JSON, user data in IndexedDB (Dexie),
  external services via `fetch`. When the backend exists, only the adapter is swapped for a tRPC
  client; components never change.
- **Offline:** offline-first. Reference data precached by the service worker; user data lives in
  IndexedDB (later: sync queue to the backend); TanStack Query cache persisted to IndexedDB so the
  last weather/NOTAMs stay available without signal.
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

## Data sources

The [Aviation API Collector](https://aviation.lab.vibecde.com/llms.txt) is the single source for
everything it provides (map tiles excluded). Client: `src/api/aviation/` (zod schemas checked
against recorded responses). Everything else stays bundled in `public/data/` until the collector
(or the future backend) provides it.

| Data | Source |
|---|---|
| METAR/TAF, ATIS, NOTAMs | API (`/airports/{icao}`, `/weather`, `/atis`, `/notams`) |
| Live traffic | API (`/traffic`, `/stream`) |
| Airspace geometry + AUP/UUP activations (PL, CZ) | API (`/airspace`, `/airspace/activations`) |
| VFR reporting points | API (`/places?kind=vfr_point`), cached in IndexedDB for offline |
| Airports with full runway data (TORA/LDA, thresholds) | bundled — API `places` has one runway only |
| IFR waypoints, navaids, procedures, frequencies, ground layouts, aircraft | bundled — not in the API |

This retires the client-side AVWX/Notamify tokens, the public `codetabs` CORS proxy, the
PANSA/ANS CR page scraping and the `airspace-data/*` files once the legacy screens are gone.

### Collector status (2026-10-11)
- Fixed in collector PR #1 (deployed): open CORS, and `/places` without `lat`/`lon` returns
  everything (746 VFR points in one call; the earlier 5-tile workaround found only 466).
- Airspace coverage checked: every Lotnik zone inside the API's coverage is served. (An earlier
  "40 missing zones" note was wrong — those were outside the queried area, e.g. P 1 in Lithuania.)
- Open: `AVWX_TOKEN` and `NOTAMIFY_TOKEN` are not set on the deployment — METARs are single-source
  (crowd-sourced, often stale) and `/notams` returns 502. Needs the tokens in the server `.env`.
- Open: the API is Tailscale-only; pilots' devices must be on the tailnet, or it needs public exposure.
- Open: airports lack per-runway data (designators, TORA/TODA/ASDA/LDA, thresholds), so airports stay
  bundled. OurAirports covers runways for only 221 of the 589 fields; the rest come from parsing the
  CUP descriptions, which would have to move into the collector.
- OpenAPI has no response schemas, so app types are hand-written from `/llms.txt`.

## Phases (essential first)

Estimates are Claude working time.

### 1. Foundation — 4–6 h ✅ done
Tooling (ESLint, Prettier, Vitest, Playwright, CI), shadcn/ui + theme, app shell with navigation,
Zustand store with legacy-key migration, data pipeline (legacy JS → JSON + zod), `domain/`
units/geo/atmosphere/wind with tests.

Delivered: new app at `/v2` (separate root layout, legacy screens unchanged), settings + PL/EN,
`src/api` local backend for airports/navpoints/frequencies, offline for new routes.
Findings: planner was missing 948 VFR waypoints since the Next migration (fixed on this branch);
legacy pressure altitude rule of thumb understates PA at high QNH; runway `magHdg` equals true
heading; navaids date from 2019; an `EPXX` test airport shipped in production data.

### 2. Core flight plan (MVP) — 12–20 h
The thing a pilot needs before every flight:
- Aircraft selection (type + registration profiles).
- Departure / destination / alternate with airport search; route via waypoints.
- Cruise altitude/speed → nav log (TC/MH with wind, distance, GS, ETE) and vertical profile (TOC/TOD).
- Fuel plan (taxi, climb, cruise, reserve, alternate).
- Weight & balance with CG envelope chart.
- Take-off / landing performance per runway (generic table engine, all 5 aircraft), crosswind/tailwind.
- Save / load / import / export `.nord` (backwards compatible), saved & company flights.

### 3. Weather & NOTAM — 6–10 h
METAR/TAF, ATIS and NOTAMs from the Aviation API (source agreement and staleness shown), winds
aloft feeding the nav log (Open-Meteo, not in the API), waypoint WX, ATIS pad (parse + manual entry).

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

### 8. Data authoring tools — deferred
Skipped. Editing reference data becomes an admin feature once the backend exists.

### 9. Cleanup — 3–5 h
Delete `src/runtime/`, root-level legacy copy and its GitHub Pages workflow, enable Tailwind
Preflight, Serwist PWA, Playwright smoke suite in CI.

**Total: ~59–95 h.**

## Decisions (2026-10-11)
1. Aircraft become data behind the API (`aircraft.*`); a database of flown aircraft comes later with
   the backend. Performance tables are per-aircraft data, not code.
2. Root-level legacy copy and GitHub Pages workflow: delete.
3. Company flights: out of scope for now.
4. UI in Polish and English.
5. Data editors: skipped; editing reference data becomes an admin feature on the backend later.
6. All basemaps (OSM, Google, OpenAIP, SkyVector); API keys supplied later via settings/env.
7. Public CORS proxy acceptable for now; everything goes through the dummy backend so a real one
   can replace it. App must work offline.
