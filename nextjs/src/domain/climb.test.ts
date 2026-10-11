import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import { trueAirspeedKt } from "./atmosphere";
import { PLANNING_RATE_FACTOR, computeClimb } from "./climb";

const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(fs.readFileSync("public/data/aircraft.json", "utf8")),
);
const climb = (id: string) => aircraft.find((a) => a.id === id)!.climb!;

describe("trueAirspeedKt", () => {
  it("equals IAS at sea level and grows ~2% per 1000 ft", () => {
    expect(trueAirspeedKt(100, 0)).toBeCloseTo(100, 6);
    expect(trueAirspeedKt(100, 5000)).toBeCloseTo(107.8, 0);
  });
});

describe("computeClimb", () => {
  it("R172K: one 100 ft step at sea level uses 80% of the POH rate", () => {
    // R172K POH max rate at 2550 lb, sea level, 0 °C: 920 fpm; ISA at 50 ft ≈ 14.9 °C lies between
    // the 0 and 20 °C columns, and the conservative read takes the 20 °C column.
    const r = computeClimb(climb("R172K"), {
      weightKg: 1156.661,
      fromFt: 0,
      toFt: 100,
      isaDeviationC: 0,
    });
    const tableRate20C = 100 / (r.minutes * PLANNING_RATE_FACTOR);
    expect(tableRate20C).toBeGreaterThan(700);
    expect(tableRate20C).toBeLessThan(920);
    expect(r.fuelFlowLph).toBe(65);
    expect(r.warnings).toEqual([]);
  });

  it("takes longer on a hot day", () => {
    const base = { weightKg: 1156.661, fromFt: 1000, toFt: 6000 };
    const isa = computeClimb(climb("R172K"), { ...base, isaDeviationC: 0 });
    const hot = computeClimb(climb("R172K"), { ...base, isaDeviationC: 15 });
    expect(hot.minutes).toBeGreaterThan(isa.minutes);
    expect(isa.averageTasKt).toBeGreaterThan(70);
  });

  it("SD-4 uses its density-altitude table and flags draft data", () => {
    const r = computeClimb(climb("SD-4"), {
      weightKg: 600,
      fromFt: 500,
      toFt: 3500,
      isaDeviationC: 0,
    });
    expect(r.minutes).toBeGreaterThan(3);
    expect(r.warnings).toContainEqual({ code: "draft-data" });
  });

  it("warns when the POH gives no climb fuel flow", () => {
    const r = computeClimb(climb("P2006T"), {
      weightKg: 1180,
      fromFt: 0,
      toFt: 4000,
      isaDeviationC: 0,
    });
    expect(r.warnings).toContainEqual({ code: "no-fuel-flow" });
    expect(r.fuelFlowLph).toBeNull();
  });

  it("stops at the practical ceiling instead of climbing forever", () => {
    const r = computeClimb(climb("R172K"), {
      weightKg: 1156.661,
      fromFt: 0,
      toFt: 30000,
      isaDeviationC: 20,
    });
    expect(r.reachedFt).toBeLessThan(30000);
    expect(r.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["ceiling", "above-table"]),
    );
  });
});
