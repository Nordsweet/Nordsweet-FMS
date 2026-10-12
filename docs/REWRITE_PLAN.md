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

### 2. Core flight plan (MVP) — 12–20 h ✅ core done
Delivered at `/v2`: aircraft (11 profiles, `public/data/aircraft.json`), route with airport/waypoint
search, nav log with WMM magnetic courses and wind, fuel plan (legacy components), W&B with envelope
check, take-off/landing distances from one generic POH engine, saved flights (IndexedDB, one-time
import of legacy saved routes) and `.nord` import/export compatible with the legacy planner.

Golden tests run the legacy functions: R172K within 0.01 m, P2006T within 1 m. Intended differences
and data fixes are tested: full tailwind beyond POH limit, unknown surface = grass, warnings for
out-of-table/untabulated inputs (FR172H, SD-4), draft Husky data, rebuilt C172M/C152/FR172H envelopes.

Follow-ups done: climb from POH tables with TOC/TOD in the nav log (500 fpm descent assumed — no
POH descent data), and phone/tablet layout (no horizontal overflow, ≥40 px touch targets).
Still open: reserve/holding fuel at a holding power setting (it uses the chosen cruise flow, which
overestimates).

### 3. Weather & NOTAM — 6–10 h ✅ done
Delivered: briefing for departure/destination/alternate (METAR with age, staleness and source
agreement, TAF, ATIS with QNH cross-check, NOTAMs) from the Aviation API; fields without an ICAO
code use the nearest ICAO airport within 25 NM. "Fill from METAR" sets take-off/landing wind,
temperature and QNH (variable wind → worst-case tailwind, gusts shown). Forecast winds aloft per
leg from Open-Meteo at the pressure level nearest the cruise altitude, tied to the route/altitude
they were fetched for.

Not done: the legacy manual ATIS pad and waypoint weather; winds are for the current hour (flights
have no planned departure time yet).

### 4. Map — 10–16 h ✅ core done
Delivered at `/v2/map`: MapLibre GL with OpenStreetMap or a dark background (the legacy map now
offers only these two), airspace from the Aviation API coloured by class with zones active now
highlighted and a today/tomorrow (AUP/UUP) switch, airports, VFR points and IFR points/navaids,
the current route and alternate with labels, and tap-to-select (finger-sized hit area) to set
departure/destination or add a waypoint. Works offline except for base-map tiles.

Not done: direct-to and per-point speed/altitude restrictions (they belong with in-flight mode,
phase 5), GPX/OpenAir import, caching map tiles for offline use.

### 5. In-flight — 8–14 h ✅ core done
Delivered at `/v2/fly`: device GPS, active leg with automatic sequencing (abeam or within 0.3 NM,
never backwards), next waypoint bearing/distance/DTK/cross-track/ETE, destination distance/ETE/ETA,
direct-to, FREDA reminder every 30 min, airport frequencies, track recording, debrief with GPX
export; state survives a reload in flight. Live ADS-B traffic layer on the map (visible area,
10 s refresh).

Not done: the PFD screen (legacy PFD still available), COMMs hand-off prediction by FIS sector,
traffic proximity alerts.

### 6. Ground & procedures — 10–16 h ✅ core done
Delivered: SID/STAR selection (91 PANSA/private procedures; 32 dropped because a leg's waypoint has
no coordinates) as route segments around the waypoints — nav log, map, fly mode and `.nord` export
use the full route; taxi route (fewest elements) on the ground graph for departure and arrival —
useful mainly at EPKK, where the data is connected; AIP chart links per airport in the briefing
(cached once opened; not precached, 27 MB).

Not done: approach procedures and VFR circuits, the chart viewer with taxi overlay (charts open in
the browser's PDF viewer), runway/SID change during flight.

### 7. Checklists, economy, settings, i18n — 4–6 h ✅ done except route economy
Delivered: `/v2/checklists` — the aircraft's checklists by phase, tap to tick, progress, autoscroll
to the next open item, read aloud (Web Speech API, English voice). Settings and PL/EN were done in
phase 1. Phone layout pass for map/fly/checklists (layers menu, map fills the screen, 40 px controls).

Route economy done afterwards: POH cruise tables (P2006T, R172K, FR172H, Husky, SD-4) as one row
list; the cruise section lists each power setting at the nearest table altitude for the ISA
deviation, with trip time and fuel on the route (winds, climb, descent) and a "Use" button.

### 8. Data authoring tools — deferred
Skipped. Editing reference data becomes an admin feature once the backend exists.

### 9. Cleanup — 3–5 h ✅ done (2026-10-12)
Legacy app removed (`src/runtime`, `src/views`, legacy routes, legacy data scripts, the one-off
import scripts); the new app moved from `/v2` to `/`; old `.html` URLs redirect; Preflight on
(single root layout); manifest start URL `/`. `public/data/*.json` is now the source of truth.
Golden performance tests compare against recorded legacy outputs. Community ATIS (added on `main`
meanwhile) carried over with the required "unverified" labelling. Kept the hand-written service
worker (tested offline) instead of Serwist.

Dropped with the legacy app (not rebuilt): PFD screen, the five data editors (→ backend admin),
manual ATIS pad parsing, company flights, COMMs hand-off prediction, chart viewer with taxi overlay.

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
