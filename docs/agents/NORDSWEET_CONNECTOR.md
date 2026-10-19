# Nordsweet Connector source

The Fly screen offers Device GPS or Nordsweet Connector before starting a flight and in Options
during a flight. The shared position subscription drives Fly, the map and flight recording. Select
Connector, enter its Tailscale Serve HTTPS URL and token, then Connect. Connecting enables map
position/follow. Disconnect preserves the selected source without falling back to device GPS.

Use Connector v0.1's schemaVersion 1 `/ws?token=...` endpoint. HTTPS pages require HTTPS/WSS.
Tailscale Serve must run on the Prepar3D PC, and Connector must be launched with `--host` matching
its Tailscale DNS name, with the exact Windows URL ACL reserved. The app is static; no server relay,
REST CORS or backend credentials are involved. At the owner’s request (2026-10-19), the address, token and connection preferences are persisted
in localStorage on this browser/device, including after closing and reopening the app. Existing
sessionStorage preferences migrate once; saved flights and exported files never contain them. Never log the WebSocket URL.

Connector frames are validated at the API boundary. Missing/invalid/old frames clear the active fix;
silence marks it stale after 2.5 seconds and closes the socket after 5 seconds. Closure reconnects
after 3 seconds. Changing sources closes the previous socket/watch. One connection serves all hook
consumers. GPX replay is unavailable while Connector is selected.

Simulator altitude is already MSL in feet, and speed is GS in knots. It is not converted as GNSS
ellipsoidal height or passed through EGM96 correction. IAS, TAS, AGL and vertical speed are carried
as separate optional fields. `accuracyM: 0` is a sentinel for exact simulated position, not measured
GNSS accuracy; Connector fixes are explicitly excluded from native-GPS wind estimation and GNSS
emergency trend measurements. The Fly status uses a simulator label rather than claiming GNSS
accuracy. Demo packets retain a distinct source and display a DEMO label.

Paused positions stay visible without extrapolation and do not drive automatic flight observations
or recording. Existing wall-clock/manual timers retain their existing elapsed-time semantics; this
integration does not implement a simulator-time clock.

Acceptance: Vitest transport/schema tests and `e2e/connector.spec.ts` cover connection, telemetry,
DEMO, pause, stale-data clearing, reload, disconnect and returning to Device GPS. The browser test
also checks the controls at 1024×768. End-to-end testing with a real Prepar3D v5 installation and a
tablet in the owner's tailnet remains necessary; mocked browser frames do not validate that network.

Validation: format, lint, typecheck, static export and 406 unit tests passed. All 82 browser cases
passed across the full run and 10 isolated reruns (the initial run had timing failures, including
the corrected one-frame Connector fixture). After merging the latest develop footer removal, all
12 affected Connector/Fly/map appearance/migration cases passed again with one worker. The source
panel was visually checked at desktop and tablet sizes. The removed footer stays removed; during
flight a Connector status button in the phase bar opens Options.
