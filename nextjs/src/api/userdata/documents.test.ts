import { describe, expect, it } from "vitest";

import { createEngine, type Adapter } from "../sync/engine";
import { mergeFields, type Obj } from "../sync/merge";
import { type UserDataApi, UserDataError } from "./client";
import { documentSyncApi } from "./documents";
import { type DocumentRow } from "./schemas";

/** The documented `/flights` behaviour: versions, tombstones, 409 with `current`, string cursors. */
function fakeServer() {
  const rows = new Map<string, DocumentRow>();
  const changedAt = new Map<string, string>();
  let tick = 0;
  // A microsecond timestamp: what a JavaScript Date would truncate.
  const stamp = () => `2026-10-30T10:00:00.${String(++tick).padStart(6, "0")}Z`;
  const server = {
    rows,
    down: false,
    pulls: [] as (string | null)[],
    puts: [] as { id: string; version: number }[],
    removes: [] as { id: string; version?: number }[],
    lastCursor: () => `2026-10-30T10:00:00.${String(tick).padStart(6, "0")}Z`,
    /** Another device writes: no pull on our side yet. */
    write(id: string, document: Obj | null, deleted = false) {
      const version = (rows.get(id)?.version ?? 0) + 1;
      const at = stamp();
      rows.set(id, {
        id,
        version,
        schema_version: 1,
        updated_at: at,
        deleted_at: deleted ? at : null,
        document,
      });
      changedAt.set(id, at);
    },
  };
  const gate = () => {
    if (server.down) throw new UserDataError(0, "Network unavailable");
  };
  const route = {
    pull: async (cursor: string | null) => {
      gate();
      server.pulls.push(cursor);
      const items = [...rows.values()]
        .filter((r) => !cursor || changedAt.get(r.id)! > cursor)
        .sort((a, b) =>
          changedAt.get(a.id)!.localeCompare(changedAt.get(b.id)!),
        );
      return {
        items,
        has_more: false,
        // As the server does: null when nothing changed and no cursor was sent.
        cursor: items.length ? changedAt.get(items.at(-1)!.id)! : cursor,
      };
    },
    put: async (
      id: string,
      body: { document: Obj; schema_version: number; version: number },
    ) => {
      gate();
      server.puts.push({ id, version: body.version });
      const current = rows.get(id);
      if ((current?.version ?? 0) !== body.version)
        throw new UserDataError(409, "version conflict", null, current ?? null);
      server.write(id, body.document);
      return rows.get(id)!;
    },
    remove: async (id: string, version?: number) => {
      gate();
      server.removes.push({ id, version });
      const current = rows.get(id);
      if (!current) throw new UserDataError(404, "unknown");
      if (version !== undefined && version !== current.version)
        throw new UserDataError(409, "version conflict", null, current);
      server.write(id, null, true);
    },
  };
  return {
    server,
    api: { flights: route, customAircraft: route } as unknown as UserDataApi,
  };
}

const pendingNow = (status: { pending?: number }[]) =>
  status.filter((patch) => patch.pending !== undefined).at(-1)?.pending;

function setup() {
  const { server, api } = fakeServer();
  const local = new Map<string, Obj>();
  const adapter: Adapter = {
    collection: "flights",
    version: 1,
    minIntervalMs: 0,
    ids: async () => [...local.keys()],
    get: async (id) => local.get(id),
    put: async (id, data) => void local.set(id, data),
    remove: async (id) => void local.delete(id),
    parse: (data) => data,
    merge: (base, l, r) => mergeFields(base, l, r, "local", true),
    subscribe: () => () => undefined,
    clear: async () => local.clear(),
  };
  const kv = new Map<string, unknown>();
  const status: { pending?: number }[] = [];
  const engine = createEngine({
    api: documentSyncApi("flights", api),
    kv: {
      get: async <T>(key: string) => kv.get(key) as T | undefined,
      set: async (key, value) => void kv.set(key, value),
      del: async (key) => void kv.delete(key),
      keys: async () => [...kv.keys()],
    },
    device: "userdata",
    adapters: [adapter],
    onStatus: (patch) => status.push(patch),
  });
  /** A local edit: what the adapter's `subscribe` tells the runner. */
  const edit = (id: string, doc: Obj | null) => {
    if (doc) local.set(id, doc);
    else local.delete(id);
    engine.markDirty("flights");
  };
  return { server, local, kv, engine, status, edit };
}

describe("document sync queue", () => {
  it("stores the pull cursor exactly as the server sent it and sends it back unchanged", async () => {
    const { server, kv, engine } = setup();
    server.write("a", { id: "a", name: "First" });
    await engine.sync();
    expect(server.pulls).toEqual([null]); // never pulled: the full state, no updatedSince
    const cursor = server.lastCursor();
    expect(cursor).toBe("2026-10-30T10:00:00.000001Z");
    expect(await kv.get("cursor")).toBe(cursor);

    server.write("b", { id: "b", name: "Second" });
    await engine.sync();
    expect(server.pulls.at(-1)).toBe(cursor);
    expect(await kv.get("cursor")).toBe("2026-10-30T10:00:00.000002Z");
  });

  it("a new user's first pull has no cursor yet: it stays at never-pulled and asks for the full state again", async () => {
    const { server, kv, engine } = setup();
    await engine.sync(); // nothing on the server: it answers cursor null
    expect(server.pulls).toEqual([null]);
    expect(await kv.get("cursor")).toBe(0);
    await engine.sync();
    expect(server.pulls).toEqual([null, null]);
  });

  it("keeps edits made offline queued, then pulls first and pushes them (version 0 creates)", async () => {
    const { server, local, engine, status } = setup();
    local.set("f1", { id: "f1", name: "Planned offline" });
    server.down = true;
    await expect(engine.sync()).rejects.toMatchObject({ status: 0 });
    expect(pendingNow(status)).toBe(1);
    expect(server.rows.size).toBe(0);

    server.down = false;
    await engine.sync();
    expect(server.puts).toEqual([{ id: "f1", version: 0 }]);
    expect(server.rows.get("f1")).toMatchObject({
      version: 1,
      document: { name: "Planned offline" },
    });
    expect(pendingNow(status)).toBe(0);
  });

  it("merges the server's document into the local change on a 409 and retries with the server's version", async () => {
    const { server, local, engine, edit } = setup();
    local.set("f1", { id: "f1", name: "A", cruise: 1 });
    await engine.sync(); // server version 1
    server.write("f1", { id: "f1", name: "A", cruise: 2 }); // another device: version 2
    edit("f1", { id: "f1", name: "B", cruise: 1 }); // this device renames meanwhile

    await engine.sync({ pull: false }); // push without a pull: the 409 path
    expect(server.puts.map((p) => p.version)).toEqual([0, 1, 2]);
    expect(server.rows.get("f1")).toMatchObject({
      version: 3,
      document: { name: "B", cruise: 2 }, // both edits survive
    });
    expect(local.get("f1")).toEqual({ id: "f1", name: "B", cruise: 2 });
  });

  it("starts over with version 0 when the 409 says the row does not exist", async () => {
    const { server, local, engine, edit } = setup();
    local.set("f1", { id: "f1", name: "A" });
    await engine.sync();
    server.rows.delete("f1"); // gone without a tombstone
    edit("f1", { id: "f1", name: "A edited" });

    await engine.sync({ pull: false });
    expect(server.puts.map((p) => p.version)).toEqual([0, 1, 0]);
    expect(server.rows.get("f1")).toMatchObject({ version: 1 });
  });

  it("applies a tombstone from another device by removing the local copy", async () => {
    const { server, local, engine } = setup();
    local.set("f1", { id: "f1", name: "A" });
    await engine.sync();
    server.write("f1", null, true);
    await engine.sync();
    expect(local.has("f1")).toBe(false);
    expect(server.puts).toHaveLength(1); // nothing pushed back
  });

  it("deletes with the last version it saw and does not recreate the row", async () => {
    const { server, local, engine, edit } = setup();
    local.set("f1", { id: "f1", name: "A" });
    await engine.sync();
    edit("f1", null);
    await engine.sync();
    expect(server.removes).toEqual([{ id: "f1", version: 1 }]);
    expect(server.rows.get("f1")).toMatchObject({
      deleted_at: expect.any(String) as unknown,
      document: null,
    });
    await engine.sync();
    expect(local.has("f1")).toBe(false);
  });

  it("adopts the server's copy of a row this device never synced", async () => {
    const { server, local, engine } = setup();
    local.set("f1", { id: "f1", name: "Local draft" });
    server.write("f1", { id: "f1", name: "On the server" });
    await engine.sync({ pull: true });
    expect(local.get("f1")).toEqual({ id: "f1", name: "On the server" });
    expect(server.puts).toEqual([]); // the server copy won; nothing was overwritten
  });
});
