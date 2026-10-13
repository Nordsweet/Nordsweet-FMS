import { describe, expect, it } from "vitest";

import { type Cruise } from "~/data/aircraft";
import { type Airport } from "~/data/schemas";

import { economySuggestions } from "./route-economy";
import {
  type RoutePlanInput,
  buildRoutePlan,
  interpolateWindProfile,
  routeTokens,
  waypointWindProfile,
} from "./route-plan";

const airport = (ident: string, lat: number, elevationFt = 0): Airport => ({
  ident,
  aliases: [],
  isIcao: true,
  name: ident,
  country: "PL",
  type: "aerodrome",
  lat,
  lon: 19,
  elevationFt,
  runways: [],
  weatherStation: null,
  contact: null,
  links: [],
  remarks: null,
  source: "test",
});

const points: Record<string, { lat: number; lon: number }> = {
  P1: { lat: 50.2, lon: 19 },
  P2: { lat: 50.5, lon: 19 },
  P3: { lat: 50.8, lon: 19 },
};
const data = {
  airport: (_code: string) => null as Airport | null,
  point: (key: string) => points[key] ?? null,
  procedures: () => [],
  airways: { A1: ["P1", "P2", "P3"] },
};

const input = (over: Partial<RoutePlanInput> = {}): RoutePlanInput => ({
  departure: airport("DEPA", 50),
  destination: airport("DEST", 51),
  alternate: null,
  altitudeFt: 3000,
  routeText: "",
  selections: { SID: null, STAR: null, APPROACH: null },
  inlineSelections: {},
  insertedWaypoints: [],
  waypointAltitudes: {},
  waypointWx: {},
  conditionsWind: null,
  runwayWind: () => null,
  climbGradientFtPerNm: 500,
  ...over,
});

describe("routeTokens", () => {
  it("joins procedures and coordinate pairs like legacy", () => {
    expect(
      routeTokens(
        "sid navur, DCT 492622N 0195727E N492622 E0195727 NAVUR 6J ABC STAR",
      ),
    ).toEqual([
      "PROC_SID_NAVUR",
      "DCT",
      "COORD_492622N0195727E",
      "COORD_492622N0195727E",
      "NAVUR6J",
      "PROC_STAR_ABC",
    ]);
  });
});

describe("buildRoutePlan", () => {
  it("adds TOC and TOD from the climb and 1:13 descent gradients", () => {
    const plan = buildRoutePlan(data, input())!;
    expect(plan.points.map((p) => p.id)).toEqual([
      "DEPA",
      "TOC",
      "TOD",
      "DEST",
    ]);
    expect(plan.points[1]!.routeDistanceNm).toBeCloseTo(6, 6);
    expect(plan.totalDistanceNm - plan.points[2]!.routeDistanceNm!).toBeCloseTo(
      3000 / (6076.12 / 13),
      3,
    );
    expect(plan.pointAltitudeByKey).toMatchObject({
      DEPA: 0,
      TOC: 3000,
      TOD: 3000,
      DEST: 0,
    });
    expect(plan.minutesAt(120)).toBeCloseTo(
      (plan.totalDistanceNm / 120) * 60,
      6,
    );
  });

  it("flies an airway backwards and reports unknown tokens", () => {
    const plan = buildRoutePlan(
      data,
      input({
        departure: airport("DEPA", 51),
        destination: airport("DEST", 50),
        routeText: "P3 A1 P1 NOPE",
      }),
    )!;
    expect(
      plan.points.map((p) => p.id).filter((id) => id.startsWith("P")),
    ).toEqual(["P3", "P2", "P1"]);
    expect(plan.usedAirways).toEqual(["A1"]);
    expect(plan.warnings).toEqual([{ code: "unknown-token", token: "NOPE" }]);
  });

  it("uses the altitude typed at a point", () => {
    const plan = buildRoutePlan(
      data,
      input({ routeText: "P2", waypointAltitudes: { P2: 4500 } }),
    )!;
    expect(plan.pointAltitudeByKey.P2).toBe(4500);
    expect(plan.verticalProfile.routeTargetAltitudeFt).toBe(4500);
  });

  it("slows the route by a waypoint WX headwind", () => {
    const calm = buildRoutePlan(data, input())!;
    const windy = buildRoutePlan(
      data,
      input({
        waypointWx: {
          DEST: [{ altitudeFt: "0", windDirection: "360", windSpeed: "20" }],
        },
      }),
    )!;
    expect(windy.routeWindComponentKt).toBeCloseTo(-20, 6);
    expect(windy.minutesAt(120)).toBeCloseTo(
      (calm.totalDistanceNm / 100) * 60,
      6,
    );
  });
});

describe("waypoint wind profile", () => {
  it("interpolates direction and speed as vectors", () => {
    const profile = waypointWindProfile([
      { altitudeFt: "4000", windDirection: "90", windSpeed: "10" },
      { altitudeFt: "0", windDirection: "360", windSpeed: "10" },
      { altitudeFt: "", windDirection: "", windSpeed: "" },
    ]);
    const wind = interpolateWindProfile(profile, 2000)!;
    expect(wind.windDirection).toBe(45);
    expect(wind.windSpeed).toBeCloseTo(Math.SQRT2 * 5, 6);
  });
});

describe("economySuggestions", () => {
  it("never suggests altitudes below the airports (legacy suggested S.L.)", () => {
    const row = (pressureAltitudeFt: number, fuelFlowLph: number) => ({
      pressureAltitudeFt,
      isaDeltaC: 0,
      setting: "2300 RPM / 22 inHg",
      powerPct: 55,
      ktas: 100,
      fuelFlowLph,
    });
    // Lower is cheaper, so only the limits keep the plan up.
    const cruise = {
      source: "test",
      draft: false,
      rows: [row(0, 20), row(8000, 30)],
    } as Cruise;
    const plan = buildRoutePlan(
      data,
      input({
        departure: airport("DEPA", 50, 1200),
        destination: airport("DEST", 51, 300),
      }),
    )!;
    const result = economySuggestions(plan, cruise, 15, input());
    if (result.error) throw new Error(result.error);
    const altitudes = result.points.map((p) => p.altitudeFt);
    expect(altitudes[0]).toBe(1500);
    expect(altitudes.at(-1)).toBe(500);
    expect(Math.min(...altitudes.slice(1, -1))).toBe(2500);
  });
});
