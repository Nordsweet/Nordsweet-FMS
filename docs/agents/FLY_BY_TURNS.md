# Fly-by route guidance

Intermediate navigation points default to fly-by. Airport endpoints remain endpoints. The map,
dashed pattern preview, GPS leg sequencing, Fly readouts and FREDA guidance share `domain/fly-by.ts`.
Generated arc samples are derived geometry; they never become extra flight-plan fixes.

Rate one is 3 degrees/second: `omega = pi / 60` radians/second. Without wind,
`radiusNm = tasKt / (60 * pi)` and tangent anticipation is `radius * tan(abs(trackChange) / 2)`.
A 90-degree turn at 100 kt has radius 0.530516 NM and takes 30 seconds. Radius is never reduced
to force a turn into short legs. Neighboring turns must fit jointly on their shared leg.

With a constant wind vector, incoming/outgoing headings are corrected for the required ground
tracks. Integrating air velocity plus wind gives the ground trajectory. Resolving its displacement
along both ground tracks determines separate entry and exit tangent distances. Coordinates use
a local azimuthal frame and geodesic conversion, rather than adding nautical miles to degrees.

Planning uses the resolved cruise TAS and available planning wind. During flight, fresh GPS ground
speed/track minus that wind estimates TAS. The matched active planner leg supplies the wind;
otherwise the first planned leg is used. Unknown/variable wind is treated as calm. This is a
constant-wind, instantaneous-roll kinematic model; it does not model aircraft-specific roll/bank
limits or guarantee procedure containment. The displayed route uses the current common speed/wind
assumption; a full per-leg forecast/performance trajectory is separate scope.

When turns do not fit, have a near-180-degree reversal, or cannot maintain the tracks in the supplied
wind, the map retains those waypoint corners and displays an explicit rate-one-unavailable status.
Circuit width starts at 0.75 NM and grows to fit the adjoining Crosswind/Downwind and Base/Final
tangent budgets, including wind. Threshold extensions stay 2 NM. Adjacent arcs may touch at a shared
tangent: two 90-degree arcs then form a continuous 180-degree turn, with no forced straight segment.
Circuit vertices carry their own planned turn performance instead of using cruise/live en-route TAS.
The aircraft profile supplies circuit KIAS (P2006T: 100); missing values default to 100 KIAS.
Low-speed IAS≈EAS is converted to TAS using dry-air density at airport elevation plus pattern AAL,
with METAR temperature/QNH/wind when available and ISA/calm otherwise. This approximation does not
apply instrument/compressibility corrections. Saved patterns retain the accepted performance;
older patterns derive 100 KIAS/ISA performance without a storage migration.
The remaining valid turns keep their computed radii. Navigation sequences feasible fly-by points at tangent entry and
projects onto the same sampled arc for course, cross-track and remaining distances. Final reporting
uses tangent exit onto the Final track, rather than requiring overflight of the virtual corner.

Pattern acceptance preserves en-route fixes and the active leg. Once the active target is the
airport or an existing pattern fix, it instead creates DCT from the current position to the selected
entry. Both dashed preview and acceptance call the same domain helper. GPS availability/freshness
does not block acceptance: use the last available fix or recorded track position for DCT, otherwise
retain the existing inbound leg to the selected entry. Flight timers and track remain intact.

The derivation was supplied in the workspace `FUTURE_FEATURES.md`. Reference definitions:
[FAA standard-rate turns](https://www.faasafety.gov/gslac/alc/libview_search.aspx?id=7097) and
[FAA Order 8260.58D, geometric turn anticipation](https://www.faa.gov/documentLibrary/media/Order/Order_8260.58D.pdf).
