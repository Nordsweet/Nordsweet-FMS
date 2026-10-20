import { get, setMany, keys, del, createStore } from "idb-keyval";
import {
  geoidSchema,
  type TerrainTile,
  type TerrainRegion,
} from "~/data/terrain";
import {
  terrainPixel,
  terrariumHeight,
  tileUrl,
  gridLocation,
  terrainEnvelope,
} from "~/domain/terrain";
import {
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  type LatLon,
} from "~/domain/geo";

const memory = new Map<string, Promise<TerrainTile>>();
const resolved = new Map<string, TerrainTile>();
export function cachedTerrainElevation(p: { lat: number; lon: number }) {
  for (let z = 13; z >= 0; z--) {
    const px = terrainPixel(p, z),
      x = Math.floor(px.x / 256),
      y = Math.floor(px.y / 256),
      tile = resolved.get(`${z}/${x}/${y}`);
    if (tile) {
      const height =
        tile.heights[(Math.floor(px.y) % 256) * 256 + (Math.floor(px.x) % 256)];
      if (Number.isFinite(height)) return Math.max(0, height!);
    }
  }
  return null;
}
const terrainDb = () => createStore("nordsweet-terrain-v1", "tiles");
let database: ReturnType<typeof createStore> | undefined;
const db = () => (database ??= terrainDb());

export async function loadGeoid() {
  const response = await fetch("/data/egm96.json");
  if (!response.ok) throw Error("EGM96 unavailable");
  return geoidSchema.parse(await response.json());
}

const pendingWrites = new Map<string, TerrainTile>();
const cacheWrites = new Set<Promise<void>>();
let regionLoads = 0;

/** Do not serialize every tile download behind a durable disk write. */
function flushTerrainWrites(force = false) {
  if ((regionLoads && !force) || !pendingWrites.size) return;
  const entries = [...pendingWrites.entries()];
  pendingWrites.clear();
  const write = setMany(entries, db())
    .then(async () => {
      const stored = await keys(db());
      if (stored.length > 384)
        await Promise.all(
          stored.slice(0, stored.length - 384).map((key) => del(key, db())),
        );
    })
    .catch(() => {
      /* Optional cache: a full/denied store cannot discard decoded terrain. */
    });
  cacheWrites.add(write);
  void write.finally(() => cacheWrites.delete(write));
}

/** Shared raw DEM for analysis; decoding explicitly disables colour conversion. */
export async function loadTerrainTile(tile: {
  z: number;
  x: number;
  y: number;
}) {
  const key = `${tile.z}/${tile.x}/${tile.y}`;
  let pending = memory.get(key);
  if (!pending) {
    pending = (async () => {
      let cached: TerrainTile | undefined;
      try {
        cached = await get<TerrainTile>(key, db());
      } catch {
        /* Private browsing can disable IndexedDB. */
      }
      if (cached?.heights.length === 65536) return cached;
      const response = await fetch(tileUrl(tile), {
        signal: AbortSignal.timeout(15_000),
        mode: "cors",
      });
      if (!response.ok) throw Error(`Terrain ${response.status}`);
      const bitmap = await createImageBitmap(await response.blob(), {
        colorSpaceConversion: "none",
        premultiplyAlpha: "none",
      });
      try {
        if (bitmap.width !== 256 || bitmap.height !== 256)
          throw Error("Invalid terrain tile size");
        const canvas = new OffscreenCanvas(256, 256),
          context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw Error("Terrain decoder unavailable");
        context.drawImage(bitmap, 0, 0);
        const pixels = context.getImageData(0, 0, 256, 256).data,
          heights = new Float32Array(65536);
        for (let i = 0; i < heights.length; i++)
          heights[i] = terrariumHeight(
            pixels[4 * i]!,
            pixels[4 * i + 1]!,
            pixels[4 * i + 2]!,
            pixels[4 * i + 3],
          );
        const result = { ...tile, heights };
        pendingWrites.set(key, result);
        flushTerrainWrites();
        return result;
      } finally {
        bitmap.close();
      }
    })();
    memory.set(key, pending);
    pending
      .then((tile) => {
        resolved.set(key, tile);
        if (resolved.size > 128) resolved.delete(resolved.keys().next().value!);
      })
      .catch(() => memory.delete(key));
    if (memory.size > 128) memory.delete(memory.keys().next().value!);
  }
  return pending;
}

/** Bounded, concurrent regional prefetch; a missing tile remains unknown rather than becoming sea level. */
export async function loadTerrainRegion(input: {
  lat: number;
  lon: number;
  radiusNm: number;
}): Promise<TerrainRegion> {
  if (
    !Number.isFinite(input.lat + input.lon + input.radiusNm) ||
    Math.abs(input.lat) > 80 ||
    Math.abs(input.lon) > 180 ||
    input.radiusNm <= 0 ||
    input.radiusNm > 65
  )
    throw Error("Unsupported terrain region");
  const corners = [-1, 1].flatMap((x) =>
    [-1, 1].map((y) =>
      gridLocation(input, x * input.radiusNm * 1852, y * input.radiusNm * 1852),
    ),
  );
  let zoom = 11;
  const coords: { x: number; y: number; z: number }[] = [];
  for (; zoom >= 7; zoom--) {
    const px = corners.map((p) => terrainPixel(p, zoom));
    const x0 = Math.floor(Math.min(...px.map((p) => p.x)) / 256),
      x1 = Math.floor(Math.max(...px.map((p) => p.x)) / 256);
    const y0 = Math.floor(Math.min(...px.map((p) => p.y)) / 256),
      y1 = Math.floor(Math.max(...px.map((p) => p.y)) / 256);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > 64) continue;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        coords.push({
          z: zoom,
          x: ((x % 2 ** zoom) + 2 ** zoom) % 2 ** zoom,
          y,
        });
    break;
  }
  const tiles: TerrainTile[] = [];
  let cursor = 0,
    missing = 0;
  regionLoads++;
  await Promise.all(
    Array.from({ length: Math.min(4, coords.length) }, async () => {
      while (cursor < coords.length) {
        const coord = coords[cursor++]!;
        try {
          tiles.push(await loadTerrainTile(coord));
        } catch {
          missing++;
        }
      }
    }),
  );
  regionLoads--;
  flushTerrainWrites();
  return { tiles, zoom, missing, total: coords.length };
}

export async function prepareTerrain(route: LatLon[]) {
  const points: LatLon[] = [];
  let limited = false;
  for (let i = 0; i < route.length; i++) {
    const from = route[i]!,
      to = route[i + 1];
    const count = to ? Math.max(1, Math.ceil(distanceNm(from, to) / 10)) : 1;
    for (let k = 0; k < count; k++) {
      if (points.length >= 16) {
        limited = true;
        break;
      }
      const p = to
        ? destinationPoint(
            from,
            initialBearingDeg(from, to),
            (distanceNm(from, to) * k) / count,
          )
        : from;
      if (!points.some((q) => distanceNm(p, q) < 3)) points.push(p);
    }
    if (limited) break;
  }
  let count = 0,
    missing = 0;
  for (const point of points) {
    const region = await loadTerrainRegion({ ...point, radiusNm: 12 });
    count += region.tiles.length;
    missing += region.missing;
  }
  // Explicit offline preparation confirms completion of the queued disk batch.
  flushTerrainWrites(true);
  await Promise.all([...cacheWrites]);
  return { count, missing, limited };
}

/** Sample the DEM envelope between profile stations, sharing the map's offline tile cache. */
export async function loadTerrainProfile(points: LatLon[]) {
  if (points.length > 12000) throw Error("Terrain profile too large");
  const envelope = (i: number) => {
    const a = points[Math.max(0, i - 1)]!,
      b = points[i]!;
    return [a, { ...b, lon: a.lon + ((b.lon - a.lon + 540) % 360) - 180 }];
  };
  let zoom = 11;
  const coordinates = (z: number) => {
    const tiles = new Map<string, { z: number; x: number; y: number }>();
    const n = 2 ** z;
    for (let i = 0; i < points.length; i++) {
      const pair = envelope(i).map((p) => terrainPixel(p, z));
      // The same one-pixel margin as terrainEnvelope, including tile boundaries.
      const minX = Math.floor((Math.min(...pair.map((p) => p.x)) - 1) / 256);
      const maxX = Math.floor((Math.max(...pair.map((p) => p.x)) + 2) / 256);
      const minY = Math.floor((Math.min(...pair.map((p) => p.y)) - 1) / 256);
      const maxY = Math.floor((Math.max(...pair.map((p) => p.y)) + 2) / 256);
      for (let x = minX; x <= maxX; x++)
        for (let y = minY; y <= maxY; y++) {
          const tx = ((x % n) + n) % n;
          if (y >= 0 && y < n) tiles.set(`${tx}/${y}`, { z, x: tx, y });
          if (tiles.size > 128) return tiles;
        }
    }
    return tiles;
  };
  let coords = coordinates(zoom);
  while (coords.size > 128 && zoom > 3) coords = coordinates(--zoom);
  const queue = [...coords.values()];
  const tiles = new Map<string, TerrainTile>();
  let cursor = 0;
  regionLoads++;
  try {
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (cursor < queue.length) {
          const coordinate = queue[cursor++]!;
          try {
            const tile = await loadTerrainTile(coordinate);
            tiles.set(`${tile.x}/${tile.y}`, tile);
          } catch {
            /* Unknown terrain stays a gap, including offline cache misses. */
          }
        }
      }),
    );
  } finally {
    regionLoads--;
    flushTerrainWrites();
  }
  return points.map((point, i) => {
    const heightM = terrainEnvelope(tiles, zoom, envelope(i));
    return Number.isFinite(heightM) ? heightM / 0.3048 : null;
  });
}
