# In-flight map migration

Branch: `codex/inflight-map`, targeting `develop`.
Legacy reference: `main` at `5265bc5de9510aa3d83cc469860a730962b96c78`.
Develop base: `594a3ae756cb2738330f86c492d4b3856d57c6fc`.
Read `AGENTS.md`, `CONVERSION_GUIDE.md` and the work board before implementation.

## Architecture

`/map` is a thin route into `MapWorkspace`. Typed React panels replace legacy HTML popups;
deck.gl (camera, OSM tiles, overlay layers) is only the rendering adapter. Domain modules handle geometry, projection, fade,
route snapping, vertical limits, radio normalization and confirmed traffic history.
Map preferences use Zustand persist; local airspace imports use IndexedDB via `api.map`.
Flight restrictions/anchors use the existing flight schema, planner derivation and `.nord` boundary.
The app-shell `FlightRuntime` owns sequencing/recording across pages, with one shared native GPS
watch. Display-only GPS history is ephemeral; recorded in-flight state remains persisted.

Components use `api.*` procedures. Collector remains the source for airspace, activations,
VFR places, weather, NOTAM, traffic and traffic history. Existing bundled reference routers supply
IFR points, navaids, airport/runway data, frequencies and chart links. The adsbdb destination
lookup is encapsulated in a validated API procedure because collector does not provide flight routes.
No client-side collector tokens, CORS proxies, legacy runtime, iframe or global datasets were added.

## Acceptance inventory

The published standalone map was inventoried live in its initial state, Route/Radio/Zones tabs,
all AUP select states, and Black basemap. Local QA captures are in `nordsweet-map-legacy/` beside
the isolated checkout (`live-map-inventory.json`, `live-map-states.json`, screenshots).
Source was inspected for popup interactions and GPS/traffic motion; browser tests exercise the
new app's imports, point editor, traffic details and shared navigation. Live source data cannot
be compared numerically to deterministic fixtures; external feeds are mocked in browser tests.

| Legacy operation                                                       | New implementation / evidence                                                                                                |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Route input/build, fit, reset Poland, zoom/pan                         | MapWorkspace + deck.gl `MapController` (pan, zoom, rotate) and app buttons, shared planner                                                                      |
| OpenStreetMap / Black                                                  | Persisted basemap preference; legacy Black key migrates                                                                      |
| Current / next / no AUP; refresh                                       | Typed collector plan query, annotation removal for no AUP, explicit API refresh                                              |
| Legacy direct JSON/OpenAir/CUP feed loading                            | Collector-backed queries/refresh; local JSON/OpenAir import remains available                                                |
| Layer toggles, labels, all/clear type filters                          | Persisted settings, independent route/navaid layers, labels rendered without remote glyphs                                   |
| GPX tracks/routes/waypoints                                            | Namespace-aware boundary parsing; route persisted; single-point imports and ordered insertion; browser reload/error scenario |
| OpenAir polygons/circles, DMS/CUP/decimal coordinates                  | Pure parser + local IndexedDB imports, unit/golden/browser tests                                                             |
| Point add/remove, dep/dest, WX, NOTAM, charts                          | Typed point panel, reused planner dialogs and airport briefing/router data                                                   |
| Point speed/altitude at/above/below restrictions                       | Flight schema + route domain; normalized rounding; `.nord` round-trip and browser reload tests                               |
| Leg distance/true bearing/HH:MM, create anchored WPT                   | Pure snap + route anchor insertion; altitude interpolation and planner constraints                                           |
| Route / radio / crossed-zone summaries                                 | React tabs; endpoint radio phases, route-ordered FIS/FIR rows, limits and AUP times                                          |
| Overlapping-zone inspector                                             | Polygon hit testing incl. holes, per-zone planned altitude, live altitude, vertical profile, service rows                    |
| GPS follow/center, track up, pan detaches follow                       | Shared watch and animation adapter; background recording across page changes                                                 |
| Ownship, accuracy circle, track, five-minute vector/ticks              | Confirmed observations separated from animated position; GPS trail also works without starting a flight                      |
| Traffic refresh/viewport, 24 FPS estimates, fade, source/type/identity | Typed collector feed; generic ADS-B/Flarm source; 60–120 second fade; CPA colour thresholds preserved                        |
| Traffic selection, trace, two-minute projection                        | Collector history plus newer observations; current callsign only; gaps over five minutes split                               |
| Draggable traffic popup and Destination                                | Typed panel; adsbdb ICAO field; airport name shown for three seconds; browser assertions                                     |
| Offline map/data                                                       | Existing app precache + remote query snapshots; imported zones in IndexedDB; visited OSM tile cache bounded to 600 tiles     |
| PL / EN                                                                | Map strings in `i18n/map-tools.ts`, existing labels/briefing reused                                                          |

## Intended differences and limits

- Collector defines `A055` as 5,500 ft; legacy parsed it as 55 ft. Explicit unit test preserves the
  collector interpretation. UNL is unbounded in calculations and clipped only for profile drawing.
- Invalid GPX coordinates (including absent lat/lon) reject the file and preserve the existing route.
  Legacy `Number(null)` could insert 0,0. Unsupported OpenAir DA/DB arcs now reject explicitly;
  legacy ignored them and could silently draw a partial polygon. Tests cover these decisions.
- Great-circle geometry reuses the app's mean Earth radius (6371.0088 km), rather than introducing
  legacy's separate 3440.065 NM constant. This changes distances/projections by about 0.00013%.
- Legacy direct-source loader buttons and localhost fallbacks are replaced by collector-backed data
  and refresh, per the owner architecture decision. Geometry and activation coverage are the
  collector's coverage; no separate stale legacy geometry is merged behind it. Published legacy
  currently exposes an extra XYZ option that is absent from the referenced main implementation.
- The legacy CPA algorithm's time/vertical thresholds are preserved, including the absence of a
  horizontal miss-distance threshold. It is not a new traffic-conflict prediction algorithm.
- Traffic observations/history are not restored as live positions from localStorage. The selected
  destination depends on adsbdb availability; failed lookups display a dash. Confirmed traces never
  combine an airframe's previous callsign with its current flight or bridge missing observations.
- Offline OSM support covers visited tiles, not a predownloaded geographical region. Imported
  zones and cached API data remain available; new network data still requires connectivity.
- PFD, chart PDF/taxi viewer, editors, company flights, and the wider Fly timers/FREDA/debrief/COMMs
  estimation backlog remain outside this map claim. Airport chart actions use existing links.

## Validation

Prettier, ESLint, Next route type generation, TypeScript, Vitest, production static export and the
full Playwright suite were run from `nextjs/`: 124 Vitest tests in 25 files and 22 Playwright tests passed. Visual QA of the imported-point restriction panel found no page errors; captures remain local.
The pnpm launcher tried to reinstall the shared dependency junction and refused its external target;
the same installed tool entry points were run directly in the repository's prescribed order.
Worker copy and Playwright export-server startup scripts now work on Windows as well as POSIX.

## Map engine: deck.gl (2026-10-15)

The map moved from MapLibre GL to deck.gl so the overlays scale: moving traffic, trails and labels are
GPU layers (no GeoJSON re-tiling in a worker, no 2D-canvas label pass on every frame).

- `features/map/deck/` — `deck-map.ts` (`Deck` + `MapView`: camera, `project`/`unproject`, fit, follow,
  picking), `scene.ts` (the layer stack, bottom to top, and `DeckScene.set(patch)`, which rebuilds it
  once per tick), `data.ts` / `labels.ts` / `captions.ts` (pure data builders), `atlas.ts` (one icon
  texture per theme, cut from `symbols.ts`), `markers.ts` (DOM waypoint buttons), `theme.ts`.
- Basemap: default Fjord (OpenFreeMap vector); the OSM `TileLayer` loads `/tiles/{z}/{x}/{y}.png`, an nginx disk cache (7 days, request-coalesced) in front of `tile.openstreetmap.org` (`nextjs/deploy/nginx.conf`; `next dev` rewrites it). `public/sw.js` keeps up to 2000 visited tiles (oldest-touched first; stored and evicted off the tile response path). Own-ship in the lower
  half while following uses a camera offset instead of MapLibre's view padding (padding fights panning).
- Dark map: new `night` basemap ("Dark map") = the same OSM tiles with their lightness flipped in a
  shader (no second tile provider); `dark` ("Black") is unchanged. Both use the dark overlay palette
  (`theme.ts`: lighter symbols, labels, airspace outlines, own-ship blue).
- Fjord map (`fjord` basemap): [openmaptiles/fiord-color-gl-style](https://github.com/openmaptiles/fiord-color-gl-style)
  ported rule by rule to deck.gl (`deck/fjord.ts`: colours, widths, zoom ranges, filters; a `TileLayer` with
  our own tile loader). Its MapTiler source needs a key, so tiles come from OpenFreeMap (same OpenMapTiles
  schema, no key; credit shown). `public/sw.js` caches its tiles for offline and takes the TileJSON network-first.
  Not ported: road/water name labels (text along a line) and sprites. Place labels are decluttered on the CPU
  (`declutter`), not with deck's GPU collision filter, which needs depth testing and could not be verified.
  Tiles are parsed on the main thread (`@loaders.gl/mvt`): the stock MVT layer loads a worker from unpkg.com.
- Intended differences: the zoom/scale/attribution controls are ours (`map-scale.tsx`, a text attribution);
  a click on stacked symbols prefers the aircraft, then the airport, within 2 px; an aircraft's "flarm" and
  "ground" icons were always identical to the default icon and are no longer separate sprites.
- Not changed: DOM waypoint markers and popups (React), label zoom stages, AUP/airspace logic, offline cache.

