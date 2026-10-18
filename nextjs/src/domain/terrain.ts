import {
  type Geoid,
  type TerrainTile,
  type GlideInput,
  type GlideGrid,
} from "~/data/terrain";
import { destinationPoint, type LatLon } from "./geo";
import { toDeg, toRad } from "./angles";

/** Mapzen's lossless Terrarium encoding; R=0 is its no-data sentinel. */
export function terrariumHeight(r: number, g: number, b: number, alpha = 255) {
  return r === 0 || alpha !== 255 ? NaN : r * 256 + g + b / 256 - 32768;
}
export function terrainPixel(p: LatLon, zoom: number) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, p.lat));
  const n = 2 ** zoom * 256;
  return {
    x: ((p.lon + 180) / 360) * n,
    y: ((1 - Math.asinh(Math.tan(toRad(lat))) / Math.PI) / 2) * n,
  };
}
export function tileUrl(tile: { z: number; x: number; y: number }) {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${tile.z}/${tile.x}/${tile.y}.png`;
}

/** EGM96 separation from the independently interpolated, attributed XCSoar data grid. */
export function geoidSeparationM(geoid: Geoid, p: LatLon): number | null {
  if (
    !Number.isFinite(p.lat) ||
    !Number.isFinite(p.lon) ||
    Math.abs(p.lat) > 88 ||
    Math.abs(p.lon) > 180
  )
    return null;
  const y = (90 - p.lat) / 2,
    x = (((p.lon % 360) + 360) % 360) / 2;
  const ix = Math.floor(x),
    iy = Math.floor(y),
    fx = x - ix,
    fy = y - iy;
  if (iy + 1 >= 90) return null;
  const read = (dx: number, dy: number) =>
    geoid.values[(iy + dy) * 180 + ((ix + dx) % 180)]! - 127;
  return (
    (1 - fy) * ((1 - fx) * read(0, 0) + fx * read(1, 0)) +
    fy * ((1 - fx) * read(0, 1) + fx * read(1, 1))
  );
}

export function gridLocation(origin: LatLon, eastM: number, northM: number) {
  return destinationPoint(
    origin,
    toDeg(Math.atan2(eastM, northM)),
    Math.hypot(eastM, northM) / 1852,
  );
}

/** All pixels in a planning cell's geographic envelope contribute: never smooth a ridge away. */
export function terrainEnvelope(
  tiles: ReadonlyMap<string, TerrainTile>,
  zoom: number,
  corners: LatLon[],
) {
  const pixels = corners.map((p) => terrainPixel(p, zoom));
  const minX = Math.floor(Math.min(...pixels.map((p) => p.x))) - 1;
  const maxX = Math.ceil(Math.max(...pixels.map((p) => p.x))) + 1;
  const minY = Math.floor(Math.min(...pixels.map((p) => p.y))) - 1;
  const maxY = Math.ceil(Math.max(...pixels.map((p) => p.y))) + 1;
  let height = -Infinity;
  const n = 2 ** zoom;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const tx = ((Math.floor(x / 256) % n) + n) % n,
        ty = Math.floor(y / 256);
      const tile = tiles.get(`${tx}/${ty}`);
      const h =
        tile?.heights[
          (((y % 256) + 256) % 256) * 256 + (((x % 256) + 256) % 256)
        ];
      if (h === undefined || !Number.isFinite(h)) return NaN;
      height = Math.max(height, h, 0); // bathymetry is not a landing surface below the water.
    }
  return height;
}

export function buildGlideGrid(
  input: GlideInput,
  tiles: TerrainTile[],
  zoom: number,
): GlideGrid {
  const half = Math.ceil(input.radiusM / input.stepM),
    size = 2 * half + 1;
  const heights = new Float32Array(size * size);
  const lookup = new Map(tiles.map((t) => [`${t.x}/${t.y}`, t]));
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++) {
      const east = (col - half) * input.stepM,
        north = (half - row) * input.stepM;
      heights[row * size + col] = terrainEnvelope(
        lookup,
        zoom,
        [-1, 1].flatMap((a) =>
          [-1, 1].map((b) =>
            gridLocation(
              input.origin,
              east + (a * input.stepM) / 2,
              north + (b * input.stepM) / 2,
            ),
          ),
        ),
      );
    }
  return { input, size, half, heights };
}

/** A short GNSS trend needs enough elapsed time and rejects noisy height jumps. */
export function gnssAltitudeTrend(
  samples: readonly { at: number; altitudeM: number }[],
) {
  if (samples.length < 4) return null;
  const at = samples.at(-1)!.at;
  if (
    at - samples[0]!.at < 5000 ||
    at - samples[0]!.at > 10000 ||
    samples.some(
      (s, i) =>
        !Number.isFinite(s.at + s.altitudeM) ||
        (i > 0 &&
          (s.at <= samples[i - 1]!.at || s.at - samples[i - 1]!.at > 5000)),
    )
  )
    return null;
  const middle =
    samples.reduce((a, s) => a + (s.at - at) / 1000, 0) / samples.length;
  const height = samples.reduce((a, s) => a + s.altitudeM, 0) / samples.length;
  const denominator = samples.reduce(
    (a, s) => a + ((s.at - at) / 1000 - middle) ** 2,
    0,
  );
  const slope =
    samples.reduce(
      (a, s) => a + ((s.at - at) / 1000 - middle) * (s.altitudeM - height),
      0,
    ) / denominator;
  const residual = Math.sqrt(
    samples.reduce(
      (a, s) =>
        a + (s.altitudeM - height - slope * ((s.at - at) / 1000 - middle)) ** 2,
      0,
    ) / samples.length,
  );
  const verticalSpeedFpm = (slope * 60) / 0.3048;
  return Number.isFinite(slope) &&
    Math.abs(verticalSpeedFpm) <= 6000 &&
    residual <= 10
    ? { altitudeM: height - slope * middle, verticalSpeedFpm }
    : null;
}
