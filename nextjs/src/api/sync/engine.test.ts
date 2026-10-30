import { describe, expect, it } from "vitest";

import {
  type Collection,
  type SyncApi,
  SyncError,
  type SyncItem,
} from "./contract";
import { type Adapter, createEngine, type Kv, type SyncStatus } from "./engine";
import { mergeFields, type Obj } from "./merge";

function fakeServer() {
  const items = new Map<string, SyncItem>();
  let seq = 0;
  const state = {
    pageSize: 100,
    failWith: null as SyncError | null,
    history: 0,
    puts: 0,
  };
  const write = (item: Omit<SyncItem, "seq" | "rev"> & { rev: number }) => {
    items.set(`${item.collection}/${item.id}`, { ...item, seq: ++seq });
  };
  const api = (device: string): SyncApi => ({
    changes: async (cursor, limit = 100) => {
      const since = Number(cursor);
      if (state.failWith) throw state.failWith;
      if (since > seq || since < state.history)
        throw new SyncError(410, "gone");
      const all = [...items.values()]
        .filter((i) => i.seq > since)
        .sort((a, b) => a.seq - b.seq);
      const page = all.slice(0, Math.min(limit, state.pageSize));
      return {
        items: page,
        cursor: page.at(-1)?.seq ?? since,
        has_more: all.length > page.length,
      };
    },
    put: async (collection, id, { data, schemaVersion, baseRev }) => {
      if (state.failWith) throw state.failWith;
      const current = items.get(`${collection}/${id}`);
      if ((current?.rev ?? 0) !== baseRev)
        throw new SyncError(409, "rev conflict", null, current ?? null);
      state.puts++;
      const rev = baseRev + 1;
      write({
        collection,
        id,
        rev,
        schema_version: schemaVersion,
        deleted: false,
        updated_at: new Date().toISOString(),
        device_id: device,
        data,
      });
      return { rev, updated_at: "", seq };
    },
    remove: async (collection, id, baseRev) => {
      const current = items.get(`${collection}/${id}`);
      if (!current || current.deleted) throw new SyncError(404, "missing");
      if (current.rev !== baseRev)
        throw new SyncError(409, "rev conflict", null, current);
      write({
        ...current,
        rev: baseRev + 1,
        deleted: true,
        data: null,
        device_id: device,
        updated_at: new Date().toISOString(),
      });
    },
    stream: async () => undefined,
  });
  return { items, state, api, write };
}

const memoryKv = (
  store = new Map<string, unknown>(),
): Kv & { store: Map<string, unknown> } => ({
  store,
  get: async <T>(key: string) => store.get(key) as T | undefined,
  set: async (key, value) => void store.set(key, structuredClone(value)),
  del: async (key) => void store.delete(key),
  keys: async () => [...store.keys()],
});

function memoryAdapter(collection: Collection, options: Partial<Adapter> = {}) {
  const data = new Map<string, Obj>();
  const adapter: Adapter = {
    collection,
    version: 1,
    minIntervalMs: 0,
    ids: async () => [...data.keys()],
    get: async (id) => data.get(id),
    put: async (id, value) => void data.set(id, structuredClone(value)),
    remove: async (id) => void data.delete(id),
    parse: (value) => value,
    merge: (base, local, remote) =>
      mergeFields(base, local, remote, "local", collection !== "flights"),
    subscribe: () => () => undefined,
    clear: async () => data.clear(),
    ...options,
  };
  return { adapter, data };
}

function device(
  server: ReturnType<typeof fakeServer>,
  name: string,
  options: {
    kv?: Kv & { store: Map<string, unknown> };
    adapters?: Adapter[];
    now?: () => number;
  } = {},
) {
  const settings = memoryAdapter("settings");
  const flights = memoryAdapter("flights");
  const kv = options.kv ?? memoryKv();
  const status: Partial<SyncStatus> = {};
  const applied: Collection[] = [];
  const engine = createEngine({
    api: server.api(name),
    kv,
    device: name,
    adapters: options.adapters ?? [settings.adapter, flights.adapter],
    now: options.now,
    onStatus: (patch) => Object.assign(status, patch),
    onApplied: (c) => applied.push(c),
  });
  return { engine, settings, flights, kv, status, applied };
}

describe("pull", () => {
  it("pages through the changes with the cursor and applies every item", async () => {
    const server = fakeServer();
    server.state.pageSize = 2;
    const a = device(server, "phone-0001");
    for (const id of ["a", "b", "c", "d", "e"])
      server.write({
        collection: "flights",
        id,
        rev: 1,
        schema_version: 1,
        deleted: false,
        updated_at: "2026-01-01T00:00:00Z",
        device_id: "ipad-00001",
        data: { id },
      });
    await a.engine.sync();
    expect([...a.flights.data.keys()].sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(a.kv.store.get("cursor")).toBe(5);
  });

  it("starts again from 0 when the server cannot replay the cursor (410)", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    server.write({
      collection: "flights",
      id: "a",
      rev: 1,
      schema_version: 1,
      deleted: false,
      updated_at: "2026-01-01T00:00:00Z",
      device_id: "ipad-00001",
      data: { id: "a" },
    });
    await a.engine.sync();
    a.kv.store.set("cursor", 99); // beyond what the server can replay
    await a.engine.sync();
    expect(a.kv.store.get("cursor")).toBe(1);
    expect(a.flights.data.has("a")).toBe(true);
  });

  it("does not re-apply its own writes and skips newer schema versions", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    a.settings.data.set("main", { language: "en" });
    await a.engine.sync();
    a.settings.data.set("main", { language: "pl" }); // edited locally after the push
    server.write({
      collection: "settings",
      id: "other",
      rev: 1,
      schema_version: 2,
      deleted: false,
      updated_at: "2026-01-01T00:00:00Z",
      device_id: "ipad-00001",
      data: { language: "xx" },
    });
    await a.engine.sync({ pull: true });
    expect(a.applied).toEqual([]);
    expect(a.settings.data.get("other")).toBeUndefined();
    expect(server.items.get("settings/other")?.data).toEqual({
      language: "xx",
    });
    expect(a.status.rejected?.[0]).toContain("newer app");
  });

  it("reads a blocked item again once the app knows its schema", async () => {
    const server = fakeServer();
    server.write({
      collection: "settings",
      id: "main",
      rev: 1,
      schema_version: 2,
      deleted: false,
      updated_at: "2026-01-01T00:00:00Z",
      device_id: "ipad-00001",
      data: { language: "en" },
    });
    const first = device(server, "phone-0001");
    await first.engine.sync();
    expect(first.settings.data.size).toBe(0);
    const upgraded = memoryAdapter("settings", { version: 2 });
    const second = device(server, "phone-0001", {
      kv: first.kv,
      adapters: [upgraded.adapter],
    });
    await second.engine.start();
    await second.engine.sync();
    expect(upgraded.data.get("main")).toEqual({ language: "en" });
  });
});

describe("push", () => {
  it("creates with base_rev 0, then updates with the rev it last saw", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    a.settings.data.set("main", { language: "en" });
    await a.engine.sync();
    expect(server.items.get("settings/main")).toMatchObject({
      rev: 1,
      device_id: "phone-0001",
    });
    a.settings.data.set("main", { language: "pl" });
    a.engine.markDirty("settings");
    await a.engine.sync({ pull: false });
    expect(server.items.get("settings/main")).toMatchObject({
      rev: 2,
      data: { language: "pl" },
    });
    // Nothing changed: no further write.
    const puts = server.state.puts;
    await a.engine.sync();
    expect(server.state.puts).toBe(puts);
  });

  it("writes a tombstone for a deleted item and recreates it against the tombstone's rev", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    a.flights.data.set("f1", { name: "one" });
    await a.engine.sync();
    a.flights.data.delete("f1");
    a.engine.markDirty("flights");
    await a.engine.sync();
    expect(server.items.get("flights/f1")).toMatchObject({
      deleted: true,
      rev: 2,
    });
    a.flights.data.set("f1", { name: "again" });
    a.engine.markDirty("flights");
    await a.engine.sync();
    expect(server.items.get("flights/f1")).toMatchObject({
      deleted: false,
      rev: 3,
      data: { name: "again" },
    });
  });

  it("merges a 409 per field and retries with the server's rev", async () => {
    const server = fakeServer();
    const phone = device(server, "phone-0001");
    const ipad = device(server, "ipad-00001");
    phone.settings.data.set("main", { language: "pl", homeAirportIcao: "" });
    await phone.engine.sync();
    await ipad.engine.sync();
    phone.settings.data.set("main", {
      language: "pl",
      homeAirportIcao: "EPWA",
    });
    phone.engine.markDirty("settings");
    await phone.engine.sync({ pull: false });
    ipad.settings.data.set("main", { language: "en", homeAirportIcao: "" });
    ipad.engine.markDirty("settings");
    await ipad.engine.sync({ pull: false }); // stale: 409, merged, sent again
    expect(server.items.get("settings/main")?.data).toEqual({
      language: "en",
      homeAirportIcao: "EPWA",
    });
    await phone.engine.sync();
    expect(phone.settings.data.get("main")).toEqual({
      language: "en",
      homeAirportIcao: "EPWA",
    });
  });

  it("recreates an item the server no longer has (409 with current null)", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    a.settings.data.set("main", { language: "en" });
    await a.engine.sync();
    server.items.clear();
    a.settings.data.set("main", { language: "pl" });
    a.engine.markDirty("settings");
    await a.engine.sync({ pull: false });
    expect(server.items.get("settings/main")).toMatchObject({
      rev: 1,
      data: { language: "pl" },
    });
  });

  it("a remote edit beats an older local delete, a newer local delete beats the edit", async () => {
    for (const [deleteAt, survives] of [
      [1000, true],
      [3000, false],
    ] as const) {
      const server = fakeServer();
      const phone = device(server, "phone-0001", { now: () => deleteAt });
      const ipad = device(server, "ipad-00001");
      phone.flights.data.set("f1", { name: "one" });
      await phone.engine.sync();
      await ipad.engine.sync();
      ipad.flights.data.set("f1", { name: "edited" });
      ipad.engine.markDirty("flights");
      await ipad.engine.sync({ pull: false });
      server.items.set("flights/f1", {
        ...server.items.get("flights/f1")!,
        updated_at: new Date(2000).toISOString(),
      });
      phone.flights.data.delete("f1");
      phone.engine.markDirty("flights");
      await phone.engine.sync({ pull: false });
      expect(phone.flights.data.has("f1")).toBe(survives);
      expect(server.items.get("flights/f1")?.deleted).toBe(!survives);
    }
  });

  it("holds a refused item back (413) and keeps the local copy", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    server.state.failWith = null;
    a.flights.data.set("big", { text: "x".repeat(1024 * 1024 + 1) });
    a.flights.data.set("small", { text: "ok" });
    await a.engine.sync();
    expect(a.flights.data.has("big")).toBe(true);
    expect(server.items.has("flights/big")).toBe(false);
    expect(server.items.has("flights/small")).toBe(true);
    expect(a.status.rejected?.[0]).toContain("1 MiB");
    const puts = server.state.puts;
    await a.engine.sync();
    expect(server.state.puts).toBe(puts);
  });

  it("honours the throttle of a collection and reports when to come back", async () => {
    const server = fakeServer();
    let clock = 0;
    const live = memoryAdapter("live-flight", { minIntervalMs: 10_000 });
    const a = device(server, "phone-0001", {
      adapters: [live.adapter],
      now: () => clock,
    });
    live.data.set("current", { n: 1 });
    expect(await a.engine.sync()).toEqual({ retryInMs: null });
    live.data.set("current", { n: 2 });
    a.engine.markDirty("live-flight");
    clock = 4000;
    expect(await a.engine.sync()).toEqual({ retryInMs: 6000 });
    expect(server.items.get("live-flight/current")?.data).toEqual({ n: 1 });
    clock = 10_000;
    await a.engine.sync();
    expect(server.items.get("live-flight/current")?.data).toEqual({ n: 2 });
  });
});

describe("outbox and errors", () => {
  it("keeps changes while offline, survives a reload, coalesces and sends in order", async () => {
    const server = fakeServer();
    const kv = memoryKv();
    const first = device(server, "phone-0001", { kv });
    server.state.failWith = new SyncError(0, "offline");
    first.flights.data.set("f1", { v: 1 });
    first.flights.data.set("f2", { v: 1 });
    await expect(first.engine.sync()).rejects.toThrow("offline");
    first.flights.data.set("f1", { v: 2 });
    first.engine.markDirty("flights");
    await expect(first.engine.sync()).rejects.toThrow("offline");
    expect(first.status.state).toBe("offline");
    expect(
      (kv.store.get("outbox") as { id: string }[]).map((e) => e.id),
    ).toEqual(["f1", "f2"]);

    // Reload: a new engine over the same stores finds the queue and sends it.
    server.state.failWith = null;
    const reloaded = createEngine({
      api: server.api("phone-0001"),
      kv,
      device: "phone-0001",
      adapters: [first.flights.adapter, first.settings.adapter],
    });
    await reloaded.start();
    await reloaded.sync();
    expect(server.items.get("flights/f1")?.data).toEqual({ v: 2 });
    expect(server.items.get("flights/f2")?.data).toEqual({ v: 1 });
    expect(kv.store.get("outbox")).toEqual([]);
  });

  it("returns the Retry-After of a 429 and keeps the entry queued", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    a.flights.data.set("f1", { v: 1 });
    const api = server.api("phone-0001");
    const limited = createEngine({
      api: {
        ...api,
        put: async () => {
          throw new SyncError(429, "slow down", 12);
        },
      },
      kv: a.kv,
      device: "phone-0001",
      adapters: [a.flights.adapter],
    });
    expect(await limited.sync()).toEqual({ retryInMs: 12_000 });
    expect(a.kv.store.get("outbox")).toHaveLength(1);
  });

  it("stops on 401 and leaves the local copy and the queue alone", async () => {
    const server = fakeServer();
    const a = device(server, "phone-0001");
    a.flights.data.set("f1", { v: 1 });
    server.state.failWith = new SyncError(401, "no token");
    await expect(a.engine.sync()).rejects.toMatchObject({ status: 401 });
    expect(a.flights.data.get("f1")).toEqual({ v: 1 });
    expect(a.status.state).toBe("error");
  });
});

describe("first sign-in on a device", () => {
  it("adopts the server's settings instead of overwriting them with local defaults", async () => {
    const server = fakeServer();
    const phone = device(server, "phone-0001");
    phone.settings.data.set("main", { language: "en", pilotWeightKg: 80 });
    await phone.engine.sync();
    const fresh = device(server, "tablet-001");
    fresh.settings.data.set("main", { language: "pl", pilotWeightKg: null }); // defaults
    fresh.flights.data.set("local-only", { name: "mine" });
    await fresh.engine.sync();
    expect(fresh.settings.data.get("main")).toEqual({
      language: "en",
      pilotWeightKg: 80,
    });
    expect(server.items.get("settings/main")?.data).toEqual({
      language: "en",
      pilotWeightKg: 80,
    });
    expect(server.items.has("flights/local-only")).toBe(true); // missing remotely: pushed
  });
});

describe("asking the pilot (flight in progress)", () => {
  it("offers another device's flight and uploads it only after the pilot takes over", async () => {
    const server = fakeServer();
    const ask = { ask: true } as const;
    const phone = memoryAdapter("live-flight", ask);
    const ipad = memoryAdapter("live-flight", ask);
    const a = device(server, "phone-0001", { adapters: [phone.adapter] });
    const b = device(server, "ipad-00001", { adapters: [ipad.adapter] });
    phone.data.set("current", { leg: 2 });
    await a.engine.sync();
    await b.engine.sync();
    expect(ipad.data.size).toBe(0); // not applied silently
    expect(b.status.offers).toHaveLength(1);
    expect(server.items.get("live-flight/current")?.data).toEqual({ leg: 2 }); // not deleted either
    await b.engine.resolve("live-flight", "current", "take");
    await b.engine.sync({ pull: false });
    expect(ipad.data.get("current")).toEqual({ leg: 2 });
    expect(server.items.get("live-flight/current")).toMatchObject({
      device_id: "ipad-00001",
      rev: 2,
    });
    // The device that lost it is asked in turn instead of being overwritten.
    phone.data.set("current", { leg: 3 });
    await a.engine.sync();
    expect(a.status.offers).toHaveLength(1);
  });

  it("keeping the local flight overwrites the remote one", async () => {
    const server = fakeServer();
    const phone = memoryAdapter("live-flight", { ask: true });
    const ipad = memoryAdapter("live-flight", { ask: true });
    const a = device(server, "phone-0001", { adapters: [phone.adapter] });
    const b = device(server, "ipad-00001", { adapters: [ipad.adapter] });
    phone.data.set("current", { leg: 2 });
    await a.engine.sync();
    ipad.data.set("current", { leg: 7 });
    await b.engine.sync();
    expect(b.status.offers).toHaveLength(1);
    await b.engine.resolve("live-flight", "current", "keep");
    await b.engine.sync({ pull: false });
    expect(server.items.get("live-flight/current")?.data).toEqual({ leg: 7 });
  });

  it("a flight finished on another device ends the same flight here, but not a newer one", async () => {
    for (const [phoneFlight, ends] of [
      ["f1", true],
      ["f2", false],
    ] as const) {
      const server = fakeServer();
      const options = {
        ask: true,
        deleteWins: (base: Obj | null, local: Obj) =>
          base?.flight === local.flight,
      } as const;
      const phone = memoryAdapter("live-flight", options);
      const ipad = memoryAdapter("live-flight", options);
      const a = device(server, "phone-0001", { adapters: [phone.adapter] });
      const b = device(server, "ipad-00001", { adapters: [ipad.adapter] });
      phone.data.set("current", { flight: "f1", leg: 1 });
      await a.engine.sync();
      await b.engine.sync();
      await b.engine.resolve("live-flight", "current", "take");
      await b.engine.sync({ pull: false });
      ipad.data.delete("current"); // finished on the iPad
      b.engine.markDirty("live-flight");
      await b.engine.sync();
      expect(server.items.get("live-flight/current")?.deleted).toBe(true);
      phone.data.set("current", { flight: phoneFlight, leg: 5 }); // the phone kept flying meanwhile
      await a.engine.sync();
      expect(phone.data.has("current")).toBe(!ends);
    }
  });
});
