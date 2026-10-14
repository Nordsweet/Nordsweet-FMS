# Map appearance — legacy reference

Owner request: reproduce the original map's colors, icons, labels, sizes and
scaling in the typed application. Reference: live Sites `/airspaces-map` and
`/airspaces-map?embed=1`, and legacy main `5265bc5`.

The map remains a MapLibre React feature. Offline sprites render the original
canvas paths at a pixel ratio of two; no legacy runtime or globals are loaded.
Chart labels use two local canvas surfaces (cached static chart and moving
traffic/GPS labels), preserving the original system fonts without thousands of
DOM markers competing with accelerated GPX replay and phase/event updates.
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

Label policy follow-up (2026-10-14): preserve the original staged display.
At legacy zoom 9 (MapLibre 8), show valid ICAO codes and point names. At legacy
zoom 10 (MapLibre 9), show full airport names, non-ICAO landing-site names,
elevation and runway length. Airspace names remain visible at every zoom when
Labels is enabled, as explicitly confirmed by the owner. Traffic names retain
the original strict longitude-span threshold of less than 8 degrees.
`record-map-labels.cjs` records the original canvas output at both boundaries;
golden tests cover enabled/disabled labels, ICAO validity, name normalization
and the traffic boundary.

Browser comparison of the live reference and local render, desktop and narrow
layouts; regression coverage for palette, zoom ratio and displayed layer names.
Map interaction tests now project using the rendered camera rather than assuming
a fixed zoom and screen size. Existing import, route editing, restrictions,
traffic history, destination reveal, GPS, persistence and offline tests remain.

Traffic, route waypoint and GPS vector labels retain their legacy independence from the Labels checkbox. Traffic labels use the strict longitude-span boundary below 8 degrees.

Control shape follow-up (2026-10-14): tool rail and shared Map/Fly Layers button use 3.45rem squares with 13px corner radius, matching original flight tools. Owner requested Layers to be square too. EMER has white text and red rgba(255, 0, 0, 0.75) fill, including its expanded state.

Airspace caption policy (2026-10-14, supersedes unconditional legacy zone labels by owner request): hide below legacy zoom 9 / MapLibre 8; show class/designator at that zoom; at legacy zoom 10 / MapLibre 9 show the descriptive name below it only when the entire centered text rectangle fits inside the projected polygon, excluding holes and concave cuts. Otherwise retain the short designator.

Button-by-button audit (2026-10-14, against main `airspaces-map`): the Route / Radio / Zones
inventory now uses the legacy sidebar layout (stref / punktów trasy / przecięte tiles, underlined
tabs, cards with service tags, legacy TWR/RDO and FIR/FIS titles, hot tags for active zones).
Point, segment and airspace popups open beside the click like the legacy menus. The point popup
has the legacy kind | coordinates line, Add/Remove toggle, `WX` and Below / At / Above restriction
buttons; the airspace inspector has the legacy title, meta line, feet grid, type-coloured bars,
dashed planned line, GPS line, legend and zone/service list. The map search button moved to the
map's top-left so it no longer covers Build route or the popups. Kept on purpose: Departure /
Destination / Weather popup actions (map flight planner), no SafeSky/direct-source loaders
(Collector is the single source).
