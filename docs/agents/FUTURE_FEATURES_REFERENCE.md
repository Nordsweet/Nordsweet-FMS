# Imported EMER specification

Source: workspace FUTURE_FEATURES.md, 2026-10-18. Owner assigned reference to FR172H.

## Emergency

- Direct to nearest airfield button: instantly find the nearest suitable airfield/airport and create a `DCT` route to it, with distance, bearing, runway/landing-site notes, and basic suitability checks.
- Automatic glide-reachability highlight: when the app detects a sustained descent greater than 500 ft/min, subtly highlight airfields/landing sites within gliding range using green circles, based on current altitude, position, wind if available, aircraft glide performance, and terrain/obstacle constraints where possible.

### EMER: scope and status

Status: planned product specification, recorded 2026-10-17. No application implementation or operational checklist approval is implied by this document.

Provide a persistent `EMER` entry point in the in-flight view, a compact emergency panel, two priority shortcuts, and aircraft-specific emergency checklists. Add those same checklists to the existing `Checklist` view after all normal checklists. The panel and checklist library must use the same procedure definitions, source revisions, and active-session progress.

The supplied screenshots are reference material for a Reims Rocket Flight Manual, not a universal engine-failure procedure. Verify the exact aircraft model, serial-number applicability, installed equipment, current manual revision, and relevant supplements before enabling operational use. Do not automatically bind this material to FR172H merely because that aircraft appears elsewhere in this backlog.

### EMER panel and quick actions

- Keep `EMER` reachable from the in-flight map and checklist view. Opening it must not require scrolling through normal checklists, completing the FREDA questionnaire, network access, or an account/login flow.
- Place `Engine Out` and `Engine Fire` prominently at the top. Each opens the relevant aircraft-specific emergency flow directly, with the selected aircraft and phase visible. Use large, stable touch targets, distinct text labels, and restrained emergency highlighting; do not rely on color alone or flashing decoration.
- `Engine Out` is the shortcut label for the `Engine Failure` procedure family. `Engine Fire` is a separate procedure family, not an alias for engine failure, restart, or shutdown.
- Below the shortcuts, provide the category buttons `Engine`, `Electric`, `Hydraulic`, `Pax`, and `Fuel`. Add `Pneumatic Pressure` only when configured for the selected aircraft.
- Keep the category layout predictable. Distinguish `Not installed`, `Procedure not available`, and available procedures; do not invent hydraulic or pneumatic equipment for aircraft that do not have it. Categories without verified content must not open generic operating instructions.
- Categories select relevant aircraft-specific procedures. They are navigation structure, not permission to generate emergency actions from a generic template or AI at runtime.
- Keep the map and current aircraft position accessible while reading a checklist. Opening a category, returning to the map, or temporarily minimizing EMER must preserve progress.
- Closing the panel must not silently mark an emergency resolved, erase checks, or restore an earlier route. Provide an explicit end/reset action with confirmation when it would discard an active session.
- EMER is an advisory/checklist interface. It must not actuate aircraft controls, change radio/transponder settings, send distress messages, or declare an emergency to ATC automatically.

### Engine Failure: phase-dependent selection

Use the selected aircraft's verified procedure set and current flight context to suggest the appropriate variant:

| Context | Procedure to suggest | Selection safeguards |
| --- | --- | --- |
| Take-off with sufficient runway ahead | `Engine Failure - During Take-Off (Sufficient Runway Ahead)` | Runway sufficiency is a condition to be assessed/confirmed by the pilot, not inferred from GPS position or runway length alone. |
| After take-off | `Engine Failure - After Take-Off` | Use the aircraft-specific phase definition; do not reuse arbitrary 300/500 ft checklist-trigger thresholds as emergency decision limits. |
| During flight | `Engine Failure - During Flight` | Include the complete restart sequence and the linked unsuccessful-restart branch from the supplied material. |
| Phase unknown, conflicting, or based on stale data | Clearly visible manual phase selection | Do not silently default to an airborne restart or a runway-available procedure. Keep the available verified variants immediately accessible. |

- An existing reliable phase may preselect and immediately display its procedure, with an obvious manual correction control. Do not put a mandatory questionnaire or confirmation modal in front of the first verified checklist items.
- Use phase, air/ground state, take-off context, data timestamps, and provenance where available. A single GPS ground-speed, vertical-speed, or altitude threshold must not determine the emergency variant. Barometric altitude, GPS altitude, and AGL are not interchangeable.
- The pilot must be able to override the suggestion immediately. Snapshot the selected phase when the emergency flow opens; subsequent descent, sensor noise, or proximity to the runway must not silently replace the active checklist or its switch settings.
- A deliberate phase/procedure change opens the new variant's own state. Do not transfer checked items by list index or assume identically named controls have the same required setting.
- A descent greater than 500 ft/min may trigger the separately planned reachability display; it is not evidence of engine failure and must not automatically activate EMER or an engine-failure checklist.
- A reported engine problem in FREDA may link to `Engine`, but it does not by itself establish complete engine failure or fire. Quick emergency shortcuts remain independent of that diagnostic flow.
- These reference screenshots describe a single procedure set. Do not reuse it for a twin or another aircraft; multi-engine support requires its own verified procedures and affected-engine context.

### Airborne Engine Out: automatic route and reachability

This is the requested initial map-assistance model, not a validated glide envelope or a new aircraft operating procedure. It explicitly ignores wind, weather-based runway preference, and other optimization scoring. Measured GS may already reflect current wind along the present track, but the model does not infer a wind field or directional glide capability from it.

#### Trigger and emergency route

1. When the pilot clicks `Engine Out` and the aircraft is reliably airborne, immediately open the phase-appropriate checklist and start the route/reachability calculations. Do not wait for the passive 500 ft/min descent trigger or require a second `DCT` click. Opening the general EMER panel, selecting Engine Fire, or detecting descent alone does not trigger this routing behavior.
2. Find the nearest available airport with usable runway-threshold geometry. For this specification, nearest means minimum distance from the aircraft to an available landing threshold, not distance to the airport ARP. At that airport, choose the available runway direction with the shortest feasible approach path through its 0.5 NM final point; use a deterministic tie-breaker. Ignore headwind/crosswind and wind-favored runway selection. Do not treat known-closed runways, invalid coordinates, or unavailable approach geometry as usable; mark unknown suitability separately.
3. Use the actual landing threshold, including a known displaced threshold, and the runway's true inbound direction. Place the final-entry point `F` on the extended centerline, 0.5 NM before threshold `T`. Do not infer a precise true bearing by multiplying the runway number by ten.
4. Generate the emergency DCT-style route toward `F`, followed by the straight final segment `F -> T`. Where the aircraft turn model is available, join the final tangentially and complete the turn no later than `F`; a generic fly-by that finishes after `F` would shorten the requested 0.5 NM final and is not equivalent. Show infeasible geometry instead of forcing a sharp corner or excessive turn.
5. Save the existing flight plan and expose this as a distinct emergency route with the selected airport, runway direction, threshold, and final-entry point visible. The Engine Out click explicitly requests this automatic plan; it does not actuate aircraft controls or confirm a safe landing. Keep the chosen target stable as live data updates, with an explicit option to choose another runway/airport or recalculate the target.
6. If no usable runway/geometry is available, keep the checklist and map usable, show the missing-data reason, and do not substitute the airport center as if it were a verified runway approach. If already established on the selected final inside the 0.5 NM point, retain the remaining final rather than commanding a backtrack to `F`.

Geometric definition of the final-entry point:

```text
F = geodesic_destination(T, normalize(runway_inbound_true_deg + 180), 0.5 NM)
distance(F, T) = 0.5 NM
```

This fixed final length is a requested application-planning parameter, not a manufacturer-published emergency approach procedure, a vertical glidepath, or an assurance of runway clearance. Preserve the active aircraft procedure's restrictions. In particular, an after-take-off turn-back conflict must leave a geometric diversion candidate as an explicitly unvalidated preview, not activate contradictory return/turn commands or replace the source warning with a recommendation to turn back.

#### Best-glide-speed pop-up

- On activation, display `Set Speed to YYY kt`, where `YYY` comes from the selected aircraft's verified best-glide data applicable to its phase/configuration and published weight dependency, if any. Use the source-approved airspeed basis; never substitute GS or invent a default speed from the airport distance.
- Keep the message prominent but non-blocking so it does not hide the first emergency checklist actions. Include the aircraft/procedure context and retain the target speed visibly after dismissal. Do not reopen the same pop-up on every position update.
- If the source has a different verified speed for the active after-take-off procedure, preserve that distinction instead of blindly using an en-route value. Do not promote the unverified screenshot reference speeds into operational profile data.
- If no applicable verified value is available, show `Best glide speed unavailable - consult aircraft AFM/POH` rather than displaying `YYY`, zero, or an unrelated aircraft's speed. Switching to Engine Fire or another procedure removes obsolete Engine Out speed prompts.

#### Live reachability circle

Draw a circle centered on the aircraft using its current valid descent rate and GS. Use a short, documented smoothing window to limit jitter while retaining data age; update the circle as new reliable measurements arrive. The best-glide pop-up does not imply that the pilot has reached that speed or that the present sink rate is the aircraft's best-glide performance.

For a specified reference elevation:

```text
H_ft = max(0, aircraft_altitude_AMSL_ft - reference_elevation_AMSL_ft)
D_fpm = -vertical_speed_fpm                 # valid descending sample only
time_remaining_min = H_ft / D_fpm           # D_fpm > 0
radius_NM = (GS_kt / 60) * time_remaining_min
          = GS_kt * H_ft / (60 * D_fpm)
```

- The single displayed circle uses the selected landing threshold's elevation as its reference, labeled alongside the estimate. If there is no selected threshold, a valid current terrain elevation may supply an explicitly labeled local-ground reference. Do not silently assume sea level or mix GPS ellipsoid height, pressure altitude, and AMSL elevation.
- Missing/stale altitude, height reference, GS, or descent data must produce `Range unavailable` or a visibly stale estimate, not a guessed green circle. Non-descending or near-zero descent must not create an infinite/huge range; mark the estimate unavailable until a usable descending sample exists. Zero GS is distinct from missing GS.
- Treat the circle as a current-trend projection to the stated reference level. It ignores directional wind, terrain/obstacle clearance along the path, changing configuration, maneuver-related sink changes, and landing margins. Do not label it a guaranteed glide envelope or a certified safe area.
- Do not quietly replace this model with the earlier wind/performance-based overlay. Any future higher-fidelity model must have its own explicit mode and assumptions.

#### Green airport outlines

- Evaluate nearby airports continuously. Give an airport a subtle green outline if at least one available runway direction is estimated reachable in this simplified model, including the approach to `F`, the complete 0.5 NM final, and any modeled joining-arc distance. Do not use ARP distance or direct threshold distance alone as proof that the planned approach fits.
- Calculate height/time/range for each candidate using that runway threshold's own elevation. An airport-level estimate cannot reuse the selected runway's elevation for every other airport. A circle referenced to one elevation is not the decision boundary for airports at different elevations.
- Let `L_route_NM` be the candidate's complete modeled path length and `R_candidate_NM` its current-GS/descent range to threshold elevation. The baseline eligibility test is `H_candidate_ft > 0` and `L_route_NM <= R_candidate_NM`, with valid, fresh inputs and available geometry. Do not add a hidden safety buffer or wind correction to this initial model; clearly disclose that no landing margin is established.
- The automatically selected nearest airport may still be outside estimated range. Keep that distinction visible and allow selection of a green alternative; do not mark the nearest target green merely because it was selected or silently move the target when the circle shrinks.
- If no airport is estimated reachable, show that result without stopping the checklist or hiding other landing-site information. Unknown data stays neutral/unknown rather than green; refresh/remove green outlines when the input becomes stale or invalid.
- Label green as estimated reachable under the current model, not confirmed suitable or safe. Known closures and data gaps remain visible even though wind is deliberately excluded from ranking.

Model context: [FAA, Best Glide Speed and Distance](https://www.faa.gov/sites/faa.gov/files/2022-01/Best%20Glide%20Speed%20and%20Distance.pdf) discusses aircraft-specific glide speed and configuration. It is not a validation source for the requested 0.5 NM approach, automatic target selection, or the simplified current-GS/descent circle defined here.

### Reference Engine Failure checklists

Publication status: `REFERENCE ONLY - APPLICABILITY NOT VERIFIED`. The text below is a transcription of the user-supplied images with punctuation/line wrapping normalized. It is documentation input, not a release-ready or independently verified operating checklist. Preserve its sequence, conditional wording, notes, and warnings when preparing a verified aircraft profile.

Source images supplied on 2026-10-17:

- `C:/Users/mrnie/AppData/Local/Temp/codex-clipboard-e0fd4c32-7aa0-4c61-9aa7-2899d24fc637.png`: `EMERGENCY PROCEDURES / ENGINE FAILURE`, covering take-off, after take-off, and in-flight steps 1-4. Page number and edition are not visible in this image.
- `C:/Users/mrnie/AppData/Local/Temp/codex-clipboard-274ea3e1-7876-4d0a-928c-bfe3d0b421f5.png`: `Flight Manual / Reims Rocket / Reims Aviation`, page `3-2`, edition `2`; continuation with in-flight steps 5-7, securing the engine, and a landing note.

Before implementation, retain the source material in managed aircraft documentation storage, not temporary clipboard paths. A visible edition/page on one screenshot does not establish that the excerpts are complete, current, or applicable to a particular registration.

#### During Take-Off (With Sufficient Runway Ahead)

Proposed stable procedure key: `engine-failure-takeoff-runway-ahead`.

1. Throttle -- Idle.
2. Apply brakes.
3. Flaps -- Retract (if extended) during ground roll to provide more effective braking.
4. Mixture -- Idle cut-off.
5. Ignition and Master Switch -- OFF.

#### After Take-Off

Proposed stable procedure key: `engine-failure-after-takeoff`.

1. Glide Speed -- 129 km/h - 70 kts - 80 MPH.
2. Mixture -- Idle cut-off.
3. Fuel Shutoff Valve Knob -- Pulled full out.
4. Ignition Switch -- OFF.
5. Master Switch is to be left ON so that flaps may be extended.

Source warning, to remain attached to this variant:

> IMPORTANT: Perform the landing straight ahead, making only small changes in heading to avoid obstructions. Never attempt to turn back to the landing strip because your altitude after take-off is not usually sufficient to safely turn back to the airport.

This warning is transcribed from the supplied manual excerpt. Preserve its applicability; do not transform it into a generic turn-back calculation, a return-to-airport prompt, or a rule for unrelated aircraft/procedures.

#### During Flight

Proposed stable procedure key: `engine-failure-in-flight`.

1. Glide Speed -- 137 km/h - 74 kts - 85 MPH (optimum glide angle with propeller windmilling).
2. Fuel Shutoff Valve Knob -- Pushed full in.
3. Fuel Selector Valve Handle -- BOTH.
4. Mixture -- Rich.
5. Auxiliary Fuel Pump Switch -- On HIGH for 3-5 seconds with throttle 1/2 open, then switch to OFF position.
6. Throttle -- Opened one inch (2.5 cm).
7. Ignition Switch -- BOTH.

Source continuation, to remain visible with this procedure:

> If the propeller is allowed to stop windmilling, the engine will have to be turned with the starter. If the engine will not start, select an unobstructed area to land in and secure the engine as follows:

Do not silently turn the conditional starter note into an unconditional extra restart step, an automatic command, or an unlimited restart loop. The screenshots do not establish a full starter-duty-cycle procedure. Completing the seven displayed items does not prove that the engine has restarted; the outcome is recorded explicitly by the pilot.

#### Engine Will Not Start: Secure the Engine

Proposed stable procedure key: `engine-failure-in-flight-secure`, linked as the unsuccessful-restart branch of `engine-failure-in-flight`.

1. Throttle -- Closed.
2. Mixture -- Idle cut-off (pulled full-out).
3. Fuel Shutoff Knob -- Pulled full out.
4. Ignition Switch -- OFF.
5. Leave master switch ON so that flaps can be extended.

Source note, to remain attached to this branch:

> NOTE: Full flaps are recommended for emergency landings on unpaved surfaces.

Show this as a source-specific note, not as an additional unconditional checklist item or a recommendation for every aircraft, landing site, or phase.

#### Transcription and presentation safeguards

- Do not merge the 70 kt after-take-off speed with the 74 kt in-flight speed. Preserve the original unit sets and the windmilling qualification. The screenshots do not explicitly label the airspeed basis as IAS/CAS/TAS; verify it in the applicable manual before populating performance or sensor-comparison fields. GPS ground speed must not be substituted.
- Preserve `Master OFF` in the runway-ahead variant and `Master ON` in the after-take-off / unsuccessful-restart variants. Do not derive Engine Fire switch settings from any of these sequences.
- Preserve the difference between fuel shutoff `Pushed full in` during restart and `Pulled full out` in the other referenced variants. Keep fuel shutoff and fuel selector as distinct controls.
- Keep the pump's HIGH/3-5 seconds/throttle-1/2-open/OFF instruction together, before the separate one-inch throttle step. An optional manually started timer may assist with the stated interval; elapsed time must not mark a physical action complete or claim the pump is OFF.
- Do not classify bold text or any item as an approved memory item solely from screenshot typography. Preserve confirmed memory-item designations only when the applicable source identifies them.
- Do not insert generic MAYDAY, squawk, restart, fire, evacuation, or flap actions into the transcribed sequence. Any additional communication or support tool must remain separate and must not change source procedure order.

### Engine Fire and remaining categories

- Provide the `Engine Fire` shortcut and its procedure family in the specification, but obtain the correct aircraft's Engine Fire source checklists before operational activation. The supplied images contain no Engine Fire procedure.
- Where the applicable manual distinguishes phases such as starting, ground operation, take-off, or flight, represent those as verified variants; do not assume that the engine-failure phase split or actions apply unchanged.
- If a pilot selects Engine Fire without verified content, show `Verified Engine Fire procedure unavailable for this aircraft` and access to any already stored applicable manual. Never substitute an Engine Failure checklist or attempt to generate fire actions.
- `Electric`, `Hydraulic`, `Pax`, `Fuel`, and optional `Pneumatic Pressure` need their own aircraft/equipment-specific source content. Record missing content explicitly; no operating steps for these categories have been supplied in this request.
- If the pilot deliberately switches from a failure/restart flow to fire, stop displaying obsolete restart prompts and keep a separate session/history. Do not automatically return to restart instructions when the fire checklist is closed or completed.

### Checklist view integration and session state

- Order the library as `Normal Checklists`, followed by a clearly separated `Emergency Checklists` section. Emergency procedures must also remain directly accessible through EMER regardless of their position in the library.
- Under `Emergency Checklists > Engine`, include the three Engine Failure variants, the linked securing branch, and Engine Fire variants when source content is available. Provide the remaining requested categories without presenting missing procedures as completed content.
- Use one canonical definition per aircraft/procedure/revision. EMER and `Checklist` open that same definition and active session; do not maintain separately edited copies of the text or separate checked-state arrays for the two views.
- Expose all verified phase variants for manual browsing, even when one is suggested automatically. Draft/reference-only entries may be reviewed in an explicitly labeled reference/configuration view, but cannot masquerade as verified in-flight guidance.
- Each checklist item supports manual checked/unchecked state. Warnings, notes, applicability conditions, and branch decisions are distinct item types, not ordinary checkboxes that disappear once checked.
- Keep source ordering stable and all critical information visible without a mandatory Next wizard. Progress indicators are pilot records, not sensor-confirmed completion or proof that the aircraft is safe.
- Preserve progress locally across view changes and app reloads, scoped to flight, aircraft profile, procedure key/revision, and emergency session. On resume, show that the session is being resumed; do not load yesterday's completion state into a new flight.
- Checklist completion does not clear the emergency, confirm restart, change the active route, or imply ATC notification. Record a pilot-selected outcome separately. Ending/resetting a session is explicit.
- A change of aircraft or procedure revision must not reuse prior checked-state positions. Preserve any old session as history and require a deliberate choice of the newly applicable procedure.

### Offline availability, data model, and source control

- Make the verified procedure text, warnings, applicability metadata, and currently selected aircraft's emergency library available offline before flight. A missing map tile, failed traffic feed, or server timeout must not prevent reading a cached checklist.
- Store aircraft profile/model/serial applicability, installed systems, procedure family/key, phase conditions, revision, source title/edition/pages, verification status, reviewer/date, ordered item IDs, original control/action text, warnings/notes, reference speeds with units/basis/configuration, and branch links.
- Use explicit statuses such as `reference`, `pending-review`, `verified`, and `superseded`. Verification is a documented content review against the applicable manual, not a claim of regulatory approval or certification of the application.
- Store a session's event type, selected phase, phase source/confidence/timestamp, manual override, procedure revision, per-item records, branch/outcome, and lifecycle state. A client must be able to render the source text without a live telemetry connection.
- For airborne Engine Out map assistance, also store the preserved original route, emergency-route state, selected airport/runway direction/threshold, final-entry geometry, simplified model identifier, altitude reference, input units/timestamps, latest range estimate, and per-candidate validity. A reload must not silently select a different target or reactivate stale navigation commands.
- Do not replace a procedure revision or its actions mid-emergency through background sync. Updates apply to a new deliberate session; retain the active revision and its source provenance.
- Maintain the source-language text as the reference. Any later translation requires review; automated translation must not change control labels, ON/OFF states, speeds, conditions, units, or ordering.
- General background: [FAA Airplane Flying Handbook](https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/airplane_handbook), including its Emergency Procedures chapter, and [FAA AC 61-89E, Appendix 1](https://www.faa.gov/documentLibrary/media/Advisory_Circular/Ac61-89e.pdf), which references aircraft-appropriate emergency checklists. These are not verification sources for the supplied Reims Rocket actions or speeds.

### Relationship to emergency map tools

- Keep `Direct to nearest airfield` and glide-reachability tools available alongside the checklist. The airborne `Engine Out` shortcut automatically generates the emergency route specified above; it supersedes the earlier requirement for a separate manual DCT selection in that specific flow. Merely opening EMER or checking an item must not replace the flight plan. Preserve the original plan and apply the stated phase/procedure safeguards before activating navigation commands.
- Distinguish nearest by distance from reachable and suitable. Display the assumptions and data quality behind reachability; do not claim a guaranteed landing or conceal an unknown landing-site/terrain state behind a green symbol.
- Reference speeds in a checklist are not a complete glide-performance model. In the requested initial airborne Engine Out mode, obtain the speed prompt from the verified aircraft profile but calculate range from current GS/descent and a valid height reference, without wind adjustment. Keep the separately planned wind/performance-based reachability overlay distinguishable; do not mix its results with this simplified circle or manufacture missing inputs.
- Do not let an automatically suggested return/DCT contradict the active after-take-off procedure. Do not generate a turn-back recommendation from proximity to the departure runway alone.
- EMER activation should prioritize the emergency procedure over ordinary route-turn pop-ups. Preserve background position tracking and allow the pilot to deliberately choose navigation support; discard stale routine maneuver prompts rather than resuming them blindly.

### Acceptance criteria and tests

1. Both priority shortcuts and all five requested categories are reachable; `Pneumatic Pressure` follows aircraft configuration. Unsupported systems and missing checklist content are differentiated.
2. Test the three phase variants, immediate manual override, unknown/stale phase data, unconfirmed runway sufficiency, and descent without engine failure. No arbitrary common AGL/GS threshold selects an unsafe procedure.
3. Compare transcription to both images: five runway-ahead items, five after-take-off items, all seven in-flight items across the page boundary, and five securing items. Preserve every attached warning, conditional note, speed, and ON/OFF distinction.
4. Verify the unsuccessful-restart branch and explicit outcome handling. Timers and checked boxes must never assert that a switch moved, the engine restarted, or the emergency ended.
5. Engine Fire without verified content never opens Engine Failure as fallback. Switching deliberately to fire removes obsolete restart prompts. No other category invents operational steps.
6. Verify identical definitions and active-session progress in EMER and `Checklist`; normal checklists remain first in the library. Aircraft, flight, phase, or revision changes cannot leak incompatible completion state.
7. Test offline start, server failure, unavailable source manual, navigation between views, reload/resume, explicit reset, and a new flight. Do not require network access for previously cached verified content.
8. Test that airborne Engine Out starts the specified automatic emergency route, while generic EMER access, checklist ticks, Engine Fire, ground operation, and descent alone do not. Unknown airborne state must not silently start a diversion. Prevent guaranteed-reachability claims, inferred engine diagnosis, and routine route commands overriding emergency content; preserve after-take-off procedure restrictions.
9. Check desktop/mobile readability, stable touch targets, daylight/dark contrast, warnings that remain visible, and lack of overlap with the aircraft/map. Do not make first checklist access depend on an animation, hover, or audio.
10. Release gate: verify applicability and the full relevant AFM/POH sections, resolve missing source content, review the phase policy, and validate the resulting flows with a suitably qualified aviation reviewer before presenting operationally usable procedures. Until then, the transcribed material remains reference-only.
11. Route tests: nearest threshold versus nearest ARP, choice between runway directions without wind scoring, true versus magnetic bearing, displaced threshold, the exact 0.5 NM final, tangent joining without shortening final, already established short final, invalid/closed runways, and no available geometry. Original plan preservation and stable target selection must survive reloads.
12. Range tests: `H = 2000 ft`, `D = 500 ft/min`, `GS = 90 kt` gives `4 min` and `6 NM`. Test zero/positive/near-zero vertical speed, missing versus zero GS, negative usable height, stale data, altitude-datum mismatch, changing descent/GS, and candidates at different threshold elevations. The speed pop-up must not replace measured GS in this formula.
13. Highlight tests: an ARP inside the circle with a complete runway-approach path outside range must not become green; any valid reachable runway direction may make the airport green. Cover a selected nearest airport outside range, a reachable alternative, no reachable airport, missing runway elevation, and stale-data removal of green outlines. Verify that no wind correction enters the baseline calculations.

