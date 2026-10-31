import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** IndexedDB in memory. Like the real one, `keys` come back sorted, not in the order they were written. */
const stores = vi.hoisted(() => new Map<string, Map<unknown, unknown>>());
vi.mock("idb-keyval", () => {
  const bucket = (store: unknown = "default") => {
    const name = String(store);
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  return {
    createStore: (db: string, store: string) => `${db}/${store}`,
    get: async (key: unknown, store?: unknown) => bucket(store).get(key),
    set: async (key: unknown, value: unknown, store?: unknown) => {
      bucket(store).set(key, value);
    },
    setMany: async (entries: [unknown, unknown][], store?: unknown) => {
      for (const [key, value] of entries) bucket(store).set(key, value);
    },
    del: async (key: unknown, store?: unknown) => {
      bucket(store).delete(key);
    },
    keys: async (store?: unknown) => [...bucket(store).keys()].sort(),
  };
});

const TILES = "nordsweet-terrain-v1/tiles";
const USED = "nordsweet-terrain-used-v1/used";
const tiles = () => stores.get(TILES)!;
const lastUsed = () =>
  stores.get(USED)?.get("lastUsed") as Record<string, number> | undefined;
const small = (z: number, x: number, y: number) => ({
  z,
  x,
  y,
  heights: new Float32Array(1), // only the key matters to eviction
});

/** A downloaded tile: the network and the image decoder are stubbed. */
function stubDownloads() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, blob: async () => new Blob() })),
  );
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 256, height: 256, close: () => undefined })),
  );
  vi.stubGlobal(
    "OffscreenCanvas",
    class {
      getContext() {
        return {
          drawImage: () => undefined,
          getImageData: () => ({ data: new Uint8ClampedArray(256 * 256 * 4) }),
        };
      }
    },
  );
}

async function terrain() {
  vi.resetModules();
  return import("./terrain");
}

beforeEach(() => {
  stores.clear();
  stubDownloads();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("tilesToEvict", () => {
  it("removes the least recently used, whatever the zoom or the alphabet says", async () => {
    const { tilesToEvict } = await terrain();
    const stored = ["10/1/1", "11/1/1", "7/1/1", "8/1/1", "9/1/1"];
    const times = new Map([
      ["10/1/1", 500], // detailed and new
      ["11/1/1", 400],
      ["7/1/1", 100], // coarse and old
      ["8/1/1", 200],
      ["9/1/1", 300],
    ]);
    expect(tilesToEvict(stored, times, 3)).toEqual(["7/1/1", "8/1/1"]);
    // The old rule (first keys alphabetically) would have removed the two newest.
    expect(stored.slice(0, 2)).toEqual(["10/1/1", "11/1/1"]);
  });

  it("does nothing within the limit, and treats a tile with no time as the oldest", async () => {
    const { tilesToEvict } = await terrain();
    expect(tilesToEvict(["a", "b"], new Map(), 2)).toEqual([]);
    expect(
      tilesToEvict(
        ["a", "b", "c"],
        new Map([
          ["a", 5],
          ["c", 9],
        ]),
        2,
      ),
    ).toEqual(["b"]);
    // Same age: key order, so the result does not change between runs.
    expect(tilesToEvict(["b", "a", "c"], new Map(), 1)).toEqual(["a", "b"]);
  });
});

describe("the offline tile cache", () => {
  it("keeps the tiles just downloaded and drops the oldest ones when it is full", async () => {
    const { MAX_STORED_TILES, loadTerrainTile } = await terrain();
    // 200 tiles of an older route (zoom 11), then 184 newer coarse tiles: the cache is full.
    const times: Record<string, number> = {};
    stores.set(TILES, new Map());
    for (let i = 0; i < 200; i++) {
      tiles().set(`11/${1000 + i}/600`, small(11, 1000 + i, 600));
      times[`11/${1000 + i}/600`] = 1000 + i;
    }
    for (let i = 0; i < 184; i++) {
      tiles().set(`8/${i}/50`, small(8, i, 50));
      times[`8/${i}/50`] = 5000 + i;
    }
    stores.set(USED, new Map([["lastUsed", times]]));
    expect(tiles().size).toBe(MAX_STORED_TILES);

    // New tiles at zoom 10 sort before every "11/..." key: the old rule deleted exactly these.
    for (const x of [500, 501, 502])
      await loadTerrainTile({ z: 10, x, y: 600 });
    await vi.waitFor(() => {
      expect(tiles().size).toBe(MAX_STORED_TILES);
      expect(tiles().has("11/1000/600")).toBe(false);
    });

    for (const x of [500, 501, 502])
      expect(tiles().has(`10/${x}/600`)).toBe(true);
    // The three oldest of the older route went, nothing newer.
    for (const i of [0, 1, 2])
      expect(tiles().has(`11/${1000 + i}/600`)).toBe(false);
    expect(tiles().has("11/1003/600")).toBe(true);
    expect(tiles().has("8/0/50")).toBe(true);
    // The index follows: new tiles are stamped, deleted ones forgotten.
    await vi.waitFor(() => {
      expect(lastUsed()?.["10/500/600"]).toBeGreaterThan(5000);
    });
    expect(lastUsed()).not.toHaveProperty("11/1000/600");
  });

  it("drops tiles stored before times were kept first", async () => {
    const { MAX_STORED_TILES, loadTerrainTile } = await terrain();
    stores.set(TILES, new Map());
    for (let i = 0; i < MAX_STORED_TILES; i++)
      tiles().set(`9/${100 + i}/7`, small(9, 100 + i, 7));
    await loadTerrainTile({ z: 7, x: 1, y: 1 });
    await vi.waitFor(() => expect(tiles().has("9/100/7")).toBe(false));
    expect(tiles().has("7/1/1")).toBe(true);
    expect(tiles().size).toBe(MAX_STORED_TILES);
  });

  it("a tile read from the cache counts as used, so it outlives older ones", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "Date"] });
    vi.setSystemTime(10_000);
    const { loadTerrainTile } = await terrain();
    const full = { z: 9, x: 1, y: 1, heights: new Float32Array(65536) };
    stores.set(TILES, new Map([["9/1/1", full]]));
    stores.set(USED, new Map([["lastUsed", { "9/1/1": 1 }]]));

    await loadTerrainTile({ z: 9, x: 1, y: 1 });
    await vi.advanceTimersByTimeAsync(5000);
    expect(lastUsed()?.["9/1/1"]).toBe(10_000);
    expect(fetch).not.toHaveBeenCalled(); // served from the cache
  });
});
