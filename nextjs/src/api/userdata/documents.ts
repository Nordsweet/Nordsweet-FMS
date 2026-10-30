import {
  type Collection,
  type Cursor,
  type SyncApi,
  SyncError,
  type SyncItem,
} from "../sync/contract";
import { type UserDataApi, UserDataError } from "./client";
import { type DocumentRow } from "./schemas";

export type DocumentCollection = Extract<
  Collection,
  "flights" | "custom-aircraft"
>;

/** A server row in the shape the sync engine merges: `version` is the engine's `rev`. */
const toItem = (
  collection: DocumentCollection,
  row: DocumentRow,
): SyncItem => ({
  collection,
  id: row.id,
  rev: row.version,
  schema_version: row.schema_version,
  deleted: Boolean(row.deleted_at),
  updated_at: row.updated_at,
  // These routes have no device ids or change numbers: `rev` alone orders a row's changes.
  device_id: "",
  data: row.document,
  seq: 0,
});

const PAGE = 100;

/**
 * The sync engine's view of `/flights` or `/aircraft/custom`. The pull cursor is the server's
 * opaque string, stored and sent back verbatim (`0` is the engine's "never pulled").
 */
export function documentSyncApi(
  collection: DocumentCollection,
  api: UserDataApi,
): SyncApi {
  const route = collection === "flights" ? api.flights : api.customAircraft;
  const wrap = async <T>(call: () => Promise<T>) => {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof UserDataError)) throw error;
      throw new SyncError(
        error.status,
        error.message,
        error.retryAfterS,
        error.current ? toItem(collection, error.current) : null,
      );
    }
  };
  return {
    changes: (since: Cursor, limit = PAGE) =>
      wrap(async () => {
        const page = await route.pull(
          since === 0 ? null : String(since),
          Math.min(limit, PAGE),
        );
        return {
          items: page.items.map((row) => toItem(collection, row)),
          // No cursor yet (a new user's first pull): stay at "never pulled".
          cursor: page.cursor ?? since,
          has_more: page.has_more,
        };
      }),
    put: (_, id, { data, schemaVersion, baseRev }) =>
      wrap(async () => {
        const row = await route.put(id, {
          document: data,
          schema_version: schemaVersion,
          version: baseRev,
        });
        return { rev: row.version, updated_at: row.updated_at, seq: 0 };
      }),
    remove: (_, id, baseRev) => wrap(() => route.remove(id, baseRev)),
    // No push channel on these routes: other devices are picked up on start, focus and reconnect.
    stream: (signal) =>
      new Promise<void>((resolve) => {
        if (signal.aborted) return resolve();
        signal.addEventListener("abort", () => resolve(), { once: true });
      }),
  };
}
