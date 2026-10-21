import { describe, expect, it } from "vitest";
import { terrainClearancePixels } from "./terrain-clearance";

describe("terrain clearance overlay", () => {
  it("uses red through 100 ft below, yellow through 1000 ft, and hides lower terrain", () => {
    const altitude = 2000;
    const heights = new Float32Array(
      [2100, 2000, 1900, 1899, 1000, 999].map((ft) => ft * 0.3048),
    );
    const pixels = terrainClearancePixels(heights, altitude);
    expect(Array.from(pixels)).toEqual([
      255, 0, 0, 150, 255, 0, 0, 150, 255, 0, 0, 150, 255, 220, 0, 150, 255,
      220, 0, 150, 0, 0, 0, 0,
    ]);
  });
  it("leaves missing DEM and unavailable aircraft altitude transparent", () => {
    expect(
      Array.from(terrainClearancePixels(new Float32Array([NaN]), 1000)),
    ).toEqual([0, 0, 0, 0]);
    expect(
      Array.from(terrainClearancePixels(new Float32Array([500]), NaN)),
    ).toEqual([0, 0, 0, 0]);
  });
  it("updates classification when the aircraft climbs", () => {
    const height = new Float32Array([304.8]);
    expect(terrainClearancePixels(height, 1050)[1]).toBe(0);
    expect(terrainClearancePixels(height, 1500)[1]).toBe(220);
    expect(terrainClearancePixels(height, 2500)[3]).toBe(0);
  });
});
