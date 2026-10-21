# In-flight wind estimate

Imported intent: workspace `FUTURE_FEATURES.md` and `XCSoar-wind-plan-T3.md`
(13 October 2026). The latter separates GPS-only circling from a later instrument-TAS
mode; the display now supports native GPS circling and a separate P3D instrument-vector mode. The existing
`domain/wind.ts` continues to solve supplied-wind triangles for planning.

## Implemented model

This is an independent mathematical implementation, not a translation or copy of
XCSoar code. Assuming locally constant TAS and wind, east/north ground-velocity
samples satisfy `|Vground - W| = TAS`: they lie on a circle centred at the wind's
physical TO vector. A centred least-squares circle fit solves the two linear
normal equations for that centre. Neither aircraft heading nor planned TAS is
substituted for an instrument measurement. The reported meteorological FROM is
the centre-vector direction reversed by 180 degrees.

The source analysis describes XCSoar's different cosine-fit/history algorithms
and instrument-dependent continuous mode. Those algorithms are not imported into this implementation. The P3D adapter independently
subtracts measured true-airspeed/heading velocity from ground-speed/track velocity. Reference distinction:
[XCSoar manual, Wind estimation](https://download.xcsoar.org/releases/7.42/XCSoar-manual.pdf).

## Data and validity

- One adapter in FlightRuntime consumes native GPS speed and true track before
  the 5-second flight-track recording interval. Only a flight with a running
  air-time timer can estimate wind; a started session alone is insufficient.
- Derived speed/track and GPX replay are explicitly identified and excluded.
  SI units are used by the estimator; the UI converts to whole knots.
- Require a full consistent 360-degree turn, at least 30 samples, gaps no greater
  than 4 seconds, 0.5–12 deg/s track changes and a window no longer than 5 minutes.
  Limit the window's altitude spread to 100 m. Samples are deduplicated by time;
  clock rollback resets the estimate, and interruptions require a new valid fit.
- Reject non-finite, out-of-range or >20-second-old samples, >100 m GPS accuracy,
  ill-conditioned fits, fitted TAS outside 15–310 m/s, wind >=30 m/s, and radial
  RMS residual above max(1 m/s, 2.5% of fitted TAS). These are conservative MVP
  quality gates, not calibrated error bounds or statistical confidence.
- Valid estimates last at most 10 minutes, within 300 m of the measurement
  altitude, while accepted GPS remains fresh (20 seconds). Loss of continuity
  marks the result stale. No working buffers/results are restored as live after
  reload or reused across flight sessions. Results update after each valid circle.

## P3D instrument mode (2026-10-20)

- Previously Connector/DEMO packets were intentionally excluded from native GPS circle fitting;
  no P3D adapter existed, so the tile never obtained a wind estimate from simulator telemetry.
- For current, unpaused real Connector readings, compute `W = Vground - Vair` using actual
  TAS, true heading, GS and true track. Both vectors use true north; do not substitute magnetic
  heading, IAS or planned cruise speed. This is a horizontal wind-triangle estimate, not a direct
  ambient-weather measurement. Direction is meteorological FROM and speed is displayed in knots.
- `onGround` already exists in Connector v1; map it onto the position fix and reject ground/taxi
  samples, since aircraft motion there cannot measure an unconstrained air-mass velocity.
- No circle or app air-time timer is required for P3D: an airborne simulator can supply an estimate
  on Map/Fly even before the app flight is started. Connection selection still controls the source.
- Keep simulator and GPS buffers separate. Source/session changes clear the previous mode;
  pause, stale/disconnected/missing data, DEMO packets and invalid TAS/heading/GS/track cannot stay
  live. Existing freshness, arrow orientation and calm conventions apply. The tile description
  identifies P3D and no longer asks simulator users to perform a full GPS turn.

## Display and scope

Map and Fly share a small lower-left tile above their status strip. `270°/012`
means wind FROM 270 degrees true at 12 kt. The arrow points downwind, corrected
for the map camera bearing. Calm (<1 kt) has no direction arrow and reads
`---°/000`; collecting/stale results read `---°/---`. English/Polish accessible
descriptions identify the estimate, units and missing-data state.

The estimate is local and assumes a sufficiently stable turn/airspeed. No aircraft
manoeuvre is requested by the UI. It does not replace METAR/ATIS, change planning
weather, or automatically alter GS, ETE, route geometry or performance. Additional
instrument adapters, calibrated GA replay validation, manual source locking and
altitude-weighted long-term wind history remain later stages of the source plan.

Unit tests cover known vector winds, both turn directions, 100/120 kt, wraparound,
timing jitter, calm, straight/partial flight, bad quality, source rejection,
interruptions, altitude/time expiry and flight resets. Browser tests feed native
GPS observations and verify the tile, direction convention, expiry, reload,
offline display, confirmed-flight gating and Polish text.
