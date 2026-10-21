import { afterEach, expect, test, vi } from "vitest";
import { newFlight } from "~/data/flight";
import { isDeparturePatternTarget } from "~/domain/departure-pattern";
import { fredaAvailable, fredaFuelRemaining } from "~/domain/freda";
import { newTimers } from "~/domain/flight-timers";
import { mapProfilePoints } from "~/domain/map-profile";
import { useInFlight } from "~/stores/inflight";
import { flightSnapshotSchema } from "~/data/flight-session";
import { buildRoutePlan } from "~/domain/route-plan";
import { airportSchema } from "~/data/schemas";
import airports from "../public/data/airports.json";

afterEach(() => vi.useRealTimers());
test("same-airport graphical flight plan retains departure and arrival around inserted waypoints", () => {
  const airport = airportSchema.parse(airports.find((a) => a.ident === "EPNT"));
  const plan = buildRoutePlan(
    {
      airport: () => null,
      point: () => null,
      procedures: () => [],
      airways: {},
    },
    {
      departure: airport,
      destination: airport,
      alternate: null,
      altitudeFt: 6000,
      routeText: "",
      selections: { SID: null, STAR: null, APPROACH: null },
      inlineSelections: {},
      insertedWaypoints: [
        { ident: "TURN", lat: airport.lat + 0.4, lon: airport.lon },
      ],
      waypointAltitudes: {},
      waypointWx: {},
      conditionsWind: null,
      runwayWind: () => null,
      climbGradientFtPerNm: 500,
    },
  )!;
  const fixes = plan.points.filter((p) => !p.isProfilePoint);
  expect(fixes.map((p) => p.id)).toEqual(["EPNT", "TURN", "EPNT"]);
  expect(plan.totalDistanceNm).toBeGreaterThan(40);
  expect(mapProfilePoints(plan.points).map((p) => p.id)).toEqual([
    "TOC",
    "TOD",
  ]);
});
test("a round-trip airport changes from departure to arrival exactly after the departure pattern exit", () => {
  const airport = { ident: "EPNT", lat: 50, lon: 20 };
  const flight = { ...newFlight(), departure: airport, destination: airport };
  const nav = {
    startedAt: "2026-10-20T08:00:00Z",
    phase: "climb" as const,
    activeLeg: 1,
    departurePattern: { id: "leave" },
    route: [
      { ...airport, patternId: "leave" },
      { ident: "TPD1", lat: 50.1, lon: 20, patternId: "leave" },
      { ident: "TPX1", lat: 50.2, lon: 20, patternId: "leave" },
      { ident: "OUT", lat: 51, lon: 20 },
      airport,
    ],
  };
  expect(isDeparturePatternTarget(flight, nav, "EPNT")).toBe(true);
  expect(
    isDeparturePatternTarget(flight, { ...nav, activeLeg: 2 }, "EPNT"),
  ).toBe(false);
  expect(
    isDeparturePatternTarget(
      flight,
      { ...nav, route: [nav.route[3]!, airport], activeLeg: 0 },
      "EPNT",
    ),
  ).toBe(false);
  expect(
    isDeparturePatternTarget(flight, { ...nav, startedAt: null }, "EPNT"),
  ).toBe(true);
  expect(
    isDeparturePatternTarget(
      { ...flight, destination: { ...airport, ident: "EPKK" } },
      nav,
      "EPNT",
    ),
  ).toBe(true);
});

test("FREDA fuel uses the confirmed reading, including subsequent readings and stopped air time", () => {
  const air = { ...newTimers().airTime, startedAt: 0 };
  expect(
    fredaFuelRemaining(100, 24, air, 1_800_000, { fuelL: 60, airElapsedMs: 0 }),
  ).toBe(48);
  expect(
    fredaFuelRemaining(100, 24, air, 5_400_000, {
      fuelL: 60,
      airElapsedMs: 3_600_000,
    }),
  ).toBe(48);
  expect(
    fredaFuelRemaining(100, 24, { ...air, stoppedAt: 1_800_000 }, 3_600_000, {
      fuelL: 60,
      airElapsedMs: 0,
    }),
  ).toBe(48);
  expect(fredaFuelRemaining(60, 24, air, 1_800_000, null)).toBe(48);
  expect(
    fredaFuelRemaining(60, null, air, 1_800_000, {
      fuelL: 50,
      airElapsedMs: 0,
    }),
  ).toBe(50);
  expect(fredaFuelRemaining(5, 24, air, 1_800_000, null)).toBe(0);
});

test("low-level descent/landing FREDA requires the higher of half cruise and 2000 ft above terrain", () => {
  for (const phase of ["descent", "landing", "taxiin"] as const) {
    expect(fredaAvailable(phase, 4000, 2100, 6000)).toBe(true);
    expect(fredaAvailable(phase, 2900, 2500, 6000)).toBe(false);
    expect(fredaAvailable(phase, 4000, 1900, 6000)).toBe(false);
    expect(fredaAvailable(phase, 3000, 3000, 6000)).toBe(false);
    expect(fredaAvailable(phase, 5000, null, 6000)).toBe(false);
  }
  expect(fredaAvailable("cruise", null, null, 6000)).toBe(true);
});

test("FREDA completion persists the fuel baseline without rewriting original block fuel; disabled checks cannot open", () => {
  vi.useFakeTimers();
  vi.setSystemTime(3_600_000);
  const s = useInFlight.getState();
  s.start([]);
  useInFlight.setState({
    timers: {
      ...newTimers(),
      airTime: { ...newTimers().airTime, startedAt: 0 },
    },
    phase: "cruise",
  });
  s.completeFreda(60);
  expect(useInFlight.getState().fredaFuel).toEqual({
    fuelL: 60,
    airElapsedMs: 3_600_000,
  });
  expect(
    fredaFuelRemaining(
      100,
      24,
      useInFlight.getState().timers.airTime,
      5_400_000,
      useInFlight.getState().fredaFuel,
    ),
  ).toBe(48);
  expect(
    flightSnapshotSchema.safeParse({
      flight: newFlight(),
      inflight: useInFlight.getState(),
    }).success,
  ).toBe(true);
  s.setFredaAvailable(false);
  s.openFreda();
  expect(useInFlight.getState().fredaOpen).toBe(false);
  s.tick(5_400_000);
  expect(useInFlight.getState().fredaOpen).toBe(false);
  s.setFredaAvailable(true);
  s.tick(5_400_000);
  expect(useInFlight.getState().fredaOpen).toBe(true);
});

test("TOC/TOD markers include coincident fix labels and exclude abandoned direct-to legs", () => {
  const points = [
    { id: "TOC", lat: 50.2, lon: 20, isProfilePoint: true },
    { id: "FIX", lat: 50.8, lon: 20, profileLabels: ["TOD"] },
    { id: "SOC", lat: 50.4, lon: 20, isProfilePoint: true },
  ];
  expect(mapProfilePoints(points).map((p) => p.id)).toEqual(["TOC", "TOD"]);
  expect(
    mapProfilePoints(points, [
      { ident: "DCT", lat: 50.5, lon: 20 },
      { ident: "END", lat: 51, lon: 20 },
    ]).map((p) => p.id),
  ).toEqual(["TOD"]);
  expect(
    mapProfilePoints(points, [
      { ident: "DCT", lat: 50.5, lon: 21 },
      { ident: "END", lat: 51, lon: 21 },
    ]),
  ).toEqual([]);
});
