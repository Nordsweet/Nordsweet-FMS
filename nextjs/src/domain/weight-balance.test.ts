import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import { computeLoading } from "./weight-balance";

const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(fs.readFileSync("public/data/aircraft.json", "utf8")),
);
const wb = (id: string) => aircraft.find((a) => a.id === id)!.weightBalance!;

describe("aircraft W&B data", () => {
  // Guards against unit mix-ups like the legacy C172M/C152/FR172H envelopes (moment/1000 lb·in
  // read as CG inches), which put the envelope 0.4–2 m away from where the aircraft can load.
  it.each(
    aircraft
      .filter((a) => a.weightBalance)
      .map((a) => [a.id, a.weightBalance!] as const),
  )("%s envelope lies near the empty CG", (_id, data) => {
    for (const p of data.envelope) {
      expect(Math.abs(p.momentKgm / p.weightKg - data.emptyArmM)).toBeLessThan(
        0.5,
      );
    }
  });
});

describe("computeLoading", () => {
  it("sums moments and finds the CG", () => {
    const r172k = wb("R172K");
    const r = computeLoading(r172k, {
      stationsKg: { pilot: 80, coPilot: 70 },
      fuelL: 100,
    });
    const fuelKg = 100 * 0.721;
    const expectedKg = 757 + 150 + fuelKg;
    const expectedMoment =
      757 * 0.941 + 150 * 0.9398 + fuelKg * r172k.fuel.armM;
    expect(r.totalKg).toBeCloseTo(expectedKg, 6);
    expect(r.momentKgm).toBeCloseTo(expectedMoment, 6);
    expect(r.cgM).toBeCloseTo(expectedMoment / expectedKg, 6);
    expect(r.withinEnvelope).toBe(true);
    expect(r.overMtow).toBe(false);
  });

  it("flags overweight and out-of-envelope loadings", () => {
    const r172k = wb("R172K");
    const heavy = computeLoading(r172k, {
      stationsKg: {
        pilot: 100,
        coPilot: 100,
        firstPassenger: 100,
        secondPassenger: 100,
      },
      fuelL: 150,
    });
    expect(heavy.overMtow).toBe(true);
    expect(heavy.withinEnvelope).toBe(false);
    const tailHeavy = computeLoading(r172k, {
      stationsKg: { pilot: 60, baggage: 200 },
      fuelL: 20,
    });
    expect(tailHeavy.withinEnvelope).toBe(false);
  });

  it("puts a normal C172M loading inside the corrected envelope", () => {
    const r = computeLoading(wb("C172M"), {
      stationsKg: { pilot: 77, coPilot: 70 },
      fuelL: 100,
    });
    expect(r.withinEnvelope).toBe(true);
  });
});
