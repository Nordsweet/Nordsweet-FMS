# Preparation-mode audit and changelog

Audit date: 2026-10-13. Target: <https://dev.fms.lab.vibecde.com/>.
Reference: <https://nordsweet-performance-calculator.mrnordsweet.chatgpt.site/> and legacy main
`5265bc5de9510aa3d83cc469860a730962b96c78`. Starting develop: `2f289ed6dc8d7b7c3186b100577c787c64df1de2`.
Branch: `codex/preflight-parity-audit`.

## Protect traffic-pattern insertion (2026-10-19)

- Add waypoint treats the departure and arrival circuits as protected blocks, including their
  threshold, exit guides and ARP. The first permitted slot is after the departure circuit;
  the last is before the arrival circuit. With adjacent circuits this is a single slot.
- Optimal insertion searches only permitted legs. Clicking protected rows is disabled;
  Move up/down stops at the permitted boundaries. The dialog explains the restriction in EN/PL.
- The active-flight store and persisted anchors apply the same rule. Recalculation preserves
  the selected side of an en-route fix when generated circuit targets are temporarily absent,
  and moves legacy endpoint anchors into the permitted en-route section.
- Regression coverage includes adjacent circuits, independent departure/arrival protection,
  legacy anchors, saved-plan recalculation, direct store calls, and browser acceptance/reload.

## FPL point actions and Direct/Divert continuity (2026-10-19)

- Every actual FPL fix has a red remove action and white three-dot options action. Removal
  updates the exact active row and matching manually inserted draft point; endpoint removal
  is supported without discarding airport metadata used by flight phases and weather.
- Options open the existing anchored point/airport inspector, including HOLD, Direct, Divert,
  restrictions and weather. The FPL closes and the map centers on the selected fix. The request
  is transient, while existing selection/close/map-click behavior is retained.
- Desktop uses inline actions; phone rows keep readable identifiers and DTK/DIS/ALT values.
  The synthetic DCT GPS origin remains internal rather than becoming a removable FPL fix.
- Direct/Divert freeze completed FPL geometry in a separate persisted map history layer, with
  the same solid route styling and a straight connector from the last passed fix to the DCT
  origin. Remaining navigation retains its existing ownship-to-target behavior. Repeated
  redirects before the next real fix replace that connector; passed DCT legs are retained once
  the next fix is passed. Skipped future fixes are not restored as flown or navigation targets.
- New-flight start clears history; reload restores it. Current-leg insertion/removal also retains
  completed geometry. History is not a source of navigation leg indices or map segment editing.
- Validation: formatting, lint, TypeScript/static export, 447 unit tests, 11 affected browser
  scenarios and both new scenarios rechecked on the final build. Phone/desktop FPL screenshots
  inspected; complete browser suite runs in PR CI before merge to develop.
  Focused FPL scenarios disable reference layers (covered separately), allow a 60-second software
  WebGL budget, and pass four parallel repeat runs; all functional assertions remain enabled.

## Circuit previews, flight phases and advance guidance (2026-10-19)

- Preparation previews now use the same route planner and navigation conversion as the accepted
  FPL, preserving fly-over flags and replacing arrival/departure procedures consistently.
  Tight Base entries get rate-one connector guides without shrinking the turn radius.
- Arrival entry fixes carry circuit AMSL altitude; descent follows TOD so the aircraft reaches
  that altitude by entry. Fly-over sequencing retains the fix instead of switching 0.3 NM early.
- Approaching the departure runway on the ground selects Take-off. Explicit pattern/Take-off/
  Taxi-out runway choices take precedence; without a selection use the nearest runway geometry.
  On-block now requires GS strictly below 2 kt for 20 continuous seconds; missing/stale samples
  and GS at/above 2 kt reset the candidate.
- Position source selection/Connector setup is available in Aircraft preparation before Start.
  Home Start passes the accepted patterns and aircraft type to the existing flight session.
- FPL and waypoint insertion share the same G1000-inspired DTK/DIS/ALT table, active-row styling
  and magnetic heading readouts. CENTER has white text and sits closer to the bottom edge.
- Route Heading/Altitude commands look ahead 30 seconds to the actual fly-by tangent, the next
  planned level or TOD. Countdown changes to NOW when due; history records only the clean
  instruction with its first NOW timestamp. Invalid/paused samples cancel pending predictions;
  already-required corrections are displayed immediately, with no invented past countdown.

- Validation: formatting, lint, TypeScript/static export, 444 unit tests and 90 E2E scenarios.
  Full browser run passed 88; the new 20-second On-block dwell required a longer stopped GPX
  fixture, and the unchanged Engine Fire scenario passed on isolated rerun after a local timeout.
  Final-build countdown/history test passed again. FPL/CENTER and Base previews inspected visually.

## Postflight readings and debrief statistics (2026-10-18)

- Debrief now accepts actual ending MTH and remaining fuel (litres). Accept switches to four
  responsive groups: MTH used/after, fuel used/after, Off-block→On-block UTC/Block Time,
  Take-off→Landing UTC/Air Time. Editing, window dragging and GPX export remain available.
- Capture the preflight airframe/MTH and planned starting block fuel at Start flight (both controls).
  These baselines remain immutable even if the planner or last-state record changes during flight.
  Accept records the ending state for the captured registration, clears the consumed fuel-added
  amount, and keeps the debrief and its accepted statistics through reload until the next flight.
- Actual stopped timers determine operational times, including midnight crossings. Closing a
  flight does not fabricate landing/on-block events. Unknown baselines or incomplete event pairs
  show unavailable consumption/duration; legacy sessions without a snapshot are supported.
- Validate required decimal readings, decreasing MTH and remaining fuel above starting fuel;
  preserve genuine zero values. Source fuel is the preflight block-fuel entry, not an estimated burn.
- Tests cover snapshots/airframe isolation, validation, missing and zero readings, midnight timing,
  accepted-statistic reload/editing, recorded remaining fuel and phone overflow.

## C172S from owner-supplied Carenado PDFs — 2026-10-18

- Added independent C172S (ICAO C172) selection, operating/stall reference speeds, all 111 cruise
  cells with US-gallon conversion, 20 normal phase checklists and 26 emergency reference variants.
- Added a source/limitations card and simulator-only labels. Missing W&B, distance/climb tables
  and fuel capacities stay unavailable; no values borrowed from another Cessna model.
- Added fixed-pitch RPM lookup, enforced the supplied lean-mixture 75% power constraint and
  generalized emergency source browsing to the selected aircraft/family. Existing FR172H remains
  separately scoped. Details and page inventory: [C172S_CARENADO.md](C172S_CARENADO.md).

## Resumed flight display and traffic advisories (2026-10-18)

- Add a 96px instrument strip above the Fly phase selector: altitude, ground speed, magnetic track
  and desired track, vertical speed, next-fix distance/ETE, UTC clock, GPS accuracy, device network
  and battery status, and height above terrain. Optional/stale data stays unavailable. Connector
  AGL/VS take precedence; device VS reuses the validated GNSS trend and DEM AGL uses EGM96 correction.
- Reserve map space below the strip and constrain tool popovers to that remaining height; the
  map and Layers panel remain within the phone viewport. Put the bell directly below FPL.
- Make the Flight Debrief title draggable by pointer/touch and movable with keyboard arrows,
  clamped to the map container and re-clamped on window resize. GPX export remains available.
- Replace live legacy CPA icon colouring with yellow TA / red close-region outlines around the
  intruder, plus matching warning borders in the shared popup system. Both warning levels enter
  bell history; dismissing TA does not suppress an escalation. No resolution maneuver is computed.
- Use the owner's fixed diagram thresholds: TA 40s/850ft, close region 25s/600ft, with 0.75/0.55 NM
  slow-closure DMOD. Time-align fresh reports, require conflicting CPA/vertical separation, and
  exclude stale, ground, paused and identified own-aircraft reports. Re-arm after 60 seconds clear.
- Reference: [FAA Introduction to TCAS II v7.1, Table 2](https://www.faa.gov/documentLibrary/media/Advisory_Circular/TCAS%20II%20V7.1%20Intro%20booklet.pdf).
  This is an informational public-feed model using fixed illustrative thresholds, not coordinated
  TCAS/ACAS logic; feed latency and GNSS/reported altitude datum differences remain limitations.
- Local coverage: traffic geometry/guard tests; browser checks for yellow-to-red escalation after
  dismissal and both history entries, live connector instruments, debrief movement/export and
  responsive map/terrain/basemap scenarios.

## Bell notification history (2026-10-18)

- Add a bell tile to the Fly rail and standalone Map. Its panel lists all five categories of
  displayed flight popups with the original message, category and local date/time to the second,
  newest first. An unread badge clears when the history is opened.
- Record through the shared popup component, once per notification ID per flight. Closing or
  expiring a popup does not delete its history or change its original timestamp.
- Persist the current flight history across Map/Fly changes and reload, offline. Retain it after
  ending the flight until another flight begins; validate restored entries before displaying them.
- Verify all-category deduplication and new-flight isolation in store tests; extend the phone
  popup scenario to inspect the bell, retained dismissed commands and timestamps after navigation
  and reload. Existing flight navigation scenarios remain green locally.

## Unified flight notifications (2026-10-18)

- Share one accessible popup card and responsive stack across Map and Fly: Heading, Altitude,
  Comms, Frequency and System Info. Use explicit foreground contrast, matching icons, category
  labels and consistent close buttons; simultaneous notices no longer overlap. Keep passive wind tiles
  below notifications and interactive map details above them so HOLD and other actions stay clickable.
  Reuse map guidance inputs and memoize geometry; expiry timers do not rebuild the flight planner.
- Add automatic route heading and climb/descent guidance. Headings use wind correction and magnetic
  variation, with connector heading preferred to inferred heading; vertical targets use active-fix
  restrictions, circuit/holding level and the planner's TOC/TOD profile events.
- Suppress guidance on ground, paused or stale/missing samples, and inside the 10-degree/150-ft
  capture bands. Show commands for up to 12 seconds and remember dismissal per target and leg
  while navigating between Map and Fly. No aircraft controls or plan values are changed.
- Preserve two-minute radio suggestions, one-time circuit report reminders and recorded-event
  timestamps. Guidance requires a started flight; emergency navigation keeps its dedicated UI.
- Add calculation coverage for wind, magnetic north, turn direction, altitude capture and invalid
  fixes, plus a phone regression for stacked categories, independent dismissal and leg sequencing.

## Layers summary tabs (2026-10-18)

- Remove the Route tab and waypoint list from the Map/Fly Layers summary, as clarified by the owner
  after adding FPL. Default to Radio and retain the Airspace summary and route visibility checkbox.
- Keep unresolved-route validation messages above the remaining tabs rather than dropping them
  with the removed waypoint-list panel.
- Verify the remaining tabs, default selection and independent route visibility control in the
  desktop Map and phone Fly views; run the existing map appearance scenarios.

## FR172H Engine Fire source checklists (2026-10-18)

- Import the two owner-supplied Engine Fire excerpts with all 14 actions, introductions, source speed
  units, the ground note after step 5, post-fire inspection and the in-flight prohibition on restart.
- Engine Fire opens the ground-start source for Taxi-in/out and the in-flight source for Take-off,
  Climb, Cruise, Descent and Landing. Keep source applicability visibly unverified and do not publish
  an operating speed or trigger an emergency navigation route.
- Preserve per-variant progress across phase selection, closing and reload. Add optional introduction
  and per-action notes without invalidating older aircraft definitions or saved sessions.
- Record original screenshots and update [EMER documentation](EMERGENCY.md). Check all seven phase
  mappings, source completeness, reference gating and independent progress in unit/browser tests.

## FPL flight rail tile (2026-10-18)

- Add FPL directly below EMER in every flight phase, using the existing square rail styling and
  toggleable popover. Show the active flight route in order and highlight the next waypoint as GPS
  sequencing advances; this reads live navigation state rather than the preparation draft.
- Add PL/EN labels and extend the existing flight browser scenario for rail order, opening/closing,
  route contents, active-fix updates and availability after changing phase.

## Remove map footer status strip (2026-10-18)

- Remove the bottom route, next-fix/distance and GPS pills from Fly and the corresponding
  route/cursor/GPS readout from Map, as requested. Navigation, GPS recording and Info remain available.
- Remove the unused mousemove state/listener and footer styles. Update the existing Map/Fly browser
  scenarios to require absence of these readouts while still checking route editing and GPS sequencing.

## Dark Matter basemap (2026-10-18)

- Add **Dark Matter** to Map/Fly Layers → Base map, persisted alongside the existing styles.
- Adapt the official OpenMapTiles style to the shared deck.gl vector renderer and public OpenFreeMap
  tiles, without a MapTiler key. Preserve main colours, layer order, zoom/filter and width/opacity stops.
  Support terrain draping in 3D, the existing offline tile cache and local MVT decoding.
- Ship source style, licence and map attribution. Renderer limits are documented in
  [Dark Matter](../maps/dark-matter/README.md): system font and no line-following labels/sprites/patterns.
- Verify source TileJSON and a real Polish vector tile; add rule tests and a browser test for selection,
  persistence, vector rendering and 3D compatibility.

## Terrain 3D and terrain/wind glide footprint (2026-10-18)

- Add deck.gl TerrainLayer with real public Mapzen/AWS Terrarium elevation, local image/mesh parsers,
  3D camera, terrain-fitted chart overlays and ground-aware point interaction. Keep 2D selectable.
- Replace the emergency circle with independent terrain/wind-aware turning reach, preserving blocked
  ridges, peak holes and missing-data barriers. Use full wind triangle, measured descent, explicit
  terrain clearance and heading/turn costs. Check full approaches before outlining an airport green.
- Add optional GNSS/EGM96 AMSL correction and quality-gated descent trend; retain manual instrument
  input priority. Require a valid live or explicitly supplied wind (including confirmed calm).
  Remove guidance when inputs expire; never manufacture missing DEM or aircraft polar performance.
- Add route DEM preparation, bounded IndexedDB/raw tile caches, offline local workers and shipped
  source/data licence attribution. Avoid JSON-persisting decoded Float32 terrain arrays.
- Research XCSoar fan reach and reuse only its attributed EGM96 dataset; no GPL executable code or
  glider performance polars copied. Differences/limits: [Terrain and glide reach](TERRAIN_GLIDE_REACH.md).
- Validation (including Dark Matter): format, ESLint, typecheck, 403 unit tests and production static
  build passed. All 81 browser scenarios verified: 79 passed in the full run; the EMER scenario passed
  after increasing its total timeout, and Dark Matter passed after correcting its terrain DOM selector.
  Visual checks confirmed 2D/3D layers. GitHub CI runs the complete suite again before merge.

## EMER / Engine Out (2026-10-18)

- Add Engine Out / Engine Fire shortcuts, aircraft procedure categories, manual phase selection,
  explicit runway-ahead confirmation and one shared, offline, revision-scoped emergency session
  in Fly and after normal Checklists. Closing preserves progress; ending requires confirmation.
- Import all 22 Reims Rocket Engine Failure reference actions and warnings/notes for owner-assigned
  FR172H, including the unsuccessful-restart branch. Preserve original source language and keep
  reference material separate from verified operational guidance. Engine Fire and other missing
  procedures show explicit unavailable states. Full applicable AFM/POH review remains outstanding.
- Airborne Engine Out creates a separate threshold-based approach overlay with a full 0.5 NM final,
  tangent rate-one joining, a stable target and explicit alternate/recalculation controls.
  Preserve the original FPL; retain phase restrictions as an unvalidated preview.
- Add current-trend range and green estimated-reachable airport outlines using complete approach
  length and each threshold's elevation. No wind correction. Browser altitude is not silently
  treated as AMSL: current instrument altitude/descent can be entered explicitly and expire after
  20 seconds. Missing verified best-glide speed remains unavailable.
- Keep routine report popups out of an active emergency session; keep map/target status visible.
  Prevent horizontal clipping of long emergency text; omit twin-only climb data on single engines.
- Validation: format, ESLint, types, build, **387 unit tests**, **75 E2E scenarios** (74-suite plus final 4-case EMER rerun) pass. Four EMER scenarios
  also pass on the final build, including phone bounds, instrument readings and unavailable range after reload.
  Source status, assumptions and release dependencies: [EMERGENCY.md](EMERGENCY.md).

## Live wind estimate and map tile (2026-10-17)

- Import the Future Features/XCSoar wind plan's GPS-only display stage into the T3
  architecture. Add an independent velocity-circle estimator fed by the shared
  GPS stream during confirmed flight, with quality/freshness checks and session
  resets. Planned TAS, derived GPS vectors and replay are not live measurements.
- Add an 80 px lower-left Map/Fly tile: downwind arrow, camera-bearing correction
  and meteorological FROM/kt readout such as `270°/012`. Show placeholders while
  collecting or stale, and no invented direction in calm. PL/EN descriptions.
- Keep airport weather, planning wind and navigation calculations independent.
  See [model, thresholds and imported scope](WIND_ESTIMATION.md).

## Smooth HOLD exit (2026-10-17)

- Exit HOLD retains the current ground track before joining the next remaining
  flight-plan fix with rate-one fly-by arcs. Use a fresh GPS course when available,
  otherwise the holding curve's local tangent at the last recorded position.
  The exit uses the configured holding TAS and supports fixes behind the aircraft.
- Reuse the departure-pattern connector rather than introduce another turn solver.
  Virtual corners stay internal: FPL identifiers and next-fix targets are unchanged.
  Map rendering and guidance use the same curve, including after reload. Removing
  an armed hold still leaves the original route untouched; flight timers are retained.
- Sequence a curved exit at its real end/next-fix tangent rather than prematurely
  crossing the original DCT's abeam plane. Cover both holding directions, all active
  phases, 100/120 kt, live-course priority, persistence and subsequent real-fix indices.

## HOLD capture loop correction (2026-10-17)

- Reproduce the owner's left HOLD at inbound 242°, one-minute outbound and both
  100/120 kt, approaching from the north. An oblique direct entry placed outbound
  inside the normal racetrack width; forcing a same-direction tangent capture
  then added almost 360° at the fix. Widen the initial entry arc to reach the normal
  outbound offset, allowing a rate-one 180° return and a straight inbound capture.
  The wider entry turns more slowly than rate one; it never tightens the radius.
  The established racetrack and parallel-entry direction exception are unchanged.
- Match the existing timer's abeam condition: where the initial turn finishes
  before abeam, the outbound path reaches abeam before the configured timed leg.
- Also clamp floating-point differences at the 0/360° seam to zero; otherwise
  already-aligned tangent headings could generate a separate full circle.
- Regression coverage includes the owner's 242° case, both hold directions,
  rotated headings, short/custom timed legs, smooth joins and the timed distance.

## Parallel HOLD entry direction (2026-10-17)

- Correct the requested parallel-entry rule: both the initial turn onto outbound
  and the reversal after its timer use the opposite direction to the selected hold.
  Inbound capture and every subsequent circuit use the selected holding direction.
  Left holds mirror right holds. Direct/teardrop no longer choose an opposite-direction
  inbound capture merely because its connector is shorter.
- Keep rate-one radius, timed outbound length and tangent continuity. For very short
  custom legs that cannot fit the opposing-circle tangent, complete the opposite
  reversal before a holding-direction capture, without shrinking the turn radius or
  drawing a sharp shortcut. The normal 60/90-second entries use a tangent connector.
- Preview, accepted map paths, GPS guidance and restored holds derive from the same
  geometry, so existing saved configurations receive the correction automatically.
  Regression tests detect signed turn direction for both hold directions and rotated
  inbound courses, check 15/60/90-second legs and preserve subsequent-lap direction.

## Holding at a selected fix (2026-10-16)

- Point/airport details include HOLD: fixed fix, level in ft AMSL, magnetic inbound
  course, right/left turns and outbound minutes. Right turns are the default;
  time defaults to 60 seconds through 14,000 ft and 90 seconds above it. The next
  active fix suggests fresh GPS altitude; further fixes use their planned altitude.
  Explicit time edits survive subsequent level edits.
- Automatic direct/parallel/teardrop selection follows the mirrored 70/110/180-degree
  sectors in [FAA AIM 5-3-8](https://www.faa.gov/air_traffic/publications/atpubs/aim_html/chap5_section_3.html).
  Entry is recalculated from actual GPS arrival track at the fix. The dashed preview
  and accepted magenta paths include sampled rate-one turns and tangent intercepts.
  Map geometry is nominal still-air geometry at the configured TAS; this version
  does not model wind drift or certify protected-airspace containment.
- Accept adds an off-route fix at the existing minimum-added-distance insertion
  position. An armed future hold retains intervening fixes. Active HOLD suspends
  normal route sequencing, flies over the fix and provides guidance along its path.
  Exit HOLD resumes at the following route fix; a hold at the destination resumes
  toward that destination. Direct-to/diversion/end clear the active hold.
- Its separate outbound countdown starts when the aircraft is moving, established
  outbound with a steady GPS track and abeam/past the fix. Angled entries cannot
  start timing during the last degrees of their first turn. Fix passage itself
  never starts the timer. Each
  completed circuit re-arms it. Repeated, reversed and stale GPS timestamps cannot
  restart it; saved runtime preserves the original start timestamp across reloads.
  Existing flight and utility timers remain independent. Configuration is included
  in saved flights and `.nord` files; older files default to no hold. EN/PL included.
- Holding loops have no fixed circuit count, so their duration/fuel is not included
  in the ordinary route trip estimate; destination ETA is hidden while holding.
  FREDA uses the selected hold level. This is new functionality, not a legacy port.

## Draggable airport and waypoint details (2026-10-16)

- Airport and point dialogs now use the existing traffic-dialog drag behavior:
  drag their Details header with a mouse or touch. Movement stays within map bounds;
  body controls and Close retain their normal actions.
- New selections start at their map anchor. Browser coverage moves an airport dialog
  without panning the map, then moves a waypoint dialog and inserts that waypoint.

## Overhead departure after a full circuit (2026-10-16)

- Departure Overhead now flies Crosswind, Downwind, Base and Final before returning
  along the runway axis to its midpoint. The midpoint is a fly-over: the outbound
  turn starts after passing over the runway, using the same rate-one exit guides.
- Left/right selection and adaptive circuit width still apply. Continue climbing
  to the next waypoint restriction or cruise altitude throughout the full circuit;
  returning over the runway does not introduce a descent or circuit altitude cap.
- Saved plans recalculate; older active THR-to-ARP Overhead departures gain the full
  circuit without losing their active outbound target. Intentional Direct-to legs
  that skipped the circuit and manually edited departure prefixes remain unchanged.
  Arrival Overhead still uses the ARP.
- Unit regressions cover both circuit directions, runway overflight before turning,
  climb/restrictions and old-flight migration. Browser coverage selects Overhead,
  checks all circuit legs, reloads and records the rendered route.

## Smooth departure from the selected circuit leg (2026-10-16)

- Leaving a right-hand circuit at Downwind no longer connects the Crosswind corner
  directly to an outbound fix behind it, which could exceed the adjacent rate-one
  tangent budgets and disable both rounded turns.
- Establish the selected leg's direction using derived exit guides, then turn toward
  the first outbound fix. Allocate enough straight distance for both tangent arcs;
  an additional dogleg supports fixes directly behind the leg without a sharp reversal.
  Straight continuations need no extra guide. Turn radius/speed and runway alignment
  are retained, and infeasible wind geometry still produces the existing warning.
- Preview, FPL calculation and active navigation share the same geometry. Derived
  guides are removed with the departure pattern; saved flights refresh them while
  preserving their active target and intentional Direct-to legs.
- Regression tests cover left/right EPKK RW25 exits toward a southern fix, a reverse
  outbound direction and saved-flight upgrade. Browser coverage now uses Right/Downwind.

## Traffic pattern runway centreline (2026-10-16)

- Departure and Final geometry now use the geographic axis between runway thresholds,
  including previously saved patterns. EPKK RW25 metadata says 252 degrees while its
  threshold pair defines approximately 257.68 degrees; mixing them offset the departure line.
- Extend the line from the take-off threshold through the opposite threshold, then 2 NM
  further along the same great circle. Rate-one turns remain beyond the runway.
- Keep the stored heading as a fallback for coincident thresholds. No runway reference
  data, runway selection, pattern dimensions or ARP endpoint behavior changed.
- Regression checks cover EPKK RW25 and RW07, the smoothed departure segment, Final,
  the 2 NM extension and the degenerate-threshold fallback.

## Traffic pattern ARP endpoint (2026-10-16)

- Arrival patterns now continue through the selected landing threshold to the airport ARP.
  The threshold is flown over before the ARP segment, retaining the existing Final approach.
- Removing an arrival pattern preserves the route to ARP. Once the aircraft is targeting the
  pattern, removal creates DCT from current GPS/last recorded position (last route vertex fallback)
  to ARP; remaining en-route waypoints stay intact while still inbound to them.
- The planned ARP endpoint persists after removal, including when arrival procedure text still
  supplies a runway threshold. Changing the destination resets that explicit endpoint choice.
- Reload upgrades older threshold-only pattern endpoints without resetting flight progress;
  a Direct-to ARP that intentionally skipped pattern vertices remains a Direct-to.

## Own-aircraft traffic identification (2026-10-16)

- Map/Fly resolves the flight registration (or the selected airframe profile registration) to a
  Mode S address using the [aircraft database endpoint](https://www.adsbdb.com/). The collector
  has no airframe-registration lookup endpoint; existing live traffic still comes from it.
- Validate the database's echoed registration and six-digit Mode S address; reject mismatches
  and placeholder addresses. Country separators in compact registrations are tried in a bounded
  lookup. Results are cached with the app's normal query/offline cache for up to 24 hours.
- Reuse the owner's previously confirmed SP-TDI / 48e9fa airframe record, which is absent from
  the public database; the same record supplies the existing C172 type correction.
- Own Mode S reports remain visible with a normal traffic icon and cannot trigger CPA alert
  colouring. Other aircraft keep their existing alert thresholds, including the same aircraft type.
- If database lookup fails or has no record, exact normalised traffic registration is used;
  callsign is a fallback only when that traffic report has no registration. A known, different
  Mode S address is never suppressed by a matching registration/callsign. Position proximity
  alone never identifies ownship. Changing the flight registration uses a separate cache entry.
- Tests cover lookup validation and errors, compact/profile/typed registrations, conflicting
  identifiers, alert classification, rendered animation icons and switching registration in the UI.

## Departure circuits (2026-10-16)

- Traffic Pattern at the departure airport offers Leave traffic pattern with the same five
  positions, flown from the selected take-off threshold to the beginning of the chosen leg,
  then onward to the next route fix. Overhead leaves at the airport centre.
- Departure and arrival circuits are stored independently and may coexist. Preview, acceptance,
  removal, active flight state, saved flights and .nord import/export preserve both ends.
- Departure has no circuit-height or Final-distance input: climb begins immediately toward the
  next outbound waypoint altitude restriction (including manual altitude), or cruise altitude.
  The planner retains its climb gradient instead of imposing a circuit-height plateau.
- Automatic departure runway follows the latest explicit Take-off or unambiguous Taxi-out
  runway/holding-point selection. Old saved Take-off/Taxi-out inputs are also recognised.
  A manual runway selected in the circuit panel remains an override.
- Circuit speed remains the aircraft circuit KIAS. Departure turn sizing uses the target climb
  altitude for its IAS/TAS conversion, avoiding sizing all departure turns at the old circuit height.

## Adaptive circuit fly-by turns (2026-10-16)

- Circuit lateral offset starts at 0.75 NM and expands automatically to fit rate-one turns,
  including wind. Adjacent 90-degree arcs may share their tangent to make a smooth 180-degree turn.
- The same rounded geometry drives the dashed preview, accepted route and navigation; no extra
  flight-plan fixes or labels are added. Existing inbound fixes and GPS-free acceptance remain intact.
- P2006T circuit speed is 100 KIAS. Aircraft circuit speed is converted to TAS at circuit altitude
  with available METAR conditions (ISA/calm fallback), independently of en-route cruise speed.
- This replaces the earlier decision to retain a fixed 0.75 NM circuit and warn about cramped
  corners. Genuine unsupported entry/reversal/wind constraints still display their warning.
- Coverage: left/right circuits, four wind directions, touching arcs, aircraft defaults, IAS/TAS,
  navigation sequencing and accepted circuit persistence in the map UI.

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

Owner-requested change: traffic labels now share the point-name zoom threshold (map zoom 8 / legacy 9) in Map and Fly. The previous viewport-width condition (longitude span below 8 degrees) is removed, so screen size cannot change the threshold. Aircraft symbols and their details remain available while zoomed out. Traffic labels remain independent of the Labels checkbox. The label regression test covers just below/at/above the shared threshold.

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

## Map/Fly status readout deduplication (2026-10-15)

- The embedded map no longer renders its own Route/coordinates/GPS row beneath the Fly status row. Fly keeps its route, next-waypoint distance and GPS status.
- The standalone preparation map retains its Route/coordinates/GPS readout.
- Regression coverage checks a single route row before and during a simulated flight, and preserves the standalone map readout.

## Remove waypoint from active flights (2026-10-15)

- Point details now remove a waypoint from both the planning draft and an active flight. Active-only intermediate fixes also expose Remove from route.
- Removal matches identifier and coordinates so unrelated points with the same identifier stay intact. Navigation retains a valid active leg, flight start, timers and track; changes survive reload.
- Regression coverage includes airport-based plans, active/draft synchronization and active-only fixes.

## Airspace colors and PJE symbols (2026-10-15)

- ATZ stays blue, CTR/TMA orange and P/R red, including during AUP/UUP activation. Boundaries, captions and the zone inspector use the same class colors.
- Confirmed inactive ATZ/CTR/TMA has half the usual fill; missing activation data keeps normal fill. Other zone types retain their existing appearance.
- ATZ with PJE in activation remarks displays an offline vector parachute on the map and in its details. The icon remains visible when captions are hidden; existing text zoom thresholds are preserved.

## Traffic pattern planning (2026-10-15)

- Airport details expose Traffic Pattern: automatic runway (ATIS before wind), manual runway override, left/right direction (left default), Overhead/Crosswind/Downwind/Base/Final (Downwind default), and altitude above airfield (published value when available, otherwise 1000 ft).
- Fixed geometry uses 1 km lateral spacing and extensions 2 NM beyond each runway threshold. Overhead crosses the airport then joins the start of Crosswind at the selected pattern altitude. Every join starts at the beginning of its leg. Final offers 8/4/2 NM and a validated custom threshold distance.
- Changes are previewed as a dashed route and committed only on acceptance. Accepted geometry participates in FPL distance, time, altitude and exports, is drawn solid without position labels, and survives reload/offline use. During flight, acceptance creates a direct join from the current GPS position while preserving timers/track.
- Ten-second, dismissible report prompts appear once at mid-downwind, mid-base only for a direct Base join, and the start of Final with Long/Final/Short wording. Reports are remembered across reloads. Short pattern legs sequence with a smaller proximity tolerance than en-route legs.
- Missing threshold coordinates are estimated only when runway length is available and identified in the form. Published pattern altitude is supported as airport metadata; existing records without it use the requested 1000-ft default.

## Traffic pattern lateral spacing (2026-10-15)

- Increase the side offset from 1 km to 0.75 NM from the runway axis. Both left/right patterns keep the 2 NM threshold extensions and existing Final distances.
- Refresh derived pattern vertices when restoring an active flight, keeping route geometry and report locations consistent with the new width without resetting flight progress.

## Fly-by turns and pattern entry (2026-10-15)

- Preserve the last en-route fix before the selected circuit entry, both in preview and after acceptance. If already navigating directly to the airport/pattern, use DCT from the present position to the new entry.
- Default intermediate route and circuit points to speed-dependent rate-one fly-by turns, using shared wind-corrected geometry for map lines, GPS sequencing and navigation readouts. Preserve fixes in the flight plan instead of inserting arc samples.
- Keep the circuit dimensions when turns cannot fit. Show the affected route/pattern and speed; retain waypoint geometry there rather than silently tightening a turn.
- Trigger the Final report at the tangent exit onto Final. Preserve active-flight timers, track and progress when adding the circuit.
- See [fly-by assumptions and equations](FLY_BY_TURNS.md) for the constant-wind, instantaneous-roll model and its limits.

## Traffic pattern without GPS (2026-10-16)

- Allow accepting a traffic pattern during flight when GPS is denied, unavailable or stale; remove the GPS requirement message.
- Keep preview and accepted active routes consistent. Use the last fix or recorded track for DCT; with no position history, preserve the existing inbound route and flight progress.
