# Terrain and wind-aware glide reach (2026-10-18)

## Inventory and intended difference

Owner-requested new feature, replacing PR39's horizontal current-trend circle. The original FPL,
EMER phase/reference restrictions, target stability and explicit ending remain unchanged.

- Map and Fly Layers: persisted **Terrain 3D**, 45° initial pitch, mouse/touch rotation (0–60°),
  terrain-fitted chart layers, ground-aware DOM markers/picking/ownship follow, source attribution.
  Camera target elevation follows cached DEM so high zoom does not move the camera underground.
  3D uses OSM texture or the selected Fjord/Dark Matter vector style on real 1× vertical-scale terrain.
  The selected 2D basemap returns on disabling it.
  Missing meshes show a notice; the user can switch back to 2D.
- **Cache terrain for flight route**: bounded regional DEM preparation (16 centres, 12 NM around each,
  spaced at most 10 NM). Counts are tile fetches, potentially repeated, not guaranteed whole-route coverage.
- Engine Out: terrain/wind footprint with holes and turning detours, explicit terrain clearance
  (default 150 m / 492 ft), live GPS-estimated wind or explicitly confirmed pilot wind/calm.
- No fresh height/descent/GS/track, no wind, missing origin DEM or no descent => no footprint.
  Missing individual cells are barriers. No fallback circle or assumed zero wind.
- Manual instrument AMSL/V/S retained, priority for 20 s. Sink smoothing never mixes GNSS and instrument sources. Optional GNSS height corrected by bundled
  coarse EGM96, measured altitude accuracy <=30 m, horizontal accuracy <=100 m, 5–10 s regression,
  residual <=10 m, gaps <=5 s; replay rejected. GNSS does not become an altimeter.
- GNSS planning measurements publish at most every 10 s; live wind is held for up to 30 s between
  planning snapshots, with current freshness/altitude/interruption gates still applied. This avoids
  replacing a running solve on every GPS tick. Input age limit 20 s; pilot wind expires after 10 min and is scoped to the current emergency.
  Wind/measurements/reach are runtime state, not restored as live guidance on reload.
- Green airports additionally require the complete displayed approach, including final, to pass
  wind/time/DEM checks and finish above threshold elevation. A nearer target is not automatically green.
  A blocked or unverified selected approach stays dashed. Turning reach may include destinations that
  the existing direct approach cannot validate, so these do not become green automatically.

## XCSoar research and licensing

Reviewed [XCSoar](https://github.com/XCSoar/XCSoar) at
`a9f2432fbf7ce4809585087b9f5114829efc7cb9`:

- `src/Engine/Route/ReachFan.cpp`, `FlatTriangleFanTree.cpp`, `FlatTriangleFan.cpp`,
  `ReachFanParms.hpp`, `RoutePolar.cpp`, `RoutePolars.cpp`, `Config.cpp`;
- `doc/manual/en/ch03_navigation.tex` (reach section), `src/Geo/Geoid.cpp`.

XCSoar intersects directional wind/polar glide fans with terrain and configured safety height,
then recursively explores turning reach around obstacles, preserving inaccessible islands.
The manual describes straight/turning reach, bounded turns, safety/task polars and no terrain clearance
at an actual landing destination. Its default terrain safety height is 150 **metres**.

This app uses an **independent TypeScript implementation**, not a port of GPL algorithm code or an
assertion of numerical XCSoar parity. Heading-state minimum-altitude-loss search on a bounded grid
supports 16 directions and <=90° transitions. Costs use a full wind triangle, measured sink and
3°/s turning time. Turn terrain checks cover 2 rate-one radii plus up to 30 s wind drift, conservatively
using the bounding square. Diagonal/knight edges check all swept cells, preventing corner cutting.
DEM cells use maxima over every contributing source pixel plus a one-pixel halo. The output is the
union of reached cell quads and exposed edges, not a convex hull filling blocked ridges/holes.

Grid is up to 129×129 at >=200 m, capped at 100 km radius. Regional download chooses zoom 11 down to
7 to stay within 64 tiles. Reaching the computation boundary is disclosed. An emergency worker stays
local and alive for its session; input ids reject old results. No CDN worker is required.

**No verified power-off polar is available for the selected aircraft.** The current sink is held
constant, TAS inferred from measured ground velocity minus wind, with uniform wind. There is no
bank/load-factor sink polar, speed optimization, thermal climb or terrain-driven wind field. Initial
headings are free like a fan from the origin; this is planning reach, not guaranteed initial-turn
clearance. The existing approach connector remains its rate-one geometric model; wind is applied
when checking travel time, not a full aircraft-dynamics validation. The graph is deliberately
conservative spatially but does not prove a continuous optimal aircraft trajectory. Do not copy
XCSoar glider polars into FR172H or invent a glide ratio. Add verified aircraft polar inputs before
claiming aircraft-specific performance or XCSoar-equivalent results.

The one reused XCSoar **dataset** is `Data/other/egm96s.dem` (180×90 bytes, 2° spacing, value−127 m),
independently bilinearly sampled here. `public/data/egm96.json` is a lossless conversion with source,
licence and SHA256. Original DEM/HDR and GPL-2.0-or-later COPYING are in `docs/terrain`; attribution,
original download links and full licence are shipped in `/terrain-attribution.html`.
`H_MSL = h_ellipsoid − N_EGM96`; DEM height must never be subtracted to derive AMSL.

## Elevation source, data boundary and offline

- [AWS Open Data Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), Mapzen/Terrarium,
  public CORS URL `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png`.
- [Terrarium format](https://github.com/tilezen/joerd/blob/master/docs/formats.md):
  `R×256 + G + B/256 −32768` metres. R=0/transparent is unknown.
- [Source mix](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md) and
  [mandatory attribution](https://github.com/tilezen/joerd/blob/master/docs/attribution.md)
  reproduced in the bundled attribution page. EU-DEM/SRTM and other regional products have varying
  age/resolution (zoom 11 is roughly 50 m in Poland; analysis cells are coarser). Bare-earth surface
  is not a building/wire/tree database. Negative elevations are clamped to water level in analysis,
  conservatively excluding some below-sea-level land. Polar/antimeridian regions are not validated.
- [deck.gl TerrainLayer](https://deck.gl/docs/api-reference/geo-layers/terrain-layer), Terrarium
  decoder and local loaders. TerrainExtension fits 2D chart overlays to the mesh.
- Terrain data enters via `api.terrain` / `src/api/terrain.ts`, a source not provided by the collector.
  No private token, proxy, scraping or changes to collector aviation contracts.
- Decoded Float32 DEM tiles use structured-clone IndexedDB (384 tiles, ~96 MB, bounded eviction),
  memory promises/resolved heights (128 each). Raw image tiles share the bounded map SW cache.
  DEM disk writes are batched outside the download/solve path; explicit offline preparation waits
  for its batch. Regional query arrays are excluded from JSON query persistence to preserve typed-array semantics.
  Offline works for cached DEM and a cached app, not areas never downloaded; eviction/storage denial
  can reduce coverage. 3D texture/mesh loading uses the SW cache; analysis uses decoded IndexedDB.
- Bundled EGM96 and hashed worker chunks are precached by the static export service worker.

## Verification

Actual EPNT Terrarium tile `11/1138/699` returned HTTP200 with CORS; pixel16/75 decoded to
605.96875 m. Recorded PNG/URL/SHA256 are under `nextjs/tests/fixtures/terrain`.
Synthetic raster fixtures support deterministic browser checks without a terrain service dependency.
Unit scenarios cover decoding, source-pixel ridge preservation, unknown barriers, geoid correction,
wind asymmetry/crosswind, ridge occlusion, turning detours, holes, clearance and approach checking,
and rejection of noisy/gapped GNSS trends. Browser checks cover 3D/reload/local loaders, terrain/wind
reach, offline recalculation, IndexedDB reload with the DEM service unreachable, automatic GNSS
correction, removal after staleness, and missing DEM without a circle.
Final gate results are recorded in the changelog/PR.
