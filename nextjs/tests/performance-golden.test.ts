/**
 * Golden tests: the new performance engine against recorded outputs of the legacy planner's own
 * functions on the same POH data. Only intended differences may appear, each asserted below.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";
import { computeDistance, type DistanceInput } from "~/domain/performance";

const root = path.resolve(import.meta.dirname, "..");
const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(
    fs.readFileSync(path.join(root, "public/data/aircraft.json"), "utf8"),
  ),
);
const profile = (id: string) => aircraft.find((a) => a.id === id)!;

/**
 * Outputs of the legacy planner's own take-off/landing functions, recorded on 2026-10-12 before the
 * legacy code was removed (same POH data, same inputs).
 */
type Recorded = {
  aircraft: string;
  phase: "takeoff" | "landing";
  weightKg: number;
  pa: number;
  temp: number;
  headwind: number;
  surface: "paved" | "grass";
  slope: number;
  groundRollM: number;
  obstacle50ftM: number;
  note?: string;
};
const recorded = JSON.parse(
  fs.readFileSync(
    path.join(root, "tests/fixtures/legacy-performance.json"),
    "utf8",
  ),
) as Recorded[];

function compare(id: string, phase: "takeoff" | "landing", toleranceM: number) {
  const perf = profile(id)[phase]!;
  const config = perf.configurations.find(
    (c) => c.id === perf.defaultConfiguration,
  )!;
  const cases = recorded.filter(
    (r) => r.aircraft === id && r.phase === phase && !r.note,
  );
  for (const c of cases) {
    const ours = computeDistance(config, {
      weightKg: c.weightKg,
      pressureAltitudeFt: c.pa,
      temperatureC: c.temp,
      headwindKt: c.headwind,
      surface: c.surface,
      slopePct: c.slope,
    });
    const label = JSON.stringify(c);
    expect(Math.abs(ours.groundRollM - c.groundRollM), label).toBeLessThan(
      toleranceM,
    );
    expect(Math.abs(ours.obstacle50ftM - c.obstacle50ftM), label).toBeLessThan(
      toleranceM,
    );
  }
  expect(cases.length).toBeGreaterThan(100);
}

describe("golden: new engine matches the legacy planner inside the POH tables", () => {
  // Slope is not in the R172K data: the legacy planner ignored it; the new engine does too, and warns.
  it("R172K take-off", () => {
    compare("R172K", "takeoff", 0.01);
  });

  it("R172K landing", () => {
    compare("R172K", "landing", 0.01);
  });

  // The P2006T ISA column sits at the ICAO lapse rate (1.98 °C/1000 ft) instead of the legacy
  // 2 °C/1000 ft, which moves it by up to 0.2 °C at 10 000 ft: allow 1 m.
  it("P2006T take-off", () => {
    compare("P2006T", "takeoff", 1);
  });

  it("P2006T landing", () => {
    compare("P2006T", "landing", 1);
  });
});

describe("intended differences from the legacy planner", () => {
  const base: DistanceInput = {
    weightKg: 1156,
    pressureAltitudeFt: 2000,
    temperatureC: 20,
    headwindKt: 0,
    surface: "paved",
    slopePct: 0,
  };
  const r172kTakeoff = profile("R172K").takeoff!.configurations[0]!;

  it("applies the full tailwind beyond the POH limit, with a warning (legacy capped it at the limit)", () => {
    const ours = computeDistance(r172kTakeoff, { ...base, headwindKt: -15 });
    const theirs = recorded.find((r) => r.note)!;
    expect(theirs.headwind).toBe(-15);
    expect(ours.groundRollM).toBeGreaterThan(theirs.groundRollM);
    expect(ours.warnings).toContainEqual({
      code: "tailwind-above-limit",
      limitKt: 10,
    });
  });

  it("treats an unknown surface as grass and warns", () => {
    const unknown = computeDistance(r172kTakeoff, {
      ...base,
      surface: "unknown",
    });
    expect(unknown.groundRollM).toBe(
      computeDistance(r172kTakeoff, { ...base, surface: "grass" }).groundRollM,
    );
    expect(unknown.warnings).toContainEqual({ code: "surface-unknown" });
  });

  it("warns when inputs exceed the table instead of silently clamping", () => {
    const hot = computeDistance(r172kTakeoff, {
      ...base,
      temperatureC: 45,
      weightKg: 1200,
    });
    expect(hot.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "above-table",
          axis: "temperatureC",
          max: 40,
        }),
        expect.objectContaining({ code: "above-table", axis: "weightKg" }),
      ]),
    );
  });

  it("FR172H: temperature above the standard-day table and tailwind are flagged", () => {
    const fr = profile("FR172H").takeoff!.configurations[0]!;
    const r = computeDistance(fr, {
      ...base,
      temperatureC: 25,
      headwindKt: -5,
    });
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "above-table", axis: "temperatureC" }),
        { code: "tailwind-not-corrected" },
        // FR172H take-off has no grass correction in the data
      ]),
    );
    expect(
      computeDistance(fr, { ...base, surface: "grass" }).warnings,
    ).toContainEqual({ code: "grass-not-corrected" });
  });

  it("SD-4: altitude and temperature are not tabulated", () => {
    const sd4 = profile("SD-4").takeoff!.configurations[0]!;
    const r = computeDistance(sd4, { ...base, weightKg: 600 });
    expect(r.warnings).toEqual(
      expect.arrayContaining([
        { code: "not-tabulated", axis: "pressureAltitudeFt" },
        { code: "not-tabulated", axis: "temperatureC" },
      ]),
    );
    expect(
      computeDistance(sd4, { ...base, weightKg: 600, surface: "grass" })
        .groundRollM,
    ).toBe(227);
  });

  it("Husky tables are marked as draft chart digitizations", () => {
    const husky = profile("A-1A-HUSKY").takeoff!;
    const config = husky.configurations.find(
      (c) => c.id === husky.defaultConfiguration,
    )!;
    expect(
      computeDistance(config, { ...base, weightKg: 857 }).warnings,
    ).toContainEqual({ code: "draft-data" });
  });
});
