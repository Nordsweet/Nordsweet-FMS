import {
  type Collection,
  type Cursor,
  MAX_ITEM_BYTES,
  type SyncApi,
  SyncError,
  type SyncItem,
} from "./contract";
import { canonical, type Obj, same } from "./merge";

/** The local working copy of one collection. Ids are the sync item ids. */
export type Adapter = {
  collection: Collection;
  /** Schema version this app writes; newer remote items are kept aside, never applied or overwritten. */
  version: number;
  /** Max time between uploads of this collection (the 120 writes/min limit is per user). */
  minIntervalMs: number;
  /** A change from another device is offered to the pilot instead of merged (the flight in progress). */
  ask?: boolean;
  ids: () => Promise<string[]>;
  get: (id: string) => Promise<Obj | undefined>;
  put: (id: string, data: Obj) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  /** Normalises remote data of any known schema version; null when it cannot be used. */
  parse: (data: Obj, version: number) => Obj | null;
  /** A remote delete beats this local state even though it changed (the same flight, finished elsewhere). */
  deleteWins?: (base: Obj | null, local: Obj) => boolean;
  /** `base` is null when this id was never synced here. */
  merge: (base: Obj | null, local: Obj, remote: Obj) => Obj;
  subscribe: (onChange: () => void) => () => void;
  /** Wipes the local copy (another user signed in). */
  clear: () => Promise<unknown>;
};

export type Kv = {
  get: <T>(key: string) => Promise<T | undefined>;
  set: (key: string, value: unknown) => Promise<void>;
  del: (key: string) => Promise<void>;
  keys: () => Promise<string[]>;
};

type Rec = {
  rev: number;
  /** What this device and the server last agreed on (null: deleted or never synced). */
  base: Obj | null;
  deleted?: boolean;
  /** A newer schema (or unreadable data) than this app understands: neither applied nor overwritten. */
  blocked?: number;
  /** The remote item waiting for the pilot's answer (`ask` collections). */
  held?: SyncItem;
  /** Fingerprint of the local data the server refused (too large or invalid): not retried until it changes. */
  rejected?: string;
};
type Entry = {
  collection: string;
  id: string;
  op: "put" | "delete";
  at: number;
  /** Upload even if unchanged (taking over a flight claims it). */
  force?: boolean;
};

export type Offer = { collection: Collection; id: string; item: SyncItem };
export type SyncStatus = {
  state: "idle" | "syncing" | "offline" | "error";
  reason: string | null;
  lastSyncAt: number | null;
  pending: number;
  rejected: string[];
  offers: Offer[];
};

const MAX_ATTEMPTS = 5;
const PAGE = 500;
const BLOCKED_UNREADABLE = Number.MAX_SAFE_INTEGER;
const keyOf = (collection: string, id: string) => `${collection}/${id}`;
const recKey = (collection: string, id: string) =>
  `rec:${keyOf(collection, id)}`;
const fingerprint = (data: Obj) => {
  const text = canonical(data);
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = (h * 33) ^ text.charCodeAt(i);
  return `${text.length}:${h >>> 0}`;
};

export type Engine = ReturnType<typeof createEngine>;

export function createEngine({
  api,
  kv,
  device,
  adapters,
  now = Date.now,
  onStatus = () => undefined,
  onApplied = () => undefined,
}: {
  api: SyncApi;
  kv: Kv;
  device: string;
  adapters: Adapter[];
  now?: () => number;
  onStatus?: (patch: Partial<SyncStatus>) => void;
  onApplied?: (collection: Collection) => void;
}) {
  const byName = new Map<string, Adapter>(
    adapters.map((a) => [a.collection, a]),
  );
  const lastPush = new Map<string, number>();
  const rejected = new Map<string, string>();
  const dirty = new Set<string>(adapters.map((a) => a.collection));
  const touched = new Set<string>();
  let stuck = false;
  const offers = new Map<string, Offer>();

  const getRec = async (c: string, id: string): Promise<Rec> =>
    (await kv.get<Rec>(recKey(c, id))) ?? { rev: 0, base: null };
  const setRec = (c: string, id: string, rec: Rec) =>
    kv.set(recKey(c, id), rec);
  const getOutbox = async () => (await kv.get<Entry[]>("outbox")) ?? [];
  const setOutbox = async (outbox: Entry[]) => {
    await kv.set("outbox", outbox);
    onStatus({ pending: outbox.length });
  };
  const publishOffers = () => onStatus({ offers: [...offers.values()] });
  const publishRejected = () =>
    onStatus({ rejected: [...rejected].map(([key, why]) => `${key}: ${why}`) });

  async function enqueue(
    c: string,
    id: string,
    op: Entry["op"],
    force = false,
  ) {
    const outbox = await getOutbox();
    const i = outbox.findIndex((e) => e.collection === c && e.id === id);
    const entry: Entry = {
      collection: c,
      id,
      op,
      at: now(),
      ...(force ? { force } : {}),
    };
    if (i >= 0) outbox[i] = { ...entry, force: force || outbox[i]!.force };
    else outbox.push(entry);
    await setOutbox(outbox);
  }

  /** Local changes since the last agreement become outbox entries. */
  async function scan(only: Iterable<string> = dirty) {
    const wanted = new Set(only);
    for (const a of adapters) {
      if (!wanted.has(a.collection)) continue;
      dirty.delete(a.collection);
      const ids = await a.ids();
      const known = new Set(ids);
      for (const id of ids) {
        const rec = await getRec(a.collection, id);
        if (rec.blocked || rec.held) continue;
        const local = await a.get(id);
        if (!local) continue;
        if (rec.rejected && rec.rejected === fingerprint(local)) continue;
        if (!rec.base || !same(local, rec.base))
          await enqueue(a.collection, id, "put");
      }
      const prefix = `rec:${a.collection}/`;
      for (const key of await kv.keys()) {
        if (!key.startsWith(prefix)) continue;
        const id = key.slice(prefix.length);
        if (known.has(id)) continue;
        const rec = await getRec(a.collection, id);
        if (rec.base && !rec.held) await enqueue(a.collection, id, "delete");
      }
    }
  }

  async function reject(
    c: string,
    id: string,
    rec: Rec,
    data: Obj,
    why: string,
  ) {
    await setRec(c, id, { ...rec, rejected: fingerprint(data) });
    rejected.set(keyOf(c, id), why);
    publishRejected();
  }

  /** One remote item meets the local copy: adopt, merge, keep the local edit, or ask. */
  async function applyRemote(item: SyncItem, force = false) {
    const a = byName.get(item.collection);
    if (!a) return;
    const rec = await getRec(item.collection, item.id);
    if (!force && item.rev <= rec.rev) return;
    const done = (next: Rec) => setRec(item.collection, item.id, next);
    const key = keyOf(item.collection, item.id);
    const changed = () => {
      touched.add(a.collection);
      onApplied(a.collection);
    };

    if (item.deleted) {
      offers.delete(key);
      publishOffers();
      const local = await a.get(item.id);
      // A local edit (or an item never synced here) outlives the remote delete and recreates it.
      const edited = local && (!rec.base || !same(local, rec.base));
      if (edited && !a.deleteWins?.(rec.base, local))
        return done({ rev: item.rev, base: null, deleted: true });
      if (local) {
        await a.remove(item.id);
        changed();
      }
      return done({ rev: item.rev, base: null, deleted: true });
    }

    if (item.schema_version > a.version) {
      rejected.set(key, `needs a newer app (schema ${item.schema_version})`);
      publishRejected();
      return done({ ...rec, blocked: item.schema_version });
    }
    const remote = item.data && a.parse(item.data, item.schema_version);
    if (!remote) return done({ ...rec, blocked: BLOCKED_UNREADABLE });

    if (item.device_id === device) return done({ rev: item.rev, base: remote }); // our own write, already local

    const local = await a.get(item.id);
    if (a.ask) {
      if (local && same(local, remote))
        return done({ rev: item.rev, base: remote });
      touched.add(a.collection);
      const offer = { collection: a.collection, id: item.id, item };
      offers.set(key, offer);
      publishOffers();
      return done({ rev: item.rev, base: null, held: item });
    }
    const clean = !local || (rec.base !== null && same(local, rec.base));
    if (clean) {
      if (!local && rec.base) {
        // Deleted here, edited there: the edit wins unless the delete is newer.
        const entry = (await getOutbox()).find(
          (e) =>
            e.collection === item.collection &&
            e.id === item.id &&
            e.op === "delete",
        );
        if (entry && entry.at >= Date.parse(item.updated_at))
          return done({ rev: item.rev, base: remote });
      }
      await a.put(item.id, remote);
      changed();
      return done({ rev: item.rev, base: remote });
    }
    if (!same(local, remote)) {
      const merged = a.merge(rec.base, local, remote);
      if (!same(merged, local)) {
        await a.put(item.id, merged);
        changed();
      }
    }
    return done({ rev: item.rev, base: remote }); // scan uploads what differs from remote
  }

  async function resetState() {
    for (const key of await kv.keys())
      if (key.startsWith("rec:")) await kv.del(key);
    await kv.del("cursor");
    rejected.clear();
    publishRejected();
    offers.clear();
    publishOffers();
  }

  async function pull() {
    let cursor: Cursor = (await kv.get<Cursor>("cursor")) ?? 0;
    for (;;) {
      let page;
      try {
        page = await api.changes(cursor, PAGE);
      } catch (error) {
        if (
          error instanceof SyncError &&
          error.status === 410 &&
          cursor !== 0
        ) {
          await resetState();
          cursor = 0;
          continue;
        }
        throw error;
      }
      for (const item of page.items) await applyRemote(item);
      cursor = page.cursor;
      await kv.set("cursor", cursor);
      if (!page.has_more) return;
    }
  }

  /** Uploads one entry; true when it is settled (sent, nothing to send, or refused for good). */
  async function pushEntry(entry: Entry) {
    const a = byName.get(entry.collection);
    if (!a) return true;
    const { id } = entry;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const rec = await getRec(a.collection, id);
      if (rec.held || rec.blocked) return true;
      const local = await a.get(id);
      try {
        if (entry.op === "delete") {
          if (local || rec.deleted || rec.rev === 0) return true;
          try {
            await api.remove(a.collection, id, rec.rev);
          } catch (error) {
            if (!(error instanceof SyncError && error.status === 404))
              throw error;
          }
          await setRec(a.collection, id, {
            rev: rec.rev + 1,
            base: null,
            deleted: true,
          });
          return true;
        }
        if (!local) {
          if (!rec.base) return true;
          entry = { ...entry, op: "delete" };
          continue;
        }
        if (!entry.force && rec.base && same(local, rec.base)) return true;
        if (
          new TextEncoder().encode(JSON.stringify(local)).length >
          MAX_ITEM_BYTES
        ) {
          await reject(a.collection, id, rec, local, "item over 1 MiB");
          return true;
        }
        const sent = await api.put(a.collection, id, {
          data: local,
          schemaVersion: a.version,
          baseRev: rec.rev,
        });
        await setRec(a.collection, id, {
          rev: sent.rev,
          base: local,
          deleted: false,
        });
        lastPush.set(a.collection, now());
        if (rejected.delete(keyOf(a.collection, id))) publishRejected();
        return true;
      } catch (error) {
        if (!(error instanceof SyncError)) throw error;
        if (error.status === 409) {
          // The server's version meets ours; the next attempt sends what is left of our change.
          if (error.current) await applyRemote(error.current, true);
          else
            await setRec(a.collection, id, { ...rec, rev: 0, deleted: false });
          continue;
        }
        if ((error.status === 413 || error.status === 422) && local) {
          await reject(a.collection, id, rec, local, error.message);
          return true;
        }
        throw error;
      }
    }
    stuck = true;
    return false;
  }

  /** Returns how long to wait before the next try when something is held back (throttle or 429). */
  async function push() {
    let retryInMs: number | null = null;
    const outbox = await getOutbox();
    const deferred: Entry[] = [];
    for (let i = 0; i < outbox.length; i++) {
      const entry = outbox[i]!;
      const a = byName.get(entry.collection);
      const since = now() - (lastPush.get(entry.collection) ?? -Infinity);
      if (a && since < a.minIntervalMs) {
        retryInMs = Math.min(retryInMs ?? Infinity, a.minIntervalMs - since);
        deferred.push(entry);
        continue;
      }
      try {
        if (!(await pushEntry(entry))) deferred.push(entry);
      } catch (error) {
        await setOutbox([...deferred, ...outbox.slice(i)]);
        if (error instanceof SyncError && error.status === 429)
          return (error.retryAfterS ?? 5) * 1000;
        throw error;
      }
      await setOutbox([...deferred, ...outbox.slice(i + 1)]);
    }
    await setOutbox(deferred);
    return retryInMs;
  }

  async function run({ pull: doPull = true }: { pull?: boolean } = {}) {
    // A push after a local edit is routine; only a pull shows as "syncing".
    if (doPull) onStatus({ state: "syncing", reason: null });
    stuck = false;
    try {
      await scan();
      if (doPull) {
        touched.clear();
        await pull();
        await scan(touched);
      }
      const retryInMs = await push();
      onStatus(
        stuck
          ? { state: "error", reason: "conflict" }
          : { state: "idle", reason: null, lastSyncAt: now() },
      );
      return { retryInMs };
    } catch (error) {
      const offline =
        error instanceof SyncError &&
        (error.status === 0 || error.status >= 500);
      onStatus({
        state: offline ? "offline" : "error",
        reason: error instanceof Error ? error.message : "unknown",
      });
      throw error;
    }
  }

  // Runs never overlap; requests made while one is waiting share that next run.
  let tail: Promise<unknown> = Promise.resolve();
  let waiting: {
    promise: Promise<{ retryInMs: number | null }>;
    pull: boolean;
  } | null = null;
  function sync(options: { pull?: boolean } = {}) {
    const pull = options.pull ?? true;
    if (waiting) {
      waiting.pull ||= pull;
      return waiting.promise;
    }
    const slot = {
      pull,
      promise: null as unknown as Promise<{ retryInMs: number | null }>,
    };
    slot.promise = tail
      .catch(() => undefined)
      .then(() => {
        waiting = null;
        return run({ pull: slot.pull });
      });
    waiting = slot;
    tail = slot.promise;
    return slot.promise;
  }

  /** Startup: items kept aside for a newer schema are pulled again once this app understands them. */
  async function start() {
    let repull = false;
    for (const key of await kv.keys()) {
      if (!key.startsWith("rec:")) continue;
      const [collection = "", id = ""] = key.slice(4).split("/");
      const rec = await getRec(collection, id);
      const a = byName.get(collection);
      if (
        rec.blocked &&
        a &&
        rec.blocked <= a.version &&
        rec.blocked !== BLOCKED_UNREADABLE
      ) {
        await setRec(collection, id, {
          ...rec,
          blocked: undefined,
          rev: rec.rev - 1,
        });
        repull = true;
      } else if (rec.blocked)
        rejected.set(keyOf(collection, id), "needs a newer app");
      if (rec.held && a)
        offers.set(keyOf(collection, id), {
          collection: a.collection,
          id,
          item: rec.held,
        });
    }
    if (repull) await kv.del("cursor");
    publishRejected();
    publishOffers();
    onStatus({ pending: (await getOutbox()).length });
  }

  /** The pilot's answer to an offer: take the remote version, or keep the local one and overwrite. */
  async function resolve(
    collection: Collection,
    id: string,
    answer: "take" | "keep",
  ) {
    const a = byName.get(collection);
    const key = keyOf(collection, id);
    const offer = offers.get(key);
    if (!a || !offer) return;
    const rec = await getRec(collection, id);
    const remote =
      offer.item.data && a.parse(offer.item.data, offer.item.schema_version);
    offers.delete(key);
    publishOffers();
    if (answer === "take" && remote) {
      await a.put(id, remote);
      onApplied(collection);
      await setRec(collection, id, { rev: rec.rev, base: remote });
      await enqueue(collection, id, "put", true);
    } else {
      await setRec(collection, id, { rev: rec.rev, base: null });
      await scan([collection]);
    }
  }

  /** A local change in this collection: the next run looks at it. */
  const markDirty = (collection: Collection) => dirty.add(collection);

  return { sync, start, resolve, markDirty, resetState, adapters };
}
