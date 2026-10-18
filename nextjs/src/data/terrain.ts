import { z } from "zod";

export const TERRAIN_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
export const TERRARIUM_DECODER = {
  rScaler: 256,
  gScaler: 1,
  bScaler: 1 / 256,
  offset: -32768,
};
export type TerrainTile = {
  z: number;
  x: number;
  y: number;
  heights: Float32Array;
};
export type TerrainRegion = {
  tiles: TerrainTile[];
  zoom: number;
  missing: number;
  total: number;
};
export const geoidSchema = z.object({
  width: z.literal(180),
  height: z.literal(90),
  stepDeg: z.literal(2),
  offsetM: z.literal(-127),
  values: z.array(z.number().int().min(0).max(255)).length(16200),
  source: z.string(),
  license: z.string(),
  sha256: z.string(),
});
export type Geoid = z.infer<typeof geoidSchema>;
export type GlideWind = {
  eastKt: number;
  northKt: number;
  source: "live" | "manual";
};
export type GlideInput = {
  origin: { lat: number; lon: number };
  altitudeM: number;
  tasKt: number;
  sinkFpm: number;
  wind: GlideWind;
  clearanceM: number;
  radiusM: number;
  stepM: number;
};
export type GlideGrid = {
  input: GlideInput;
  size: number;
  half: number;
  heights: Float32Array;
};
export type GlideReach = {
  polygons: [number, number][][];
  paths: [number, number][][];
  /** Best arrival altitude at each cell, MSL metres; -Infinity means unreachable/unknown. */
  arrivalM: Float32Array;
  parent: Int32Array;
  bestState: Int32Array;
  size: number;
  half: number;
  stepM: number;
  origin: { lat: number; lon: number };
  altitudeM: number;
  clearanceM: number;
  visited: number;
  unknown: number;
  limited: boolean;
  terrainM: Float32Array;
};
