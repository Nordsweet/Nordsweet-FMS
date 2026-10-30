# User data on the backend

What a pilot creates (saved flights, custom aircraft, engine hours and fuel per airframe, finished
flights, settings, favorites) is stored on the Aviation API, so it follows them from one device to
another. The contract is the **"User data"** section of the API's `docs/API.md` (repo
`~/Developer/aviation-api-collector`); this app consumes it and never changes the backend itself:
a missing field becomes a backend request (below). Code: `nextjs/src/api/userdata/`.

The browser keeps its copy (IndexedDB / localStorage) and renders from it, so the app works offline.
The server is the system of record: where the two differ after a pull, the server wins, except for a
local change that has not been sent yet.

## What goes where

| Data                                             | Server route                      | Local working copy                                | Code                              |
| ------------------------------------------------ | --------------------------------- | ------------------------------------------------- | --------------------------------- |
| Saved flights                                    | `/flights`                        | IndexedDB `nordsweet-flights` (`api/flights.ts`)  | `documents.ts`, `adapters.ts`     |
| Custom aircraft (one row per draft)              | `/aircraft/custom`                | `nordsweet.customAircraft.v1` (`api/aircraft.ts`) | `documents.ts`, `adapters.ts`     |
| Settings                                         | `/me/settings`                    | `stores/settings.ts`                              | `preferences.ts`                  |
| Favorites                                        | `/me/favorites`                   | `stores/inspiration.ts`                           | `preferences.ts`                  |
| Engine hours and fuel per airframe, fuel mode    | `/airframes`, `…/readings`        | `stores/aircraft-state.ts`                        | `airframes.ts`                    |
| Finished flights (debrief, track, emergencies)   | `/flight-logs`                    | — (read from the server: **History** page)        | `flight-logs.ts`                  |
| First sign-in upload                             | `/import`                         | —                                                 | `import.ts`                       |
| "Delete my server data" (Settings)               | `DELETE /me/data`                 | —                                                 | `features/sync/server-data.tsx`   |

Not on these routes, kept where they were: the flight in progress and the editing draft (`/sync`
collections `live-flight` and `draft`, see SESSION_SYNC.md), the pilot surname (still the `/sync`
`settings` item, see "Backend requests"), voice URIs, ATIS pad, notification history, map
preferences, position source URL and token, terrain tiles and the query cache.

## How it works

- `api/userdata/index.ts` `startUserData(username)` runs inside the tab that holds the sync lock
  (`api/sync/index.ts`). Order: import once, then one sync per source. The bearer token and the 401
  handling are `aviationFetch`'s; nothing here reads the token.
- **Import** (`import.ts`): once per user and device (`nordsweet.userDataImported.<user>.v1`, set only
  after every batch was answered), batches within the documented limits. Flights go as
  `{id: flight.id, document}`; drafts get a `crypto.randomUUID()` stored beside the draft
  (`AircraftDraft.id`, minted in `api/aircraft.ts`); `TYPE::REG` keys become `{type, registration}`
  (`DEFAULT` → `""`), MTH text becomes a number, `""` home airport becomes `null`, device voices are
  dropped. `rejected` items are shown in a dialog and never retried silently. The server never
  overwrites, so the first pull afterwards lets its copy win.
- **Flights and custom aircraft**: the session-sync engine (`api/sync/engine.ts`: outbox, three-way
  merge, 409 handling) runs once per collection with the server's `version` as its `rev`
  (`documents.ts`). Pull `GET ?updatedSince=<cursor>&limit=100` until `has_more`, apply rows (a
  `deleted_at` row removes the local copy), store the cursor **as the string received** (a
  microsecond timestamp; `null` from the server means "nothing yet" and keeps the engine at
  never-pulled). Push queued changes in order with `PUT {document, schema_version, version}`
  (version 0 creates); on 409 merge `current.document` into the local change and retry with
  `current.version` (`current: null` → version 0). A PUT answer never moves the cursor. Pull first,
  push after, pull again when something was pushed; triggers: start, window focus, tab visible,
  back online, and backoff after a failure. There is no push channel on these routes.
- **Settings**: `GET /me/settings` (404 → push the local copy); a local edit is marked pending in
  storage and sent after 1.5 s (last write wins); with nothing pending the server's copy is applied.
  Free-text home airport (not 4 letters) stays local.
- **Favorites**: a set. What this device added or removed since the last agreement is sent with the
  idempotent `PUT`/`DELETE`; the rest follows the server.
- **Airframes**: ids for `TYPE::REG` are resolved with `POST /airframes` and cached. A change to MTH or
  fuel becomes a reading with a client-minted id and **every known value** (`null` = unknown); a retry
  reuses the id. The fuel indication mode is `PATCH /airframes/{id}`. The server's state replaces the
  local one unless the local reading is newer or still waiting. A `mth_decreased` warning is a
  dismissible notice, not an error. `stores/aircraft-state.ts` is still what the UI reads.
- **Flight logs**: accepting a debrief builds one `POST /flight-logs` body (`flightLogBody`, pure) with
  a client-minted id, the track at that moment (thinned to 100 000 points / 11 MiB if needed), this
  flight's finished emergency sessions and the debrief as `reading`. The body is kept in IndexedDB
  (`nordsweet-flight-logs-<user>`) and retried with the same id until the server answers 2xx;
  409/413/422 are reported to the pilot once and dropped. The reading is **not** also sent as a
  manual reading (`aircraft-state` `record(..., {viaFlightLog: true})`). Logs are immutable: a later
  corrected acceptance of the same flight is no new log, its reading goes through `/airframes`.
- **History** (`/history`): `GET /flight-logs` (paged), details and `…/track` on demand, GPX download,
  `DELETE` (the track goes with the log). These queries are not kept in the offline query cache.
- **Delete my server data** (Settings): needs the typed username, calls `DELETE /me/data?confirm=`, then
  removes this device's copies and reloads (otherwise the sync would upload them again).
- A different user signing in on a device first wipes the previous user's copies (`clearUserData`).

## Known limits

- Other devices' changes arrive on start, focus and reconnect, not live (no push channel on these routes).
- Airframe state: "newer" compares the reading's `recorded_at` with this device's clock; a wrong clock
  can lose that race. Two pilots' readings are both kept on the server (append-only).
- A flight log cannot be corrected after it was posted (the API has no update).
- Custom-aircraft ids are minted on first read; two tabs reading the very first time at once could mint
  two ids for one draft (one tab per browser runs the sync, but any tab may read).
- Not verified against the live API: the specs mock the documented routes (`e2e/helpers/user-data-server.ts`),
  and the contract was cross-checked against the backend source.

## Backend requests

- `pilot_surname` (nullable string, ≤ 120) in `/me/settings`: the Logbook's default PIC. Until then it
  syncs through the `/sync` `settings` item, which is why that collection still exists.
