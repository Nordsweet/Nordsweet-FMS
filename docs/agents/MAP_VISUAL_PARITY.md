# Map appearance — legacy reference

Owner request: reproduce the original map's colors, icons, labels, sizes and
scaling in the typed application. Reference: live Sites `/airspaces-map` and
`/airspaces-map?embed=1`, and legacy main `5265bc5`.

The map remains a MapLibre React feature. Offline sprites render the original
canvas paths at a pixel ratio of two; no legacy runtime or globals are loaded.
Collector-backed data and the existing preparation flight draft remain the
sources of state. The previously requested Settings / Flight Planner / Map
navigation and automatic sharing of graphical route edits remain in place.

## Appearance inventory

- Original undimmed OpenStreetMap and `#05070b` black background.
- Original per-type airspace strokes, translucent fills, active-zone colors,
  line widths and labels.
- Controlled airport cross/circle, uncontrolled runway/circle, landing-site
  circle, VFR triangle, IFR dot and VOR, VOR/DME, DME, NDB and other navaid paths.
- Original black/white traffic arrows, caution/amber/red variants and the blue
  C172-style ownship path; preserve projected positions and fading.
- Magenta route, white route-point circles, map labels and original traffic
  identity/detail lines; airport labels appear at the original pixel scale.
- Poland bounds, 28px fit padding and proportional zoom factors 1.3/0.77.
- Light chart controls, dropdowns, layer/type sections and draggable detail
  card; original Layers button size, palette and placement.
- Bottom route/coordinates/GPS pills and top-right attribution.
- Generic ADS-B/Flarm source, registration metadata and 3-second destination
  name reveal retain the owner's earlier corrections to the legacy version.

Preparation keeps its graphical planning form and the current application
header. Flight shell panels belong to the separate in-flight conversion area.
Live data counts, traffic positions and airport inventories can differ between
the legacy data bundle and the Collector, independently of chart styling.

## Verification

Browser comparison of the live reference and local render, desktop and narrow
layouts; regression coverage for palette, zoom ratio and displayed layer names.
Map interaction tests now project using the rendered camera rather than assuming
a fixed zoom and screen size. Existing import, route editing, restrictions,
traffic history, destination reveal, GPS, persistence and offline tests remain.
