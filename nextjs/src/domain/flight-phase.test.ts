import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import { emergencyClimb } from "./flight-phase";

const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(fs.readFileSync("public/data/aircraft.json", "utf8")),
);

describe("emergencyClimb", () => {
  it("matches the legacy EMER panel (P2006T, 966 kg, EPKK 792 ft, 15 C)", () => {
    const p2006t = aircraft.find((a) => a.id === "P2006T")!;
    const vyse = emergencyClimb(p2006t.emergencyClimb!.vyse, 966, 792, 15);
    expect(Math.round(vyse.interpolated.iasKt)).toBe(79);
    expect(Math.round(vyse.interpolated.rateFpm)).toBe(328);
    expect(vyse.conservative).toEqual({ rateFpm: 196, iasKt: 80 });
    expect(vyse.basis).toEqual({
      weightKg: 1080,
      pressureAltitudeFt: 1000,
      temperatureC: 25,
    });
  });
});
