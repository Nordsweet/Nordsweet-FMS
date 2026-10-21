import { expect, test } from "vitest";
import { airportSchema } from "~/data/schemas";
import airports from "../public/data/airports.json";
import { trafficPatternSchema } from "~/data/traffic-pattern";
import {
  patternRunwayGeometry,
  routeWithTrafficPattern,
  trafficPatternGeometry,
} from "~/domain/traffic-pattern";
import { destinationPoint, initialBearingDeg } from "~/domain/geo";
import { flyByRoute } from "~/domain/fly-by";
import { newTimers, stepTimers } from "~/domain/flight-timers";
import { buildRoutePlan } from "~/domain/route-plan";
import { navigationRoute } from "~/domain/navigation-route";
import { computeProgress } from "~/domain/progress";
import { plannedGuidanceAltitude } from "~/domain/flight-guidance";

test("Overhead preview/accepted conversion preserves fly-over flags and circuit level after TOD", () => {
  const airport = airportSchema.parse(airports.find((a) => a.ident === "EPNT"));
  const runway = airport.runways[0]!;
  const pattern = trafficPatternSchema.parse({
    id: "overhead",
    airport,
    runway: { ...runway, ...patternRunwayGeometry(airport, runway) },
    direction: "left",
    join: "overhead",
    altitudeAalFt: 1000,
    finalDistanceNm: 2,
    turnPerformance: { tasKt: 100 },
  });
  const plan = buildRoutePlan(
    {
      airport: () => null,
      point: () => null,
      procedures: () => [],
      airways: {},
    },
    {
      departure: {
        ...airport,
        ident: "FROM",
        ...destinationPoint(airport, 0, 30),
      },
      destination: airport,
      alternate: null,
      altitudeFt: 6000,
      routeText: "",
      selections: { SID: null, STAR: null, APPROACH: null },
      inlineSelections: {},
      insertedWaypoints: [],
      waypointAltitudes: {},
      waypointWx: {},
      conditionsWind: null,
      runwayWind: () => null,
      climbGradientFtPerNm: 500,
      trafficPattern: pattern,
    },
  )!;
  const route = navigationRoute(plan);
  const entry = route.find((p) => p.patternId === pattern.id)!;
  expect(entry.flyOver).toBe(
    trafficPatternGeometry(pattern).points[0]?.flyOver,
  );
  expect(entry.altitudeFt).toBe(airport.elevationFt + 1000);
  expect(plannedGuidanceAltitude(entry, 0, plan, 6000)).toBe(
    airport.elevationFt + 1000,
  );
  expect(route.at(-2)?.flyOver).toBe(true);
  expect(route.at(-1)?.ident).toBe("EPNT");
  const from = { ident: "FROM", ...destinationPoint(entry, 0, 5) };
  expect(
    computeProgress(
      [
        from,
        { ident: "FIX", lat: entry.lat, lon: entry.lon, flyOver: true },
        ...route.slice(route.indexOf(entry) + 1),
      ],
      destinationPoint(entry, 0, 0.2),
      0,
    )?.activeLeg,
  ).toBe(0);
});

test("Base entry retains circuit altitude and full rate-one turns even from a nearly reciprocal inbound leg", () => {
  const airport = airportSchema.parse(airports.find((a) => a.ident === "EPNT"));
  const runway = airport.runways[0]!;
  for (const direction of ["left", "right"] as const) {
    const pattern = trafficPatternSchema.parse({
      id: "base",
      airport,
      runway: { ...runway, ...patternRunwayGeometry(airport, runway) },
      direction,
      join: "base",
      altitudeAalFt: 1000,
      finalDistanceNm: 2,
      turnPerformance: { tasKt: 100 },
    });
    const seed = routeWithTrafficPattern(
      [{ ident: "FROM", ...destinationPoint(airport, 0, 8) }, { ...airport }],
      pattern,
    );
    const base = seed.find((p) => p.ident === "TP1/EPNT")!;
    const final = seed.find((p) => p.ident === "TP2/EPNT")!;
    const from = {
      ident: "FROM",
      ...destinationPoint(base, initialBearingDeg(base, final), 3),
    };
    const route = routeWithTrafficPattern([from, { ...airport }], pattern);
    expect(route.find((p) => p.ident === "TP1/EPNT")?.altitudeFt).toBe(
      airport.elevationFt + 1000,
    );
    expect(route.some((p) => p.ident.startsWith("TPJ"))).toBe(true);
    expect(flyByRoute(route, { tasKt: 100 }).issues).toEqual([]);
  }
});

test("runway approach selects Take-off on the ground only; on-block needs strictly below 2kt for 20 continuous seconds", () => {
  const threshold = { lat: 50, lon: 20 };
  const departureEnd = destinationPoint(threshold, 90, 1);
  const context = {
    phase: "taxiout" as const,
    departureElevationFt: 800,
    groundElevationFt: 800,
    cruiseAltitudeFt: 3000,
    departureRunway: { threshold, departureEnd },
  };
  const sample = {
    ...destinationPoint(threshold, 270, 0.1),
    at: 1000,
    altitudeFt: 810,
    speedKt: 5,
    headingDeg: 90,
  };
  expect(stepTimers(newTimers(), sample, context).phase).toBe("takeoff");
  expect(
    stepTimers(newTimers(), { ...sample, altitudeFt: 2000 }, context).phase,
  ).toBeNull();
  let timers = newTimers();
  timers.airTime = { ...timers.airTime, startedAt: 0, stoppedAt: 1 };
  timers.offBlock = { ...timers.offBlock, startedAt: 0 };
  for (let i = 0; i < 20; i++)
    timers = stepTimers(
      timers,
      { ...sample, at: 1000 + i * 1000, speedKt: 1.9 },
      { ...context, phase: "taxiin" },
    ).timers;
  expect(timers.offBlock.stoppedAt).toBeNull();
  timers = stepTimers(
    timers,
    { ...sample, at: 21000, speedKt: 2 },
    { ...context, phase: "taxiin" },
  ).timers;
  for (let i = 0; i <= 20; i++)
    timers = stepTimers(
      timers,
      { ...sample, at: 22000 + i * 1000, speedKt: 1.9 },
      { ...context, phase: "taxiin" },
    ).timers;
  expect(timers.offBlock.stoppedAt).toBe(22000);
});
