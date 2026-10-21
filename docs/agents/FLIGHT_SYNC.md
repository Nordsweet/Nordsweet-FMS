# Durable flight track and recovery

The static Next export cannot write files on its nginx host. `server/flight_store.py` is a small
same-origin persistence service behind `/flight-sync/`; `deploy/docker-compose.yml` starts it
automatically alongside the app. No Aviation API Collector changes or upstream credentials are needed.
Frontend components use the existing `api.flightSync` boundary, never fetch from UI code.

## Records and durability

- A flight gets a random UUID and a frozen display name at Start flight: uppercase alphanumeric
  registration + **local** `DDMMYYHHmm`, e.g. `SPOKO1910262330`. `startedAt` also records the exact UTC
  instant. Same-minute/same-registration flights have different UUIDs and cannot overwrite one another.
- This start is the app's Start flight action (recording starts before take-off); the existing
  take-off/off-block events remain in the checkpoint timers.
- SQLite stores that name, registration, plan/runtime checkpoint and ordered track points in the
  **`fms-dev_flight-data` named volume** (`/data/flights.sqlite3`). Track and checkpoint commit in one
  transaction; WAL + synchronous FULL; only committed revisions are acknowledged. Do not run
  `docker compose down -v`. Back up with SQLite's backup API or stop the service before copying its
  database (including WAL if doing a live filesystem snapshot). Deployments never delete this volume.
- Existing recording cadence is retained: moved positions at least 5 seconds apart. Each recorded
  update triggers upload; 5-second retries also cover errors, stalled acknowledgements and offline
  recovery. Each batch carries at most 500 new points and a complete current plan/runtime snapshot.
- `nordsweet.flightSync.v1` stores the outbox, acknowledgement and exact in-flight request before
  sending. Failed/lost requests are replayed identically. The next acknowledged revision then uploads
  any newer local tail. Active checkpoints remain local; final checkpoints leave the outbox only after
  their complete track and snapshot are acknowledged. New flights do not discard unfinished uploads.
- `pagehide` and hidden-page events attempt a final keepalive upload (under the browser's 64 KiB
  budget). Ongoing uploads provide crash protection without relying on unload. No browser can upload
  during a power loss or without network; the already acknowledged server prefix stays safe and
  the local tail retries on return.

## Recovery and privacy

- Before flight runtime can change GPS navigation/timers, startup reads the latest unfinished server
  flight and checks the local outbox. A PL/EN dialog asks whether to continue.
- YES re-downloads the server record, restores the plan, route/active leg, holding/patterns, config,
  flight timers/events, debrief/FREDA fuel baseline and track. Unexpired pattern notices may resume; expired notices do not. The downloaded prefix is used for rendering;
  an agreeing unsent local tail is retained. Without server access the local checkpoint can resume
  and uploads retry. Navigation stays on the explicitly opened page; resuming from Home opens Fly.
- No archives the prior flight and queues its unsent tail; the server record stays stored. Explicit
  End flight also archives it, so completed flights are not offered again.
- A random 256-bit browser capability is kept in localStorage and sent only as an Authorization
  Bearer header. The server stores its hash. There is no global public flight list or registration
  lookup; another browser cannot read/write these tracks. Reopening the same browser profile can
  recover even if its flight/outbox was lost, provided this capability remains. Clearing all site
  storage loses access; cross-device/account sync is separate scope. No GPS/Connector token, server
  address or device setting is uploaded with the whitelisted flight snapshot. The service worker and
  TanStack persisted query cache do not cache these private API responses/capabilities.
- Revision/prefix conflicts stop writes with a visible reload notice, rather than silently overwriting
  another tab's newer checkpoint. Invalid input, out-of-range points and sequence gaps are rejected.

## HTTP contract

All data routes require `Authorization: Bearer <64 lowercase hex characters>` and return
`Cache-Control: no-store`. No cross-origin CORS access. The nginx limit is 2 MiB; the service limit
is 2,000,000 bytes, snapshot 1,500,000 bytes, batch 500 points.

- `GET /flight-sync/health`: public health only, `{status:"ok"}` after opening the database.
- `GET /flight-sync/sessions`: newest unfinished record for this capability, or `null`.
- `GET /flight-sync/sessions/{uuid}`: the full record (including archived), or 404.
- `POST /flight-sync/sessions/{uuid}`: `{name,startedAt,registration,revision,offset,points,snapshot,ended}`.
  `revision` starts at 1 and advances by one, `offset` is the acknowledged point count; repeated points
  must match the stored prefix. A repeated exact request is idempotent. Snapshot is
  `{flight,inflight}` (no embedded track); point is `{lat,lon,altitudeFt:number|null,time:ISO UTC}`.
  Response `{revision,trackCount}` acknowledges the durable prefix. Closed records cannot reopen.
- `POST /flight-sync/sessions/{uuid}/close`: archives an already stored record, preserving data.
- Full record: `{id,name,startedAt,registration,revision,ended,updatedAt,snapshot,track}`.
- 401 missing/invalid capability, 404 unknown/not owned, 409 revision/track/closed conflict,
  413 too large, 422 invalid payload/points, 503 unavailable storage. No server retention/deletion job.

## Local development and tests

`python server/flight_store.py` (Python 3.13, no packages required) starts port 8000. Set
`FLIGHT_STORE_URL=http://127.0.0.1:8000` when running `nextjs/scripts/serve-export.mjs` to proxy local
requests. `FLIGHT_DB_PATH` and `PORT` override the service defaults. The deployed nginx proxy is automatic.

`python -m unittest discover -s server -v` covers durable ordering, replay, atomic rejection, private
ownership, archives, validation and HTTP. Vitest covers outbox/recovery and lost acknowledgements;
Playwright covers incremental uploads, offline retry, remote-only track recovery and declining recovery.
Existing flight regressions explicitly choose YES through `e2e/test.ts`; recovery tests choose directly.
