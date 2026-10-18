import { expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { geoidSchema, type GlideGrid, type GlideInput } from "~/data/terrain";
import {
  buildGlideGrid,
  gnssAltitudeTrend,
  geoidSeparationM,
  terrainEnvelope,
  terrainPixel,
  terrariumHeight,
  gridLocation,
} from "./terrain";
import {
  glideGroundSpeedKt,
  measuredTasKt,
  solveGlideReach,
  glideCell,
  glidePathTo,
  glideApproachClear,
} from "./glide-reach";

const origin = { lat: 50, lon: 20 };
function grid(patch: Partial<GlideInput> = {}, half = 24): GlideGrid {
  const input: GlideInput = {
    origin,
    altitudeM: 1200,
    tasKt: 90,
    sinkFpm: 500,
    wind: { eastKt: 0, northKt: 0, source: "manual" },
    clearanceM: 150,
    radiusM: half * 500,
    stepM: 500,
    ...patch,
  };
  return {
    input,
    half,
    size: half * 2 + 1,
    heights: new Float32Array((half * 2 + 1) ** 2),
  };
}
test("Terrarium decodes fractional/below-sea heights without Mapbox scaling; void/alpha are unknown", () => {
  expect(terrariumHeight(137, 219, 68)).toBe(2523.265625);
  expect(terrariumHeight(128, 0, 0)).toBe(0);
  expect(terrariumHeight(127, 255, 0)).toBe(-1);
  expect(terrariumHeight(0, 0, 0)).toBeNaN();
  expect(terrariumHeight(128, 0, 0, 0)).toBeNaN();
});
test("conservative envelope retains a one-pixel ridge and missing pixels block the cell", () => {
  const px = terrainPixel(origin, 10),
    x = Math.floor(px.x / 256),
    y = Math.floor(px.y / 256);
  const tile = { z: 10, x, y, heights: new Float32Array(65536) };
  const index = (Math.floor(px.y) % 256) * 256 + (Math.floor(px.x) % 256);
  tile.heights[index] = 2000;
  const lookup = new Map([[`${x}/${y}`, tile]]);
  expect(terrainEnvelope(lookup, 10, [origin])).toBe(2000);
  tile.heights[index] = NaN;
  expect(terrainEnvelope(lookup, 10, [origin])).toBeNaN();
  expect(terrainEnvelope(new Map(), 10, [origin])).toBeNaN();
});
test("EGM96 dataset has exact shape; longitude wraps and GPS correction is not terrain subtraction", () => {
  const model = geoidSchema.parse(
    JSON.parse(readFileSync("public/data/egm96.json", "utf8")),
  );
  const separation = geoidSeparationM(model, origin)!;
  expect(separation).toBeGreaterThan(20);
  expect(separation).toBeLessThan(60);
  expect(geoidSeparationM(model, { lat: 50, lon: -180 })).toBe(
    geoidSeparationM(model, { lat: 50, lon: 180 }),
  );
  expect(geoidSeparationM(model, { lat: -90, lon: 0 })).toBeNull();
  expect(1000 - separation).not.toBe(1000);
});
test("wind triangle compensates crosswind and blocks tracks that cannot be held", () => {
  const wind = { eastKt: 30, northKt: 0, source: "manual" as const };
  expect(glideGroundSpeedKt(100, wind, 90)).toBeCloseTo(130);
  expect(glideGroundSpeedKt(100, wind, 270)).toBeCloseTo(70);
  expect(glideGroundSpeedKt(100, wind, 0)).toBeCloseTo(Math.sqrt(10000 - 900));
  expect(glideGroundSpeedKt(20, wind, 0)).toBeNull();
  expect(glideGroundSpeedKt(20, wind, 270)).toBeNull();
  expect(measuredTasKt(130, 90, wind)).toBeCloseTo(100);
});
test("downwind footprint is larger than upwind; no circle is substituted", () => {
  const g = grid(
      { altitudeM: 900, wind: { eastKt: 25, northKt: 0, source: "manual" } },
      40,
    ),
    r = solveGlideReach(g);
  let west = 0,
    east = 0;
  r.arrivalM.forEach((alt, i) => {
    if (Number.isFinite(alt)) {
      const x = (i % r.size) - r.half;
      west = Math.min(west, x);
      east = Math.max(east, x);
    }
  });
  expect(east).toBeGreaterThan(Math.abs(west) * 1.3);
  expect(r.polygons.length).toBe(r.visited);
  expect(r.paths.length).toBeGreaterThan(10);
});
test("ridge clips the footprint and a closed high barrier is not crossed", () => {
  const g = grid();
  for (let y = 0; y < g.size; y++) g.heights[y * g.size + g.half + 3] = 3000;
  const r = solveGlideReach(g),
    behind = glideCell(r, gridLocation(origin, 4000, 0));
  expect(r.arrivalM[behind]).toBe(-Infinity);
  expect(glidePathTo(r, gridLocation(origin, 4000, 0))).toBeNull();
});
test("turning reach can go around a ridge and retains a hole at the peak", () => {
  const g = grid({ altitudeM: 1800, sinkFpm: 250 }, 24);
  for (let y = g.half - 2; y <= g.half + 2; y++)
    for (let x = g.half + 5; x <= g.half + 6; x++)
      g.heights[y * g.size + x] = 3000;
  const r = solveGlideReach(g),
    peak = glideCell(r, gridLocation(origin, 2500, 0));
  expect(r.arrivalM[peak]).toBe(-Infinity);
  const path = glidePathTo(r, gridLocation(origin, 7000, 0));
  expect(path).not.toBeNull();
  expect(path!.some((p) => Math.abs(p.lat - origin.lat) > 0.01)).toBe(true);
});
test("missing terrain does not turn into zero or a filled hull", () => {
  const g = grid();
  g.heights.fill(NaN);
  const r = solveGlideReach(g);
  expect(r.visited).toBe(0);
  expect(r.polygons).toEqual([]);
  expect(r.unknown).toBe(g.heights.length);
  const sparse = grid();
  sparse.heights[sparse.half * sparse.size + sparse.half + 2] = NaN;
  const result = solveGlideReach(sparse);
  expect(result.arrivalM[sparse.half * sparse.size + sparse.half + 2]).toBe(
    -Infinity,
  );
});
test("clearance is explicit, zero sink cannot produce infinite reach, below-clearance origin is empty", () => {
  const a = solveGlideReach(grid({ altitudeM: 1000 })),
    b = solveGlideReach(grid({ altitudeM: 1000, clearanceM: 700 }));
  expect(b.visited).toBeLessThan(a.visited);
  expect(solveGlideReach(grid({ altitudeM: 100 })).visited).toBe(0);
  expect(() => solveGlideReach(grid({ sinkFpm: 0 }))).toThrow();
});
test("airport approach must clear terrain along the route; being inside horizontal range is insufficient", () => {
  const g = grid({ altitudeM: 1800 }),
    threshold = { ...gridLocation(origin, 5000, 0), elevationFt: 0 };
  const clear = solveGlideReach(g);
  expect(
    glideApproachClear(clear, g.input, [origin, threshold], threshold),
  ).toBe(true);
  for (let y = 0; y < g.size; y++) g.heights[y * g.size + g.half + 5] = 3000;
  const blocked = solveGlideReach(g);
  expect(
    glideApproachClear(blocked, g.input, [origin, threshold], threshold),
  ).toBe(false);
});
test("building a grid without available DEM yields unknown cells, not a synthetic flat map", () => {
  const g = grid({}, 2);
  const result = buildGlideGrid(g.input, [], 10);
  expect([...result.heights].every(Number.isNaN)).toBe(true);
});

test("GNSS regression accepts a sustained descent, rejects sparse, gapped or noisy height", () => {
  const samples = Array.from({ length: 6 }, (_, i) => ({
    at: 10000 + i * 1000,
    altitudeM: 1000 - i * 2.54,
  }));
  expect(gnssAltitudeTrend(samples)?.verticalSpeedFpm).toBeCloseTo(-500);
  expect(gnssAltitudeTrend(samples)?.altitudeM).toBeCloseTo(987.3);
  expect(gnssAltitudeTrend(samples.slice(0, 3))).toBeNull();
  expect(
    gnssAltitudeTrend(
      samples.map((s, i) => ({ ...s, at: s.at + (i === 5 ? 6000 : 0) })),
    ),
  ).toBeNull();
  expect(
    gnssAltitudeTrend(
      samples.map((s, i) => ({
        ...s,
        altitudeM: s.altitudeM + (i === 3 ? 100 : 0),
      })),
    ),
  ).toBeNull();
});
