# Active leg edits and map controls (2026-10-18)

- Removing the current leg's origin or target starts a DCT at the current aircraft position and
  retains only the remaining targets. Inserting a waypoint into the current leg does the same.
  Later route edits keep the current leg unchanged. The live fix is preferred, then the last
  recorded track point; without either, the existing positionless editing behaviour is preserved.
  Flight start, track, timers, phase and diversion identity are retained. An obsolete hold is
  cleared on reanchoring. Removing the last active target produces no return leg to an old fix.
- Route points have an explicit full circular 12 px DOM hit target matching the drawn symbol, independent
  of transparent icon pixels and the raised label. Geometry redraws no longer replace the DOM
  buttons, so a GPS/speed update cannot detach a point during a tap. Keyboard access is retained.
- When a fix is available and following is off, a horizontally centered Center button appears
  near the bottom of Map/Fly. It restores the existing ownship-follow camera and disappears.
- Confirming automatic Top of Descent sets Descent in the same update. Existing detection remains:
  running Air Time, a recorded Top of Climb, at least 200 ft/min down for 10 seconds and altitude
  more than 700 ft above the ground reference. The event time is the start of the candidate window;
  the phase changes at confirmation.

## Existing On-block conditions (unchanged)

Air Time must have a stop timestamp (automatic or manual), Block Time must still be running, and
GS must stay at or below 2 kt for 5 seconds of observations. Faster samples reset the candidate.
The event is confirmed after 5 seconds and timestamped at the first candidate sample. Neither
parking brake, engine state nor simulator on-ground state is required. Automatic Air Time stop
currently needs altitude within 100 ft above the ground reference and GS at most 30 kt for 10 s;
the reference is the nearest airport elevation. A stop while taxiing after landing can count as
On-block under these existing rules.

Acceptance covers current origin/target removal, current-leg insertion, later edits, last-target
removal, preserved flight state, TOD phase, full waypoint-disk clicks, DCT position and reload,
and pan/recenter visibility and horizontal placement.

Validation: format, lint, types, production build and all 434 unit tests passed. The 88-scenario
browser suite exposed timeouts (serial HOLD reruns passed) and overlap between an oversized hit
target and a nearby waypoint label. Matching the hit disk to the visible circle fixed the overlap;
all seven route editing/map control scenarios passed again against the final build.
