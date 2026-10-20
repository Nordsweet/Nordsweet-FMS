# Session sync across devices

The same pilot signed in on a phone and an iPad sees the same state. The contract is the
"Sync: one session on several devices" section of the Aviation API's `docs/API.md` (the API stores
opaque JSON per user; this app owns the schemas and the merging). Code: `nextjs/src/api/sync/`.

## What syncs

| collection        | id          | local working copy                                  |
| ----------------- | ----------- | --------------------------------------------------- |
| `settings`        | `main`      | `stores/settings.ts` (without `checklistVoiceUris`) |
| `aircraft-state`  | `main`      | `stores/aircraft-state.ts`                          |
| `custom-aircraft` | `main`      | `api/aircraft.ts` drafts, as `{ drafts }`           |
| `draft`           | `main`      | `stores/flight.ts` (the flight being planned)       |
| `flights`         | flight UUID | IndexedDB library, `api/flights.ts`                 |
| `live-flight`     | `current`   | `stores/inflight.ts` + `stores/flight.ts` snapshot  |

Device-local, never synced: map view, GPS source, terrain/tile caches, traffic history, ATIS reporter
id, voice URIs, the full GPS track (`live-flight` carries the last 60 fixes; the track itself stays
with `FLIGHT_SYNC.md`, which is a separate recovery service and keeps working unchanged).

The local copy stays the source of truth and the app works offline; sync mirrors it.

## How it works

- `engine.ts`: one run is scan → pull → scan → push. It never overlaps itself.
  Local state per user and server item lives in IndexedDB (`nordsweet-sync-<username>`): the cursor,
  `{ rev, base }` per item (`base` = what this device and the server last agreed on) and an outbox.
  `base` makes merges three-way: a side that still equals `base` yields to the other.
- Local changes are found by comparing the working copy with `base` (adapter `subscribe` only says
  "look again"), so edits made while the app was closed or offline are found at startup.
- `409`: the server's `current` is merged like a pulled item, then the remaining local change is sent
  again with the new rev (`current: null` → rev 0). Five attempts, then the item stays queued and the
  status shows a conflict. `413`/`422`: the item is held back (not retried until it changes) and listed
  in the status tooltip. `429`: wait `Retry-After`. `401` ends the session (as everywhere), the local
  copy stays. `410`: sync state is dropped and pulled from 0.
- `runner.ts`: pull on every (re)connect and every stream hint; push 1.5 s after a local change;
  backoff 1–30 s; wake on `online`/tab visible; a stream silent for 45 s is dropped.
- `client.ts`: `fetch` with a stream reader for `/sync/stream` (`EventSource` cannot send headers).
  Device id: `nordsweet.deviceId.v1`, one per browser profile.
- One tab per browser and user runs the engine (Web Locks `nordsweet-sync:<username>`); others take
  over when it closes. All tabs follow each other's writes (`storage` event → persist `rehydrate`,
  `BroadcastChannel` for the flights library).
- A different user signing in on a device wipes the previous user's local copy and sync database
  first. The first user to sign in after this feature shipped keeps what is already on the device.

## Merge rules (`adapters.ts`, `merge.ts`)

- `settings`, `draft`: per field; both changed → local wins. First sync of a device adopts the server's
  copy (local defaults never overwrite it).
- `aircraft-state`: per airframe; both changed → the later `updatedAt` (tie: the server's).
- `custom-aircraft`: per aircraft (`baseId`, else `own:<type>`); both changed → local.
- `flights`: per flight; both changed → union of fields, local on the same field.
- `live-flight` is never merged. A flight from another device is offered ("take over here" /
  "keep this device"); nothing is applied or deleted until the pilot answers. Taking over uploads at
  once, so the other device is asked in turn. A remote delete (flight finished elsewhere) stops the
  same flight here without a debrief; a different, newer flight here survives it.
- A field removed on one side is gone unless the other side edited it; a conflict never drops a
  value that only one side has.

## Known limits

- First sign-in on a device with its own `settings`/`draft`: the server's copy is adopted without
  asking. Locally planned data is only kept for items the server does not have (flights, aircraft).
- Delete-vs-edit of a flight compares the delete's local time with the server's `updated_at`; a device
  with a wrong clock can lose that race.
- Only the tab that holds the lock shows live sync status; other tabs show "synced".
- Hints are in-memory in the API (one worker); with more workers other devices only catch up on the
  next reconnect or local push.
- Real two-device acceptance against the live API remains with the owner; the browser specs use an
  in-memory `/sync` (`e2e/session-sync.spec.ts`).
