/**
 * Golden test: the cruise lookups (holding, route economy, climb fuel flow) against recorded
 * outputs of the legacy planner's own functions on the same POH tables.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";
import {
  cruisePerformance,
  fuelFlowAtPower,
} from "~/domain/cruise-performance";

const root = path.resolve(import.meta.dirname, "..");
const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(
    fs.readFileSync(path.join(root, "public/data/aircraft.json"), "utf8"),
  ),
);

/** Recorded 2026-10-12 from the legacy runtime (getCruisePerformanceForTable, getCruiseFuelFlowAtPower). */
type Recorded =
  | {
      id: string;
      alt: number;
      oat: number;
      wind: number;
      mode: "eco-time" | "eco-distance";
      ktas: number | null;
      fuel: number | null;
      pwr: number | null;
    }
  | { id: string; alt: number; oat: number; pct: number; flow: number | null };
const recorded = JSON.parse(
  fs.readFileSync(path.join(root, "tests/fixtures/legacy-cruise.json"), "utf8"),
) as Recorded[];

describe("cruise lookups match the legacy planner", () => {
  for (const id of new Set(recorded.map((c) => c.id))) {
    it(id, () => {
      const cruise = aircraft.find((a) => a.id === id)!.cruise!;
      for (const c of recorded.filter((r) => r.id === id)) {
        const where = JSON.stringify(c);
        if ("mode" in c) {
          const ours = cruisePerformance(cruise, c.alt, c.oat, c.wind, c.mode);
          expect(ours === null, where).toBe(c.ktas === null);
          if (ours && c.ktas !== null && c.fuel !== null) {
            expect(ours.ktas, where).toBeCloseTo(c.ktas, 6);
            expect(ours.fuelFlowLph, where).toBeCloseTo(c.fuel, 6);
          }
        } else {
          const flow = fuelFlowAtPower(cruise, c.alt, c.oat, c.pct);
          expect(flow === null, where).toBe(c.flow === null);
          if (flow !== null && c.flow !== null)
            expect(flow, where).toBeCloseTo(c.flow, 6);
        }
      }
    });
  }
});
