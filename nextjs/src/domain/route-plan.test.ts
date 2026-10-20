import { describe, expect, it } from "vitest";
import { anchoredWaypoint } from "./waypoint-insertion";
import { routeEditKeys, clearedRoute } from "./route-edit";
import { newFlight, flightSchema } from "~/data/flight";

import { type Cruise } from "~/data/aircraft";
import { type Airport, type Procedure } from "~/data/schemas";

import { economySuggestions } from "./route-economy";
import {
  altitudeRestriction,
  speedRestrictionKt,
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
  it("keeps an airway fix removed across recalculation without flattening the remaining route", () => {
    const request = input({ routeText: "P1 A1 P3" });
    const original = buildRoutePlan(data, request)!;
    const index = original.points.findIndex((p) => p.id === "P2");
    const removedRoutePoints = [routeEditKeys(original.points)[index]!];
    const changed = buildRoutePlan(data, { ...request, removedRoutePoints })!;
    expect(changed.points.map((p) => p.id)).not.toContain("P2");
    expect(changed.points.map((p) => p.id)).toEqual(
      expect.arrayContaining(["DEPA", "P1", "P3", "DEST"]),
    );
    expect(changed.usedAirways).toEqual(original.usedAirways);
    expect(changed.legs.every((leg) => leg.distanceNm > 0)).toBe(true);
    expect(
      buildRoutePlan(data, {
        ...request,
        altitudeFt: 4500,
        removedRoutePoints,
      })!.points.map((p) => p.id),
    ).not.toContain("P2");
    expect(buildRoutePlan(data, request)!.points.map((p) => p.id)).toContain(
      "P2",
    );
    expect(
      buildRoutePlan(data, {
        ...request,
        removedRoutePoints,
        insertedWaypoints: [{ ident: "P2", ...points.P2! }],
      })!.points.map((p) => p.id),
    ).toContain("P2");
  });

  it("clears all route inputs and retains aircraft and fuel, including older saved flights", () => {
    const original = {
      ...newFlight(),
      aircraftId: "C172S",
      fuel: { blockL: 60 },
      departure: { ident: "DEPA", lat: 50, lon: 19 },
      routeText: "P1",
      removedRoutePoints: ["old-fix"],
      waypoints: [{ ident: "P2", lat: 50.5, lon: 19 }],
    };
    const cleared = flightSchema.parse({ ...original, ...clearedRoute });
    expect(cleared).toMatchObject({
      aircraftId: "C172S",
      fuel: { blockL: 60 },
      departure: null,
      destination: null,
      routeText: "",
      waypoints: [],
      removedRoutePoints: [],
      sid: null,
      departurePattern: null,
      trafficPattern: null,
    });
    expect(
      flightSchema.parse({ ...original, removedRoutePoints: undefined })
        .removedRoutePoints,
    ).toEqual([]);
  });

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

it("keeps anchored map points on the requested leg and applies pilot restrictions", () => {
  const plan = buildRoutePlan(
    data,
    input({
      routeText: "P1 P2 P3",
      insertedWaypoints: [
        {
          ident: "WPT 1",
          lat: 50.21,
          lon: 19.01,
          anchor: { from: "P2", to: "P3" },
        },
      ],
      pointRestrictions: {
        P2: { speedKt: 80.4, altitudeFt: 4000.4, altitudeMode: "above" },
      },
    }),
  )!;
  const ids = plan.points.map((p) => p.id);
  expect(ids.indexOf("WPT 1")).toBeGreaterThan(ids.indexOf("P2"));
  expect(ids.indexOf("WPT 1")).toBeLessThan(ids.indexOf("P3"));
  const p = plan.points.find((p) => p.id === "P2")!;
  expect(speedRestrictionKt(p)).toBe(80);
  expect(altitudeRestriction(p)).toMatchObject({
    source: "user",
    minFt: 4000,
    maxFt: null,
    type: "atOrAbove",
  });
});

it("keeps an explicit insertion before the selected fix even when another leg is shorter", () => {
  const route = [
    { ident: "DEPA", lat: 50, lon: 19 },
    ...Object.entries(points).map(([ident, p]) => ({ ident, ...p })),
    { ident: "DEST", lat: 51, lon: 19 },
  ];
  const inserted = anchoredWaypoint(
    route,
    { ident: "NEW", lat: 50.79, lon: 19.01 },
    1,
  );
  const plan = buildRoutePlan(
    data,
    input({ routeText: "P1 P2 P3", insertedWaypoints: [inserted] }),
  )!;
  expect(plan.points.filter((p) => !p.isProfilePoint).map((p) => p.id)).toEqual(
    ["DEPA", "NEW", "P1", "P2", "P3", "DEST"],
  );
});

it("supports repeated FPL fixes and manual positions before/after endpoints", () => {
  const route = [
    { ident: "DEPA", lat: 50, lon: 19 },
    { ident: "P1", ...points.P1! },
    { ident: "DEST", lat: 51, lon: 19 },
  ];
  const inserted = [
    anchoredWaypoint(route, { ident: "FIRST", lat: 49.9, lon: 19 }, 0),
    anchoredWaypoint(route, { ident: "P1", ...points.P1! }, 1),
    anchoredWaypoint(route, { ident: "LAST", lat: 51.1, lon: 19 }, 3),
  ];
  const plan = buildRoutePlan(
    data,
    input({ routeText: "P1", insertedWaypoints: inserted }),
  )!;
  expect(plan.points.filter((p) => !p.isProfilePoint).map((p) => p.id)).toEqual(
    ["FIRST", "DEPA", "P1", "P1", "DEST", "LAST"],
  );
});

it("recalculates split procedure legs while preserving published altitude and speed limits", () => {
  const procedure: Procedure = {
    airport: "DEST",
    type: "STAR",
    id: "ARR1A",
    designator: "ARR1A",
    runways: [],
    source: "test",
    legs: [
      {
        ident: "P1",
        ...points.P1!,
        altitude: null,
        speedKt: null,
        trackMagDeg: null,
        distanceNm: null,
      },
      {
        ident: "P2",
        ...points.P2!,
        altitude: { raw: "FL40", type: "atOrAbove" },
        speedKt: 80,
        trackMagDeg: 123,
        distanceNm: 999,
      },
    ],
  };
  const routeData = {
    ...data,
    point: (key: string) =>
      key === "ARR" ? { lat: 50.1, lon: 19 } : data.point(key),
    procedures: (airport: string, type: string) =>
      airport === "DEST" && type === "STAR" ? [procedure] : [],
  };
  const base = input({
    selections: { SID: null, STAR: "ARR1A", APPROACH: null },
  });
  const original = buildRoutePlan(routeData, base)!;
  const route = original.points
    .filter((p) => !p.isProfilePoint)
    .map((p) => ({ ident: p.id, lat: p.lat, lon: p.lon }));
  const inserted = anchoredWaypoint(
    route,
    { ident: "NEW", lat: 50.4, lon: 19.1 },
    route.findIndex((p) => p.ident === "P2"),
  );
  const updated = buildRoutePlan(routeData, {
    ...base,
    insertedWaypoints: [inserted],
  })!;
  expect(updated.totalDistanceNm).toBeLessThan(original.totalDistanceNm);
  expect(updated.points.find((p) => p.id === "P2")?.procedureLeg).toMatchObject(
    {
      distanceNm: null,
      trackMagDeg: null,
      speedKt: 80,
      altitude: { raw: "FL40", type: "atOrAbove" },
    },
  );
  expect(procedure.legs[1]!.distanceNm).toBe(999);
});
