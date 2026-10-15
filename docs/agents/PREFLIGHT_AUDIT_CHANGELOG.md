# Preparation-mode audit and changelog

Audit date: 2026-10-13. Target: <https://dev.fms.lab.vibecde.com/>.
Reference: <https://nordsweet-performance-calculator.mrnordsweet.chatgpt.site/> and legacy main
`5265bc5de9510aa3d83cc469860a730962b96c78`. Starting develop: `2f289ed6dc8d7b7c3186b100577c787c64df1de2`.
Branch: `codex/preflight-parity-audit`.

## CI follow-up (2026-10-13)

GitHub Actions run 38449558745 failed because the map migration E2E still used
the removed preparation-map Start navigation button and Fly header link.
The test now enables GPS, opens the flight view, starts the mocked flight there,
and verifies route sequencing and reload persistence before returning to the
preparation map to check saved restrictions. It also asserts that preparation
does not expose navigation start/end controls. Application behavior is unchanged.

## Map label follow-up (2026-10-14)

Restored the original two zoom stages: ICAO codes and point names at legacy zoom 9, full airport names, elevation and runway length at zoom 10. Airspace names remain visible at every zoom. Route/GPS labels ignore the Labels checkbox; traffic labels use the original view width below 8 degrees independently of that checkbox. Golden fixtures record the reference implementation around both thresholds.

## Map/Fly control shape (2026-10-14)

Tool rail buttons and the shared Layers control now use the original flight-tool dimensions: 3.45rem square and 13px rounded corners. EMER uses a 75% red fill and white text in both collapsed and expanded states. Phase tabs retain their original tab shape.

## COMMs suggestion follow-up (2026-10-14)

Removed the Estimated change section and its timing/speed/ATC note block. The flight view now shows a dismissible Suggested Frequency Change popup during the last 120 seconds before the predicted next sector boundary, independent of the COMMs panel. Frequency and callsign come from the existing radio estimate; FIS services include (FIS). A dismissed transition is not repeated. No suggestion without a fresh GPS fix, predicted boundary or next channel. COMMs and the popup share one estimate; PL/EN messages are included.

## Traffic details and track follow-up (2026-10-14)

Aircraft details now open beside the projected aircraft position and follow map movement, with viewport clamping and manual dragging retained. Removed Registration and Destination tiles and the destination API query. Collector history accepts null/missing callsigns; unlabelled samples are retained within the current flight segment, server history is merged with newer local samples and refreshed every 15 seconds. Different confirmed callsigns and observation gaps still separate flights/segments.

## Staged airspace captions (2026-10-14)

Hide airspace labels in the distant view. At the point-name zoom show only class/designator (R 11, P 23, TR 165). At the next zoom show the centered full name below it if both text lines fit entirely inside the projected polygon; holes and concave boundaries are respected. This intentionally replaces the original always-visible zone-name rule per the owner’s new request.

## Compact reporting-point captions (2026-10-14)

Map/Fly captions now use the existing compact VFR alias: EPNT ALFA → EPNTA, EPNT BRAVO → EPNTB, etc. The same format is used for reporting points drawn as route markers.

## Plan airport fix visibility (2026-10-14)

Map/Fly runway thresholds and terminal SID/STAR fixes are shown only for planned departure/arrival airports and the active navigation destination after diversion. Ordinary reporting points and shared airway fixes remain global. Symbols and captions share the filtered list. Published SID/STAR leg coordinates supplement the map only for selected airports. Added a Divert action in airport details: navigate directly to that airport while retaining timers/track; the diversion airport persists across reloads and direct-to fixes; resuming the original route or ending the flight removes it from the map filter.

## Acceptance inventory

Map appearance follow-up: restore the legacy map palette, local chart symbols,
route/traffic labels, Poland bounds, proportional zoom, light controls and
detail cards; see [map appearance inventory](MAP_VISUAL_PARITY.md). The typed
map adapter, Collector and shared preparation draft remain in use.

The legacy Home screen exposes Aircraft, Route, Fuel, W&B, Saved Flights and Settings before
Start a flight. Develop additionally exposes Weather, Performance/taxi, Map and Checklists.
The live comparison used P2006T, EPKK to ACHA, 3000 ft and 120 kt; reference source and automated
fixtures cover additional aircraft and airports. This is functional parity, not pixel parity.

| View                                      | Controls inspected / verification                                                                                                                                                                                                                                              | Result                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home / Aircraft                           | Aircraft types, registration profiles, FREDA Auto/Exact/Estimated, last state/MTH, summary; empty and selected aircraft                                                                                                                                                        | Preserve existing profile behavior; missing endpoints now default to the configured home airport (EPKK fallback) when selecting an aircraft. Existing routes are retained.                                                                                                                                                                    |
| Route                                     | Departure/destination/alternate lookup, long airport identifiers, altitude, speed/ECO, route text, SID/STAR/approach NONE/AUTO/explicit choices, invert, route strip, waypoint altitude/restrictions/type, waypoint WX, schedule, economy, vertical profile, route-only import | Existing route calculations retained; increase airport input limit to 64 so CUP identifiers and airport names are not truncated. Schedule and WX dialogs inspected live; procedure/route behavior covered by existing regression tests.                                                                                                       |
| Fuel                                      | Trip/start-taxi/climb/departure-arrival/alternate/final reserve/contingency/block rows, manual fuel and time overrides, FOB/fuel added, margins and notes                                                                                                                      | Existing calculation regressions retained. Legacy manual fuel rows now migrate into the modern draft.                                                                                                                                                                                                                                         |
| W&B                                       | Aircraft stations, linked usable/required fuel, mass/moment rows, envelope chart, loading warnings                                                                                                                                                                             | Existing calculation regressions retained. Legacy pilot/co-pilot/passenger/baggage masses and block fuel migrate.                                                                                                                                                                                                                             |
| Saved Flights                             | Header save, library list, import, load, rename, delete, per-flight export                                                                                                                                                                                                     | Fixed header save to immediately create a new snapshot and download .nord without switching workspace. Add rename with unchanged snapshot date, per-row .nord and GPX/KML exports. Load returns directly to Current flight / Route. Import creates independent copies and resolves the alternate. Mutation failures have translated feedback. |
| Settings                                  | Language, home airport, pilot mass, ATIS autoscroll, checklist autoscroll, checklist voice                                                                                                                                                                                     | Add airport suggestions while preserving text/alias entry. Restore both autoscroll toggles and female/male preference, migrate remembered voices, validate persisted settings.                                                                                                                                                                |
| Weather (additional preparation view)     | Departure/destination/alternate METAR/TAF, ATIS age/staleness/QNH disagreement, community report form, NOTAM/source status, chart links, loading/unavailable states                                                                                                            | Keep collector-backed data and existing mocked community submission test (no live report submitted). Wire ATIS autoscroll to expanding reports. Replace obsolete provider-specific source footer with Aviation API Collector.                                                                                                                 |
| Performance (additional preparation view) | Takeoff/landing runway and configuration, OAT/QNH/wind, Fill from METAR, PA/DA, distance/speed/wind limits and warnings                                                                                                                                                        | Persist entered conditions per phase/airport/aircraft in the typed flight. Preserve existing calculations and defaults (15 C, QNH 1013, calm wind).                                                                                                                                                                                           |
| Taxi (additional preparation view)        | Departure stand to holding point, arrival runway to stand, selectable endpoints, connectivity/no-route result                                                                                                                                                                  | Persist endpoints per phase/airport. Validate remembered endpoints against the selected airport so choices cannot leak between airports.                                                                                                                                                                                                      |
| Checklists (additional preparation view)  | Phase/list selection, item checks, progress, reset, read/stop speech, next-item scroll                                                                                                                                                                                         | Honor settings and remembered voice. Retain independent progress when switching checklists, navigating or restoring the draft. Reset clears the selected checklist.                                                                                                                                                                           |
| Map (additional preparation view)         | Preparation route, base map/AUP selectors, airspace/airport/waypoint/nav/traffic layers, track up, fit route/Poland, import controls, details and offline behavior                                                                                                             | Existing map conversion retained; preparation map opened live. Existing map regressions run, excluding the navigation-start scenario. GPS permission and Start navigation were not activated.                                                                                                                                                 |

## Changelog

- Restore the legacy immediate Save a flight action, independent snapshots, rename, load-to-route,
  individual flight exports and GPX/KML route exports.
- Extend .nord with an optional Zod-validated `plannerState` containing fuel, W&B, preparation
  conditions, taxi choices and checklist progress. Keep the original version-1 route envelope,
  which legacy can still read. Older .nord files remain supported. Preserve legacy custom names.
- Validate imported and migrated routes (including coordinate bounds) before replacing a draft; malformed library routes are skipped.
- Migrate same-origin legacy aircraft/registration/last-route, fuel and W&B draft data once. A
  valid modern draft or any edit/load made while migration is running wins over legacy data.
- Restore ATIS/checklist autoscroll and voice preferences, including legacy remembered voices.
- Persist preparation conditions and airport-specific taxi choices in the flight schema, with
  defaults for older snapshots; retain checklist progress per aircraft/checklist.
- Restore home-airport suggestions/default route initialization and allow full airport identifiers.
- Add PL/EN strings, save/error feedback and regression coverage for restored workflows.

## Intentional differences and exclusions

- Start a flight, Fly, Start navigation and flight-mode screens were not exercised. Their scenarios
  are explicitly excluded from this audit's browser suite. Their ongoing work belongs to the
  in-flight work-board owner.
- The owner's documented exclusions remain: company flights/auth, five data editors, PFD and
  embedded PDF/taxi chart viewer. Existing chart links are retained. Legacy client API-token
  settings are intentionally replaced by the collector; no tokens/proxies/scraping added.
- Weather, Performance/taxi, Map and Checklists are extra preparation views in develop. Full legacy
  flight-mode ATIS pad/AWOS, climb/glide panels and taxi overlay remain separate backlog, not
  claimed complete by this preparation audit.
- Reactive route updates replace legacy Calculate. Existing documented pressure-altitude formula,
  economy altitude, SD-4 fuel, insufficient-fuel landing-mass and W&B phase-card differences remain.
- The same live route measured 216.3 NM in both apps. ETE was 01:49 in legacy and 01:47 in develop:
  legacy used calm/default conditions, develop collector METAR supplied a 2 kt tailwind. These are
  different inputs, not evidence of a route calculation defect.
- Voice ranking uses whole-word gender/name hints: legacy substring matching could classify
  `female` or `Samantha` as male. This correction has a regression test. Available voices still
  depend on the browser/OS; an unavailable voice falls back to language-compatible voices.
- Legacy exports route-only files; new exports additionally preserve full preparation inputs.
  Checklist progress survives reload in the new app. Neither extension changes legacy readers.
- Browser storage is origin-specific: local migration cannot access the Sites origin from the dev
  origin. .nord export/import is the transfer mechanism across those hosts.

## Validation

- Modified files formatted with the repository Prettier configuration; whitespace checks pass.
- ESLint, Next route type generation and TypeScript pass.
- 135 Vitest tests pass, including legacy golden calculations, schema/file round-trips, settings,
  voice selection, migrations and protection against delayed draft replacement.
- Production static build/export passes, including the service worker asset manifest.
- 21 Playwright preparation tests pass, including offline, route/procedures/WX/schedule,
  fuel/W&B regressions, save/download/rename/.nord/GPX/KML/load, preferences and condition/taxi persistence.
- Explicitly excluded: `flies the route`, `map restrictions persist and navigation shares flight
state across pages`, and `legacy URLs land on the new screens` (includes a PFD/Fly redirect).
  The complete suite was not run because the owner asked to avoid flight start.
- Existing traffic-map fake-clock fixture now uses a consistent timestamp and pauses relative to
  browser time; slow runs cannot create future history samples or pause in the past.
- Local browser verification confirms immediate Save stays on Current flight and adds the snapshot;
  the library displays Load/Rename/.nord/GPX/KML/Delete, and Settings shows the restored preferences.
- No flight was started during the audit. Changes are on the feature branch for review; the
  deployed develop site changes only after integration into develop.

## Owner correction: preparation navigation and map planner

- Preparation navigation contains exactly three controls: Settings (gear icon), Flight Planner,
  and Map. Remove Fly/Checklists and the header language toggle. Language is selected in Settings.
  Flight Planner opens the Home flight form; Map opens graphical planning.
- The map and form observe one persisted flight draft: graphical airport/waypoint/route edits appear
  in Flight Planner automatically, without importing, copying or creating another flight. Switching
  screens and reloading retains the same route. Header navigation replaces redundant local return links.
- The standalone Map is a preparation planner: add an airport/parameter sidebar, distance and ETE,
  shared route-point list and deletion of map-added points. Existing clicks on airports/VFR points
  and empty map positions can set departure/destination or add a waypoint; the same persisted
  flight is used by the form, saving and exports. Coordinate routes use a straight-line distance/ETE
  fallback when no airport procedure plan is available.
- Remove Start navigation from the standalone preparation map. Embedded flight-map behavior remains
  unchanged. No flight or navigation was started while verifying this correction.
- Inspiration reviewed: [vfr-planner](https://github.com/bwilczek/vfr-planner), particularly
  [FlightPlanSlider](https://github.com/bwilczek/vfr-planner/blob/master/client/src/js/components/FlightPlanSlider.jsx)
  and [MapLeaflet](https://github.com/bwilczek/vfr-planner/blob/master/client/src/js/components/MapLeaflet.jsx).
  Reuse Nordsweet's typed planner and MapLibre; no React/Redux/Rails code copied.
- New browser regression checks the header links, absence of Start navigation and map-to-form
  airport/altitude synchronization. The checklist screen test now opens its route directly because
  the owner removed its preparation navigation link.

Verification of this correction: formatting, lint/type checks, 135 unit tests and static build pass. The 23 preparation browser tests passed; both map-planner regressions passed again after final empty-state fixes, including GPX coordinate planning, removal and reload persistence.

## Control-by-control crawl (claude, 2026-10-14)

Legacy main's static site (`git archive main`, served locally) and develop were crawled with the same
setup (P2006T, EPKK → EPGD, alternate EPWA): every visible control per tab, every route dialog
(Economy, Vertical profile, schedule, airport search, waypoint WX), Save a flight, the saved-flight
row actions and Settings.

| Area                          | Result                                                                                                                                                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aircraft                      | Same controls (type, registration incl. registration-specific profiles, FREDA indication, MTH, last state).                                                                                           |
| Route                         | Same controls, SID/STAR/approach option labels identical. Legacy CALCULATE intentionally replaced by live recalculation.                                                                              |
| Route dialogs                 | Economy (with Apply), Vertical profile, schedule, airport search and waypoint WX match.                                                                                                               |
| Fuel                          | Same rows, inputs and notes.                                                                                                                                                                          |
| W&B                           | Added the legacy Phase tile and the yellow condition rows / gradient Useful load band.                                                                                                                |
| Save a flight / Saved flights | Same immediate save + .nord download. Unnamed snapshots are now named after the route ("EPKK -> EPGD / 262.5 NM") and rows show aircraft type and "Saved <date>"; develop adds GPX/KML/.nord per row. |
| Settings                      | Same preferences; company login and API tokens remain out of scope / replaced by the collector.                                                                                                       |

Legacy main bug not replicated: every route point gets an "At 0 ft" altitude restriction without
user input, which pins the profile to sea level (no TOC, one conflict) and changes trip time/fuel.
Production (older) and develop do not have it; numeric comparisons were therefore taken from the
earlier production parity runs. The NAVDATA status count differs only because legacy counts every
routable point (waypoints, VFR points, airports); no navdata point is missing.

Follow-up (2026-10-14): the Flight setup › Aircraft card now has exactly the legacy tabs — Aircraft,
Route, Fuel, W&B. Weather (with Insert ATIS), runway performance and taxi are reached as in legacy
from the flight view's WX, RWY and ROUTE panels; browser tests now open them there.

## Map object search (2026-10-14)

Added a rounded-square magnifier directly below OPTIONS in the flight rail and a search control on the preparation map. Submit a point/airport identifier or name, zone designator/name, or aircraft callsign, registration or HEX. Matching ignores case, separators and accents; TR165 = TR 165 and SPGUN = SP-GUN. Exact identifiers win; ambiguous matches offer a choice. Selection stops GPS follow, centers/fits the map, highlights the object and opens the existing details/actions. Required point/traffic layers are enabled. Static data stays searchable offline; SID/STAR search includes published coordinates even when the airport is outside the active plan. Search does not change that plan. Aircraft search refreshes Collector traffic up to its 250 NM limit around the map center; IATA flight numbers are resolved through the existing ADSBDB route service and then matched to a live aircraft (no position is invented). Closing/editing search cancels a pending UI result. PL/EN included. Validation: 182 unit tests, 34 browser tests, production export.

CI follow-up: the magnifier subscribes only to search state, and an empty selection no longer resubmits geometry every second. The existing GPX replay browser fixture retains its route, timestamps and phase/dwell checks with five-second samples, so CPU-only rendering at 20x does not exhaust its wall-clock deadline.

## Traffic label zoom (2026-10-14)

Owner-requested change: traffic labels now share the point-name zoom threshold (MapLibre 8 / legacy 9) in Map and Fly. The previous viewport-width condition (longitude span below 8 degrees) is removed, so screen size cannot change the threshold. Aircraft symbols and their details remain available while zoomed out. Traffic labels remain independent of the Labels checkbox. The label regression test covers just below/at/above the shared threshold.

## Flight-plan waypoint insertion (2026-10-14)

Add waypoint now opens a G1000-inspired FPL preview in the shared app dialog style, with DTK (magnetic), distance (NM), planned altitude (ft), a marked new point and Move up / Move down / Insert here tiles. The default minimizes additional great-circle distance between existing route legs. Clicking an FPL row places the pending point directly before it; manual slots also allow before-first/after-last. Only Insert here commits; closing/Escape leaves both routes unchanged. The selected row remains visible in a long plan.

Fixed the flight-mode bug: Add waypoint previously updated only the draft, while Map/Fly drew the persisted active route. Confirmation now inserts into both, preserving flight timers, track, and the current flown leg. Explicit before/after anchors (including occurrence and coordinates) keep the selected order after planner recalculation/reload in both airport/procedure plans and coordinate/GPX fallback plans. Old anchors remain readable. Explicit insertion supports intentional repeated fixes. Splitting a procedure leg recalculates its geometry instead of reusing its published course/distance, while retaining altitude/speed limits. Reference procedure data stays immutable. PL/EN included. Regression coverage includes optimal/manual positions, cancellation, controls, reload, repeated fixes, schema compatibility, airport plans and the active flight.

## Point and airspace popup anchors; SP-TDI type (2026-10-14)

- Point/airport options now appear next to the selected point. Airspace details appear next to the clicked map position (or the zone center when selected through search). Both follow map movement and resize and remain within the map viewport, using the existing aircraft popup placement.
- Owner-confirmed Mode S address `48e9fa` (SP-TDI) is corrected to aircraft type `C172` when collector traffic is loaded. Matching is case-insensitive by address and does not depend on callsign; unrelated aircraft metadata is preserved.
- Added regression coverage for point/zone popup placement and exact-address traffic correction.

## Traffic track continuity (2026-10-15)

- Fixed history merging: local observations between server samples are retained and sorted, rather than discarded whenever the server has a later sample. Duplicate timestamps use the latest local coordinates while retaining a known callsign when a live update omits it.
- Include the selected aircraft's latest reported fix immediately, so its confirmed trail joins the live-position projection even before the session observer processes that update.
- Preserve confirmed solid track sections across coverage gaps; join intervals longer than five minutes with dashed amber links instead of leaving empty breaks. These links connect observed endpoints and do not claim intermediate positions were received. Different callsign flights remain separated.
- Added regressions for sparse/interleaved history, duplicate timestamps, missing callsigns, latest live fixes, coverage gaps and flight changes.

## Weather-only panels and community ATIS consensus (2026-10-15)

- Airport Weather now opens only METAR, TAF and trusted ATIS/D-ATIS. Weather and ATIS are fetched in parallel through dedicated collector endpoints whenever the weather panel mounts; no aggregate airport/NOTAM or chart request is made. Partial weather or ATIS failures retain the other source.
- NOTAM and Charts remain separate airport actions. Removed the inline Share the ATIS you heard form while preserving Insert ATIS buttons and the existing ATIS pad/METAR chips.
- Single-device community ATIS is hidden from weather and cannot fill flight conditions. Insert ATIS shows it as an explicitly labelled suggestion with selectable structured field hints. Reading or applying hints sends no confirmation.
- The ATIS pad offers explicit hearing confirmation for an existing broadcast, or submission of a newly copied pad with information letter, UTC time, wind and QNH. The collector counts distinct persistent anonymous browser/device identifiers; repeated votes on the same broadcast count once, conflicting broadcasts do not combine, and identifiers are not exposed in the feed. Owner selected device/browser consensus rather than pilot accounts.
- Community ATIS is used as weather only when the server confirms at least two devices and the report is not stale. Provider ATIS remains available with its existing age/QNH indicators. PL/EN labels and regressions cover the new behavior.
