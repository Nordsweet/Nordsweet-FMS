# Pilot logbook

`/logbook` lists the signed-in pilot's Fly sessions, newest first. Starting Fly freezes a new UUID, account username, aircraft, route and default PIC in the debrief. Reusing a plan creates another session. Live timer events and accepted postflight readings update the same entry. Closing a flight does not invent landing/on-block times. Durations and totals require both real event times; totals include ended sessions only. Displayed times are UTC.

The account API currently exposes a username, not a surname. Settings therefore provides **Pilot surname / default PIC**, synchronized with the existing settings collection. Empty surname falls back to username. Each logbook row offers **Edit PIC**; the correction survives subsequent automatic flight updates.

## Persistence and offline use

`nordsweet.logbook.v1` stores per-account summaries and a durable outbox, separate from the disposable flight checkpoint queue. Recording is mounted in AppShell across routes. Pending entries retry every five seconds; account history refreshes every thirty seconds, on reconnection, or with Refresh. A changed entry remains queued if another edit occurs during upload. Local history is immediately available when offline. Signing into another account selects a separate bucket.

Existing browser capability checkpoints are imported in pages without downloading tracks. Known checkpoint usernames must match. Unowned legacy checkpoints are assigned to the first account importing that browser capability. History that was never saved by an earlier release cannot be reconstructed.

## HTTP contract

The existing flight-store service owns a separate SQLite `logbook` table in the persistent flight-data volume. Its image includes `logbook.py`. No Aviation API collection/schema change is required.

All `/flight-sync/logbook` requests use the real account Bearer token. The server verifies it through `AVIATION_API_URL/auth/me` (default `https://aviation.lab.vibecde.com`) and derives the owner from the response. Client-supplied usernames cannot select another owner's records. Responses are `Cache-Control: no-store`.

- `GET /flight-sync/logbook?offset=0`: `{ entries, hasMore }`, 100 entries per page, newest first.
- `POST /flight-sync/logbook/<uuid>`: validated summary, idempotent upsert, returns the saved summary. Session start is immutable. An ended session cannot reopen through a stale active recording. Automatic updates preserve the server's PIC.
- `POST /flight-sync/logbook/<uuid>/pic`: `{ pic }`, nonblank up to 120 characters. Updates only an owned entry's PIC.
- `GET /flight-sync/sessions?offset=0`: existing browser-capability authentication, `{ flights: [{ id, startedAt, snapshot }], hasMore }`, 100 per page. Existing checkpoint/recovery endpoints remain compatible.

The nginx `/flight-sync/` proxy and compose persistent volume already cover these paths. Deploy frontend and flight-store together with the existing develop deployment.

## Verification

Domain/store tests cover immutable summaries, missing and reversed event times, independent session IDs, editable PIC and account isolation. Python tests cover HTTP wiring, verified account identity, isolation, pagination, invalid data, idempotency, closed-session protection and PIC preservation. Playwright exercises real Fly start/end, surname default, offline PIC edits/reload, account history restoration, and phone overflow. Screenshots are written into ignored `nextjs/test-results/`.
