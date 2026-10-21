# Waypoint AIRREP archive

FlightRuntime records valid measured wind when automatic leg sequencing passes a
waypoint (including fly-by sequencing), and on reaching the final airport within
0.3 NM. Manual Skip/Set Next do not record observations. A 3 NM proximity gate
rejects automatic sequencing of remote fixes after an interrupted position stream.
No valid wind means no report: planned/forecast wind and replay/demo positions
are never substituted.

Reports keep the estimator's measurement time, position, altitude and fit residual
separate from waypoint passage time. GPS estimates expire under the existing wind
validity gates. Simulator observations use a separate source and ID namespace.

`nordsweet.airrep.v1` persists the per-account outbox and acknowledged passage IDs.
It retries at startup, login, online/visibility changes and every 30 seconds with
a 15-second request timeout. Logout/account changes cannot send another owner's
queue. The server derives the owner from the bearer session. Stable flight/source/
waypoint/position/occurrence IDs deduplicate retries and concurrent devices; the
first archived observation wins if devices disagree. Registration is not shared.

Collector contract: `POST /community/airrep`, `GET /community/airrep`. The collector
stores immutable reports in Postgres without automatic expiry. Reads default to
real GPS reports from the last 24 hours, with explicit simulator and archive time
filters. The authoritative contract is the collector's `docs/API.md` (API PR #8).

Validation covers immutable queue contents, account isolation, original measurement
position/time, stale/replay/distant fixes, simulator labeling, and browser reload
recovery. Backend tests cover validation, body limits, idempotency and source
isolation with real Postgres in CI.
