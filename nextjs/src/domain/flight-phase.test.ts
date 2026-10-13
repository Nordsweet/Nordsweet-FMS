import fs from "node:fs";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";

import { checklistFlaps, climbTableFor, climbTableRead } from "./flight-phase";

const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(fs.readFileSync("public/data/aircraft.json", "utf8")),
);

describe("climbTableRead", () => {
  it("matches the legacy EMER panel (P2006T, 966 kg, EPKK 792 ft, 15 C)", () => {
    const p2006t = aircraft.find((a) => a.id === "P2006T")!;
    const table = climbTableFor(p2006t.climbTables, {
      flaps: "up",
      profile: "vy",
      engines: "one-inop",
    })!;
    const vyse = climbTableRead(table, 966, 792, 15);
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

describe("climbTableFor", () => {
  it("has no one-engine-inop table with take-off flaps (as legacy)", () => {
    const p2006t = aircraft.find((a) => a.id === "P2006T")!;
    expect(
      climbTableFor(p2006t.climbTables, {
        flaps: "takeoff",
        profile: "vy",
        engines: "one-inop",
      }),
    ).toBeNull();
    expect(p2006t.climbTables).toHaveLength(6);
  });
});

describe("checklistFlaps", () => {
  const flaps = { takeoffFlaps: "up" as const, landingFlaps: "APP" };
  it("puts the CONFIG flaps on the legacy checklists only", () => {
    expect(checklistFlaps("taxiout", "BEFORE TAKE OFF", "Flaps", flaps)).toBe(
      "UP",
    );
    expect(checklistFlaps("taxiout", "Run-up", "Flaps", flaps)).toBeNull();
    expect(
      checklistFlaps(
        "landing",
        "BEFORE LANDING (MEMORY ITEMS)",
        "FLAPS",
        flaps,
      ),
    ).toBe("APP");
    expect(checklistFlaps("landing", "GO AROUND", "Flaps", flaps)).toBeNull();
    expect(checklistFlaps("takeoff", "LINE UP", "Lights", flaps)).toBeNull();
  });
});
