/**
 * Golden tests: the new performance engine against the legacy planner's own functions, run on the
 * same POH data. Only intended differences may appear, and each is asserted explicitly below.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { describe, expect, it } from "vitest";

import { datasetSchemas } from "~/data/schemas";
import { computeDistance, type DistanceInput } from "~/domain/performance";

const root = path.resolve(import.meta.dirname, "../..");
const planner = fs.readFileSync(
  path.join(root, "src/runtime/index.js"),
  "utf8",
);
const aircraft = datasetSchemas.aircraft.parse(
  JSON.parse(
    fs.readFileSync(path.join(root, "public/data/aircraft.json"), "utf8"),
  ),
);

function legacyEngine() {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({
    window,
    console,
    getRunwayToraM: () => null,
    getRunwayLdaM: () => null,
  });
  for (const m of planner.matchAll(
    /loadScript\("\.\/(aircraft-data[^"]*)"\)/g,
  )) {
    vm.runInContext(
      fs.readFileSync(
        path.join(root, "public", decodeURIComponent(m[1]!)),
        "utf8",
      ),
      context,
    );
  }
  const fn = (name: string) => {
    const start = planner.indexOf(`\nfunction ${name}(`);
    if (start < 0) throw new Error(`legacy function ${name} not found`);
    const end = planner.indexOf("\n}\n", start);
    return planner.slice(start, end + 3);
  };
  const lines = planner.split("\n");
  const constants = lines
    .slice(411, 502)
    .join("\n")
    .replace(/^const /gm, "var ");
  const names = [
    "toNumber roundTo lerp getBracket getCeilingValue getCeilingTemperaturePoint interpolatePointsByTemperature",
    "getIsaTemperature",
    "getR172KTakeoffEntryForKg getR172KTakeoffWeightTable getR172KTakeoffTemperaturePoints",
    "interpolateR172KTakeoffMetricForTable interpolateR172KTakeoffSettingByWeight applyR172KTakeoffCorrections",
    "getR172KTakeoffConservativeTableRead getR172KTakeoffPerformance",
    "getR172KLandingEntryForKg getR172KLandingWeightTable getR172KLandingTemperaturePoints",
    "interpolateR172KLandingMetricForTable interpolateR172KLandingSettingByWeight applyR172KLandingCorrections",
    "getR172KLandingConservativeTableRead getR172KLandingPerformance",
    "getP2006TWeightTable getP2006TLandingWeightTable getP2006TTemperaturePoints interpolateMetricForWeightTable",
    "interpolateSettingByWeight interpolateLandingSettingByWeight getConservativeMetricForWeightTable",
    "applyP2006TCorrections getP2006TConservativeTableRead getP2006TTakeoffPerformance",
    "applyP2006TLandingCorrections getP2006TLandingConservativeTableRead getP2006TLandingPerformance",
  ]
    .join(" ")
    .split(" ");
  vm.runInContext(constants + "\n" + names.map(fn).join("\n"), context);
  return context as unknown as Record<
    string,
    (
      ...args: unknown[]
    ) => { correctedGroundRollM: number; correctedObstacle50ftM: number } | null
  >;
}

const legacy = legacyEngine();
const profile = (id: string) => aircraft.find((a) => a.id === id)!;

type Case = {
  weightKg: number;
  pa: number;
  temp: number;
  headwind: number;
  surface: "paved" | "grass";
  slope: number;
};

function cases(weights: number[], pas: number[], temps: number[]): Case[] {
  const out: Case[] = [];
  for (const weightKg of weights)
    for (const pa of pas)
      for (const temp of temps)
        for (const headwind of [0, 7, -4])
          for (const surface of ["paved", "grass"] as const)
            for (const slope of [0, 1.5])
              out.push({ weightKg, pa, temp, headwind, surface, slope });
  return out;
}

function compare(
  id: string,
  phase: "takeoff" | "landing",
  legacyFn: string,
  list: Case[],
  toleranceM: number,
) {
  const perf = profile(id)[phase]!;
  const config = perf.configurations.find(
    (c) => c.id === perf.defaultConfiguration,
  )!;
  let compared = 0;
  for (const c of list) {
    const input: DistanceInput = {
      weightKg: c.weightKg,
      pressureAltitudeFt: c.pa,
      temperatureC: c.temp,
      headwindKt: c.headwind,
      surface: c.surface,
      slopePct: c.slope,
    };
    const ours = computeDistance(config, input);
    const theirs = legacy[legacyFn]!(
      c.weightKg,
      c.pa,
      c.temp,
      { surface: c.surface, slope: c.slope },
      { headwind: c.headwind },
    )!;
    const label = JSON.stringify(c);
    expect(
      Math.abs(ours.groundRollM - theirs.correctedGroundRollM),
      label,
    ).toBeLessThan(toleranceM);
    expect(
      Math.abs(ours.obstacle50ftM - theirs.correctedObstacle50ftM),
      label,
    ).toBeLessThan(toleranceM);
    compared++;
  }
  expect(compared).toBeGreaterThan(100);
}

describe("golden: new engine matches the legacy planner inside the POH tables", () => {
  // Slope is not in the R172K data: the legacy planner ignored it; the new engine does too, and warns.
  const r172kCases = cases(
    [1000, 1088.6, 1156],
    [0, 1500, 4200, 7900],
    [-5, 0, 13, 25, 40],
  );

  it("R172K take-off", () => {
    compare("R172K", "takeoff", "getR172KTakeoffPerformance", r172kCases, 0.01);
  });

  it("R172K landing", () => {
    compare("R172K", "landing", "getR172KLandingPerformance", r172kCases, 0.01);
  });

  // The P2006T ISA column sits at the ICAO lapse rate (1.98 °C/1000 ft) instead of the legacy
  // 2 °C/1000 ft, which moves it by up to 0.2 °C at 10 000 ft: allow 1 m.
  const p2006tCases = cases(
    [930, 1000, 1290],
    [0, 2500, 6000, 9500],
    [-25, -3, 8, 20, 45],
  );

  it("P2006T take-off", () => {
    compare("P2006T", "takeoff", "getP2006TTakeoffPerformance", p2006tCases, 1);
  });

  it("P2006T landing", () => {
    compare("P2006T", "landing", "getP2006TLandingPerformance", p2006tCases, 1);
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
    const theirs = legacy.getR172KTakeoffPerformance!(
      1156,
      2000,
      20,
      { surface: "paved" },
      { headwind: -15 },
    )!;
    expect(ours.groundRollM).toBeGreaterThan(theirs.correctedGroundRollM);
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
