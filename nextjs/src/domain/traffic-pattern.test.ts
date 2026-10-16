import { afterEach, expect, test, vi } from "vitest";
import airports from "../../public/data/airports.json";
import { airportSchema } from "~/data/schemas";
import {
  trafficPatternSchema,
  type TrafficPattern,
} from "~/data/traffic-pattern";
import { newFlight, flightSchema } from "~/data/flight";
import { parseNordFile, toNordFile } from "~/data/nord";
import { atisSchema } from "~/api/aviation/schemas";
import {
  patternRunwayGeometry,
  routeWithTrafficPattern,
  trafficPatternGeometry,
  trafficPatternReport,
  activeRouteWithTrafficPattern,
} from "./traffic-pattern";
import { patternRunwaySuggestion } from "./traffic-pattern-runway";
import { distanceNm, destinationPoint, trackOffset } from "./geo";
import { buildRoutePlan, pointKey } from "./route-plan";
import { computeProgress } from "./progress";
import { useInFlight } from "~/stores/inflight";
import { flyByRoute } from "./fly-by";
import {
  departureRunwayChoice,
  resolvedDeparturePattern,
  taxiDepartureRunway,
} from "./departure-pattern";
import type { Ground } from "~/data/schemas";

const threshold = { lat: 50, lon: 20, elevationFt: 500 };
const end = destinationPoint(threshold, 90, 1000 / 1852);
const airport = airportSchema.parse({
  ident: "EPAA",
  aliases: [],
  isIcao: true,
  name: "Test",
  country: "PL",
  type: "aerodrome",
  ...threshold,
  runways: [
    {
      designator: "09",
      trueHeadingDeg: 90,
      surface: "grass",
      lengthM: 1000,
      widthM: null,
      slopePct: 0,
      toraM: null,
      todaM: null,
      asdaM: null,
      ldaM: null,
      threshold,
    },
    {
      designator: "27",
      trueHeadingDeg: 270,
      surface: "grass",
      lengthM: 1000,
      widthM: null,
      slopePct: 0,
      toraM: null,
      todaM: null,
      asdaM: null,
      ldaM: null,
      threshold: { ...end, elevationFt: 500 },
    },
  ],
  weatherStation: null,
  contact: null,
  links: [],
  remarks: null,
  source: "test",
});
const pattern: TrafficPattern = trafficPatternSchema.parse({
  id: "test",
  airport,
  runway: { ...airport.runways[0], threshold, departureEnd: end },
  direction: "left",
  join: "downwind",
  altitudeAalFt: 1000,
  finalDistanceNm: 2,
  turnPerformance: { tasKt: 60 },
});
const middle = (
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  fraction = 0.5,
) => ({
  lat: a.lat + (b.lat - a.lat) * fraction,
  lon: a.lon + (b.lon - a.lon) * fraction,
});
const original = useInFlight.getState();

test.each(["left", "right"] as const)(
  "%s Overhead departure completes all four circuit turns before flying over the runway",
  (direction) => {
    const epkk = airportSchema.parse(airports.find((a) => a.ident === "EPKK"));
    const runway = epkk.runways.find((r) => r.designator === "25")!;
    const p: TrafficPattern = {
      ...pattern,
      airport: epkk,
      runway: { ...runway, ...patternRunwayGeometry(epkk, runway)! },
      direction,
      operation: "leave",
      join: "overhead",
      turnPerformance: { tasKt: 100 },
    };
    const next = { ident: "OUTBOUND", ...destinationPoint(epkk, 180, 5) };
    const g = trafficPatternGeometry(p);
    expect(g.points.slice(1).map((point) => [point.lat, point.lon])).toEqual(
      ["crosswind", "downwind", "base", "final", "overhead"].map((leg) => {
        const point = g.positions[leg as keyof typeof g.positions];
        return [point.lat, point.lon];
      }),
    );
    const overhead = g.points.at(-1)!;
    expect(overhead.flyOver).toBe(true);
    expect(distanceNm(overhead, p.runway.threshold)).toBeCloseTo(
      distanceNm(p.runway.threshold, p.runway.departureEnd) / 2,
      8,
    );
    expect(
      Math.abs(
        trackOffset(p.runway.threshold, p.runway.departureEnd, overhead)
          .crossTrackNm,
      ),
    ).toBeLessThan(0.000001);
    expect(
      g.points.slice(1).every((point) => point.altitudeFt === undefined),
    ).toBe(true);
    const route = routeWithTrafficPattern([epkk, next], p);
    const path = flyByRoute(route, { tasKt: 150 });
    expect(path.issues).toEqual([]);
    for (const index of [1, 2, 3, 4]) expect(path.turns.has(index)).toBe(true);
    expect(path.turns.has(5)).toBe(false);
    expect(
      path.points.some((point) => distanceNm(point, overhead) < 0.000001),
    ).toBe(true);
    expect(
      trackOffset(
        overhead,
        g.positions.crosswind,
        path.turns.get(6)!.points[0]!,
      ).alongTrackNm,
    ).toBeGreaterThan(0);
    expect(route.at(-1)).toEqual(next);
  },
);

test.each([0, 1, "direct", "edited"] as const)(
  "legacy Overhead departure upgrades its circuit while preserving progress (%s)",
  async (active) => {
    const p: TrafficPattern = {
      ...pattern,
      operation: "leave",
      join: "overhead",
    };
    const next = { ident: "NEXT", lat: 51, lon: 21 };
    const oldOverhead = {
      ...p.airport,
      ident: `TPD1/${p.airport.ident}`,
      patternId: p.id,
      patternOperation: "leave" as const,
      turnPerformance: p.turnPerformance,
    };
    const route = [
      active === "direct"
        ? { ident: "DCT", lat: 50.1, lon: 20.1 }
        : trafficPatternGeometry(p).points[0]!,
      oldOverhead,
      next,
    ];
    if (active === "edited")
      route.splice(1, 0, { ident: "MANUAL", lat: 50.1, lon: 20.1 });
    vi.stubGlobal("localStorage", {
      getItem: () =>
        JSON.stringify({
          version: 1,
          state: {
            startedAt: "2026-10-16T00:00:00Z",
            departurePattern: p,
            route,
            activeLeg: typeof active === "number" ? active : 0,
          },
        }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.resetModules();
    const { useInFlight: reloaded } = await import("~/stores/inflight");
    const state = reloaded.getState();
    if (typeof active !== "number") {
      expect(state.route).toEqual(route);
    } else {
      expect(state.route).toEqual(routeWithTrafficPattern([airport, next], p));
      expect(state.route[state.activeLeg + 1]?.ident).toBe(
        active === 0 ? `TPD1/${airport.ident}` : next.ident,
      );
      expect(flyByRoute(state.route, { tasKt: 100 }).issues).toEqual([]);
    }
  },
);

test.each(["left", "right"] as const)(
  "EPKK RW25 %s downwind exit stays smooth toward a fix south of the airport",
  (direction) => {
    const epkk = airportSchema.parse(airports.find((a) => a.ident === "EPKK"));
    const runway = epkk.runways.find((r) => r.designator === "25")!;
    const p: TrafficPattern = {
      ...pattern,
      airport: epkk,
      runway: { ...runway, ...patternRunwayGeometry(epkk, runway)! },
      operation: "leave",
      join: "downwind",
      direction,
      turnPerformance: { tasKt: 100 },
    };
    const next = { ident: "SOUTH", ...destinationPoint(epkk, 180, 3) };
    const g = trafficPatternGeometry(p);
    const old = [...g.points, next];
    if (direction === "right")
      expect(flyByRoute(old, { tasKt: 100 }).issues.length).toBeGreaterThan(0);
    const route = routeWithTrafficPattern([epkk, next], p);
    const path = flyByRoute(route, { tasKt: 150 });
    expect(path.issues).toEqual([]);
    expect(path.turns.has(g.points.length - 1)).toBe(true);
    expect(route.at(-1)).toEqual(next);
    expect(
      route.filter((point) => point.ident.startsWith("TPX")).length,
    ).toBeGreaterThan(0);
    expect([...path.turns.values()].every((turn) => turn.radiusNm > 0.53)).toBe(
      true,
    );
    // Selected leg must turn toward downwind rather than shortcutting back across crosswind.
    const downwindTurn = path.turns.get(g.points.length - 1)!;
    const signed = trackOffset(
      g.positions.crosswind,
      g.positions.downwind,
      downwindTurn.points.at(-1)!,
    ).crossTrackNm;
    expect(Math.sign(signed)).toBe(direction === "right" ? 1 : -1);
  },
);

test("departure exit handles an outbound fix behind the selected leg with two tangent guides", () => {
  const p: TrafficPattern = {
    ...pattern,
    operation: "leave",
    join: "crosswind",
    turnPerformance: { tasKt: 100 },
  };
  const g = trafficPatternGeometry(p);
  const next = {
    ident: "BEHIND",
    ...destinationPoint(g.positions.crosswind, 180, 3),
  };
  const route = routeWithTrafficPattern([airport, next], p);
  expect(route.filter((point) => point.ident.startsWith("TPX"))).toHaveLength(
    2,
  );
  expect(flyByRoute(route, { tasKt: 100 }).issues).toEqual([]);
});

test.each(["25", "07"])(
  "EPKK RW%s departure and Final follow the threshold axis despite stored headings",
  (designator) => {
    const epkk = airportSchema.parse(airports.find((a) => a.ident === "EPKK"));
    const runway = epkk.runways.find((r) => r.designator === designator)!;
    const geometry = patternRunwayGeometry(epkk, runway)!;
    // Parsing also exercises the persisted pattern shape with its original heading.
    const saved = trafficPatternSchema.parse({
      ...pattern,
      airport: epkk,
      runway: { ...runway, ...geometry },
      operation: "leave",
      join: "downwind",
      turnPerformance: { tasKt: 100 },
    });
    const g = trafficPatternGeometry(saved);
    const { threshold, departureEnd } = geometry;
    expect(
      Math.abs(
        trackOffset(threshold, g.positions.crosswind, departureEnd)
          .crossTrackNm,
      ),
    ).toBeLessThan(0.000001);
    expect(distanceNm(departureEnd, g.positions.crosswind)).toBeCloseTo(2, 8);
    expect(
      Math.abs(
        trackOffset(threshold, departureEnd, g.positions.final).crossTrackNm,
      ),
    ).toBeLessThan(0.000001);
    expect(
      trackOffset(threshold, departureEnd, g.positions.final).alongTrackNm,
    ).toBeCloseTo(-2, 7);
    // Rate-one smoothing must keep the initial straight on the runway axis and
    // start its first turn beyond the opposite threshold.
    const path = flyByRoute(g.points, { tasKt: 100 });
    const firstTurn = path.turns.get(1)!;
    expect(firstTurn).toBeDefined();
    const entry = firstTurn.points[0]!;
    const offset = trackOffset(threshold, departureEnd, entry);
    expect(Math.abs(offset.crossTrackNm)).toBeLessThan(0.0005);
    expect(offset.alongTrackNm).toBeGreaterThan(
      distanceNm(threshold, departureEnd),
    );
  },
);

test("saved departure gains smooth exit guides without losing its active target or restoring skipped pattern points", async () => {
  const p: TrafficPattern = {
    ...pattern,
    operation: "leave",
    join: "downwind",
    direction: "right",
    turnPerformance: { tasKt: 100 },
  };
  const g = trafficPatternGeometry(p);
  const next = { ident: "OUTBOUND", ...destinationPoint(airport, 0, 3) };
  let route = [...g.points, next];
  const storage = () =>
    JSON.stringify({
      version: 1,
      state: {
        startedAt: "2026-10-16T00:00:00Z",
        departurePattern: p,
        route,
        activeLeg: route.length - 2,
      },
    });
  vi.stubGlobal("localStorage", {
    getItem: storage,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.resetModules();
  const { useInFlight: reloaded } = await import("~/stores/inflight");
  const active = reloaded.getState();
  expect(
    active.route.filter((point) => point.ident.startsWith("TPX")).length,
  ).toBeGreaterThan(0);
  expect(active.route[active.activeLeg + 1]).toEqual(next);
  expect(flyByRoute(active.route, { tasKt: 100 }).issues).toEqual([]);
  active.goDirect(active.route.length - 1, { lat: 50.01, lon: 20.01 });
  route = reloaded.getState().route;
  vi.resetModules();
  const { useInFlight: directReload } = await import("~/stores/inflight");
  expect(directReload.getState().route).toEqual(route);
});

test("a degenerate threshold pair retains the stored heading fallback", () => {
  const g = trafficPatternGeometry({
    ...pattern,
    runway: { ...pattern.runway, departureEnd: threshold },
  });
  expect(
    distanceNm(g.positions.crosswind, destinationPoint(threshold, 90, 2)),
  ).toBeLessThan(0.000001);
});

test.each(["overhead", "crosswind", "downwind", "base", "final"] as const)(
  "%s arrival continues through the threshold to an off-axis ARP",
  (join) => {
    const p = {
      ...pattern,
      join,
      airport: { ...pattern.airport, lat: 50.003, lon: 20.004 },
    };
    const g = trafficPatternGeometry(p);
    expect(g.points.at(-1)).toMatchObject({
      ...p.airport,
      altitudeFt: p.airport.elevationFt,
    });
    expect(g.points.at(-2)).toMatchObject({
      ...threshold,
      ident: "EPAA THR09",
      flyOver: true,
    });
    const path = flyByRoute(g.points, { tasKt: 60 });
    expect(path.turns.has(g.points.length - 2)).toBe(false);
    expect(
      path.points.some((point) => distanceNm(point, threshold) < 0.000001),
    ).toBe(true);
  },
);

test("removing the active arrival continues from current position to ARP and preserves flight state", () => {
  const p = {
    ...pattern,
    airport: { ...pattern.airport, lat: 50.003, lon: 20.004 },
  };
  const g = trafficPatternGeometry(p);
  useInFlight
    .getState()
    .start([{ ident: "DCT", lat: 49, lon: 20 }, ...g.points], p);
  useInFlight.setState({ activeLeg: 1 });
  const before = useInFlight.getState();
  const position = middle(g.positions.downwind, g.positions.base);
  before.clearTrafficPattern("join", position);
  const after = useInFlight.getState();
  expect(after.route).toEqual([
    { ident: "DCT", ...position },
    { ...p.airport },
  ]);
  expect(after.activeLeg).toBe(0);
  expect(after.trafficPattern).toBeNull();
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.timers).toBe(before.timers);
  expect(after.track).toBe(before.track);
});

test("ARP endpoint remains selected after removing a pattern even with an arrival procedure in route text", () => {
  const destination = { ...airport, lat: 50.003, lon: 20.004 };
  const procedure = {
    airport: airport.ident,
    type: "APPROACH" as const,
    id: "TESTAPP",
    designator: "TESTAPP",
    runways: ["09"],
    source: "test",
    legs: [
      {
        ident: "FINAL",
        lat: 49.99,
        lon: 20,
        altitude: null,
        speedKt: null,
        trackMagDeg: null,
        distanceNm: null,
      },
    ],
  };
  const plan = buildRoutePlan(
    {
      airport: () => null,
      point: () => null,
      procedures: (_code, type) => (type === "APPROACH" ? [procedure] : []),
      airways: {},
    },
    {
      departure: { ...airport, ident: "EPBB", lat: 49 },
      destination,
      alternate: null,
      altitudeFt: 3000,
      routeText: "TESTAPP",
      arrivalToArp: true,
      selections: { SID: null, STAR: null, APPROACH: null },
      inlineSelections: {},
      insertedWaypoints: [],
      waypointAltitudes: {},
      waypointWx: {},
      conditionsWind: null,
      runwayWind: () => null,
      climbGradientFtPerNm: 500,
    },
  )!;
  const points = plan.points.filter((point) => !point.isProfilePoint);
  expect(points.at(-1)).toMatchObject({
    id: airport.ident,
    lat: destination.lat,
    lon: destination.lon,
  });
  expect(points.at(-2)).toMatchObject({
    kind: "threshold",
    lat: threshold.lat,
    lon: threshold.lon,
    flyOver: true,
  });
});

test("legacy saved arrivals acquire the threshold before ARP without restoring skipped Direct-to points", async () => {
  const p = {
    ...pattern,
    airport: { ...pattern.airport, lat: 50.003, lon: 20.004 },
  };
  const g = trafficPatternGeometry(p);
  const route = [
    { ident: "DCT", lat: 49, lon: 20 },
    ...g.points
      .filter((point) => !point.flyOver)
      .map((point) =>
        point.ident === p.airport.ident ? { ...point, ...threshold } : point,
      ),
  ];
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        version: 1,
        state: {
          startedAt: "2026-10-16T00:00:00Z",
          trafficPattern: p,
          route,
          activeLeg: 1,
        },
      }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.resetModules();
  const { useInFlight: reloaded } = await import("~/stores/inflight");
  expect(reloaded.getState().route).toEqual([route[0], ...g.points]);
  expect(reloaded.getState().activeLeg).toBe(1);
  reloaded
    .getState()
    .goDirect(reloaded.getState().route.length - 1, { lat: 49.9, lon: 20.1 });
  const direct = reloaded.getState().route;
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        version: 1,
        state: {
          startedAt: "2026-10-16T00:00:00Z",
          trafficPattern: p,
          route: direct,
          activeLeg: 0,
        },
      }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.resetModules();
  const { useInFlight: directReload } = await import("~/stores/inflight");
  expect(directReload.getState().route).toEqual(direct);
});

test.each(["overhead", "crosswind", "downwind", "base", "final"] as const)(
  "departure leaves at the start of %s and continues outbound",
  (join) => {
    const departure = {
      ...pattern,
      id: "departure",
      operation: "leave" as const,
      join,
    };
    const g = trafficPatternGeometry(departure);
    expect(distanceNm(g.points[0]!, threshold)).toBeLessThan(0.000001);
    expect(distanceNm(g.points.at(-1)!, g.positions[join])).toBeLessThan(
      0.000001,
    );
    expect(g.points.slice(1).every((p) => p.altitudeFt === undefined)).toBe(
      true,
    );
    const next = { ident: "NEXT", lat: 51, lon: 21 };
    const arrival = {
      ...pattern,
      id: "arrival",
      airport: { ...pattern.airport, ident: "EPBB" },
    };
    const route = routeWithTrafficPattern(
      [airport, next, { ...airport, ident: "EPBB" }],
      arrival,
    );
    const amended = routeWithTrafficPattern(route, departure);
    expect(amended.slice(0, g.points.length)).toEqual(g.points);
    expect(amended.find((point) => point.ident === next.ident)).toEqual(next);
    expect(amended.at(-1)?.patternId).toBe("arrival");
    expect(
      trafficPatternReport(departure, amended, 1, g.positions[join], null, []),
    ).toBeNull();
    useInFlight.getState().start(route, arrival);
    useInFlight.getState().joinTrafficPattern(departure);
    expect(useInFlight.getState().activeLeg).toBe(0);
    expect(useInFlight.getState().trafficPattern).toEqual(arrival);
    useInFlight.getState().clearTrafficPattern("leave");
    expect(useInFlight.getState().route[0]).toMatchObject({
      ident: airport.ident,
      lat: airport.lat,
      lon: airport.lon,
    });
    expect(useInFlight.getState().route.slice(1)).toEqual(route.slice(1));
    useInFlight.getState().start(amended, arrival, departure);
    useInFlight.getState().goToPoint(next, { lat: 50.8, lon: 20.8 });
    const direct = useInFlight.getState().route;
    useInFlight.getState().clearTrafficPattern("leave");
    expect(useInFlight.getState().route).toEqual(direct);
  },
);

test.each([
  ["base", null],
  ["base", 1800],
  ["overhead", null],
  ["overhead", 1800],
] as const)(
  "departure via %s climbs toward the next restriction (%s) or cruise",
  (join, limit) => {
    const departure = {
      ...pattern,
      operation: "leave" as const,
      join,
    };
    const destination = { ...airport, ident: "EPBB", lat: 51 };
    const plan = buildRoutePlan(
      {
        airport: () => null,
        point: () => ({ lat: 50.5, lon: 20 }),
        procedures: () => [],
        airways: {},
      },
      {
        departure: airport,
        destination,
        alternate: null,
        altitudeFt: 6000,
        routeText: "NEXT",
        selections: { SID: null, STAR: null, APPROACH: null },
        inlineSelections: {},
        insertedWaypoints: [],
        departurePattern: departure,
        pointRestrictions:
          limit === null
            ? {}
            : {
                NEXT: { altitudeFt: limit, altitudeMode: "at", speedKt: null },
              },
        waypointAltitudes: {},
        waypointWx: {},
        conditionsWind: null,
        runwayWind: () => null,
        climbGradientFtPerNm: 500,
      },
    )!;
    const circuit = plan.points.filter((p) => p.patternOperation === "leave");
    expect(circuit[0]?.runwayId).toBe("09");
    const lastAltitude = plan.pointAltitudeByKey[pointKey(circuit.at(-1))]!;
    expect(lastAltitude).toBeGreaterThan(1500);
    expect(lastAltitude).toBeLessThanOrEqual(limit ?? 6000);
    expect(circuit.every((p) => p.patternAltitudeFt === undefined)).toBe(true);
    if (join === "overhead")
      expect(
        circuit.find((point) => point.id === `TPD5/${airport.ident}`)?.flyOver,
      ).toBe(true);
    const flight = { ...newFlight(), departurePattern: departure };
    expect(
      parseNordFile(toNordFile(flight, null), []).flight.departurePattern,
    ).toEqual(departure);
  },
);

test("latest Take-off/Taxi-out runway choice wins; manual circuit runway stays selected", () => {
  const ground: Ground = {
    airport: airport.ident,
    elements: [{ id: "HP27", label: "HP27", type: "holdingPoint" }],
    connections: {},
    standExits: {},
  };
  const flight = {
    ...newFlight(),
    departure: airport,
    departurePattern: {
      ...pattern,
      operation: "leave" as const,
      runwayAutomatic: true,
    },
  };
  expect(taxiDepartureRunway(airport, ground, "HP27")?.designator).toBe("27");
  flight.taxiInputs[`departure|${airport.ident}`] = { from: null, to: "HP27" };
  expect(departureRunwayChoice(flight, airport, ground)?.source).toBe("taxi");
  flight.departureRunway = {
    airport: airport.ident,
    designator: "09",
    source: "takeoff",
  };
  expect(
    resolvedDeparturePattern(flight, airport, ground)?.runway.designator,
  ).toBe("09");
  flight.departureRunway = {
    airport: airport.ident,
    designator: "27",
    source: "taxi",
  };
  expect(
    resolvedDeparturePattern(flight, airport, ground)?.runway.designator,
  ).toBe("27");
  flight.departurePattern.runwayAutomatic = false;
  expect(
    resolvedDeparturePattern(flight, airport, ground)?.runway.designator,
  ).toBe("09");
});
afterEach(() => {
  useInFlight.setState(original, true);
  vi.unstubAllGlobals();
});

test("slow left and right patterns retain the 0.75 NM minimum and 2 NM threshold extensions", () => {
  for (const direction of ["left", "right"] as const) {
    const g = trafficPatternGeometry({ ...pattern, direction });
    expect(distanceNm(end, g.positions.crosswind)).toBeCloseTo(2, 8);
    expect(distanceNm(g.positions.crosswind, g.positions.downwind)).toBeCloseTo(
      0.75,
      8,
    );
    expect(distanceNm(threshold, g.positions.final)).toBeCloseTo(2, 8);
    expect(distanceNm(g.positions.final, g.positions.base)).toBeCloseTo(
      0.75,
      8,
    );
    expect(g.positions.downwind.lat > g.positions.crosswind.lat).toBe(
      direction === "left",
    );
    expect(g.points[0]).toMatchObject(g.positions.downwind);
    expect(g.points[0]?.altitudeFt).toBe(1500);
    expect(g.points.at(-1)?.altitudeFt).toBe(500);
  }
});

test.each(["left", "right"] as const)(
  "%s circuit widens and joins Base/Final arcs into a semicircle",
  (direction) => {
    const g = trafficPatternGeometry({
      ...pattern,
      direction,
      turnPerformance: { tasKt: 100 },
    });
    expect(g.lateralOffsetNm).toBeGreaterThan(1.06);
    expect(g.lateralOffsetNm).toBeLessThan(1.063);
    const path = flyByRoute(g.points, { tasKt: 170 });
    expect(path.issues).toEqual([]);
    const base = path.turns.get(1)!;
    const final = path.turns.get(2)!;
    expect(base.radiusNm).toBeCloseTo(100 / (60 * Math.PI), 8);
    expect(final.radiusNm).toBeCloseTo(base.radiusNm, 8);
    expect(distanceNm(base.points.at(-1)!, final.points[0]!)).toBeLessThan(
      0.0005,
    );
    expect(base.durationSeconds + final.durationSeconds).toBeCloseTo(60, 1);
    for (let i = 1; i < path.points.length; i++)
      expect(distanceNm(path.points[i - 1]!, path.points[i]!)).toBeGreaterThan(
        0.005,
      );
  },
);

test("navigation follows the circuit speed even with a different cruise speed", () => {
  const g = trafficPatternGeometry({
    ...pattern,
    turnPerformance: { tasKt: 100 },
  });
  const route = [{ ident: "START", lat: 49, lon: 20 }, ...g.points];
  const index = route.length - 3;
  const turn = flyByRoute(route, { tasKt: 180 }).turns.get(index)!;
  const progress = computeProgress(route, turn.points[10]!, index - 1, {
    tasKt: 180,
  })!;
  expect(progress.activeLeg).toBe(index);
  expect(Math.abs(progress.crossTrackNm)).toBeLessThan(0.001);
});

test.each([0, 90, 180, 270])(
  "circuit widens for 20 kt wind from %s degrees",
  (windDirectionDeg) => {
    const g = trafficPatternGeometry({
      ...pattern,
      join: "overhead",
      turnPerformance: { tasKt: 100, windDirectionDeg, windSpeedKt: 20 },
    });
    expect(g.lateralOffsetNm).toBeGreaterThan(0.75);
    const path = flyByRoute(g.points, { tasKt: 170 });
    expect(path.issues).toEqual([]);
    expect(path.turns.size).toBe(4);
  },
);
test.each(["overhead", "crosswind", "downwind", "base", "final"] as const)(
  "%s joins at the start of the selected leg",
  (join) => {
    const g = trafficPatternGeometry({ ...pattern, join });
    expect(distanceNm(g.points[0]!, g.positions[join])).toBeLessThan(0.000001);
    if (join === "overhead")
      expect(g.points[1]).toMatchObject(g.positions.crosswind);
  },
);
test.each([8, 4, 2, 5.3])(
  "Final at %s NM is measured from the selected threshold",
  (finalDistanceNm) => {
    const g = trafficPatternGeometry({
      ...pattern,
      join: "final",
      finalDistanceNm,
    });
    expect(g.points).toHaveLength(2);
    expect(distanceNm(threshold, g.points[0]!)).toBeCloseTo(finalDistanceNm, 8);
  },
);
test("published thresholds are preserved and missing threshold estimates are identified", () => {
  expect(
    patternRunwayGeometry(airport, airport.runways[0]!)?.threshold,
  ).toEqual(threshold);
  const missing = {
    ...airport,
    runways: airport.runways.map((r) => ({ ...r, threshold: null })),
  };
  expect(patternRunwayGeometry(missing, missing.runways[0]!)?.estimated).toBe(
    true,
  );
  expect(
    patternRunwayGeometry(
      { ...missing, runways: [] },
      { ...missing.runways[0]!, lengthM: null },
    ),
  ).toBeNull();
});
test("ATIS runway has priority over wind; unconfirmed community ATIS does not", () => {
  const report = atisSchema.parse({
    kind: "arrival",
    letter: "A",
    received_at: null,
    age_minutes: 0,
    stale: false,
    qnh_hpa: null,
    qnh_matches_metar: null,
    text: "LANDING RUNWAY 27",
    source: "community",
    verified: false,
    confirmation_count: 1,
  });
  const wind = "EPAA 151200Z 09010KT 9999 SKC 15/10 Q1013";
  expect(
    patternRunwaySuggestion(airport, "", [report], wind).runway?.designator,
  ).toBe("09");
  expect(
    patternRunwaySuggestion(
      airport,
      "",
      [{ ...report, verified: true, confirmation_count: 2 }],
      wind,
    ).runway?.designator,
  ).toBe("27");
  expect(patternRunwaySuggestion(airport, "RWY 27", [], wind).source).toBe(
    "atis",
  );
  expect(
    patternRunwaySuggestion(airport, "RWY 27", [], wind).runway?.designator,
  ).toBe("27");
  expect(
    patternRunwaySuggestion(airport, "", [], null, "270/10KT").runway
      ?.designator,
  ).toBe("27");
  expect(patternRunwaySuggestion(airport, "", [], null).source).toBe(
    "fallback",
  );
});
test("route replacement retains preceding fixes and includes the pattern in the FPL profile and export", () => {
  const departure = { ...airport, ident: "EPBB", lat: 49.5 };
  const route = routeWithTrafficPattern(
    [departure, { ident: "MID", lat: 49.7, lon: 20 }, airport],
    pattern,
  );
  expect(route.slice(0, 2).map((p) => p.ident)).toEqual(["EPBB", "MID"]);
  expect(route.at(-1)).toMatchObject(threshold);
  const plan = buildRoutePlan(
    {
      airport: () => null,
      point: () => null,
      procedures: () => [],
      airways: {},
    },
    {
      departure,
      destination: airport,
      alternate: null,
      altitudeFt: 3000,
      routeText: "",
      selections: { SID: null, STAR: null, APPROACH: null },
      inlineSelections: {},
      insertedWaypoints: [],
      trafficPattern: pattern,
      waypointAltitudes: {},
      waypointWx: {},
      conditionsWind: null,
      runwayWind: () => null,
      climbGradientFtPerNm: 500,
    },
  );
  const fixes = plan!.points.filter((p) => p.patternId);
  expect(fixes).toHaveLength(4);
  expect(plan!.pointAltitudeByKey[pointKey(fixes[0])]).toBe(1500);
  const flight = {
    ...newFlight(),
    departure,
    destination: airport,
    trafficPattern: pattern,
  };
  expect(
    parseNordFile(toNordFile(flight, null), []).flight.trafficPattern,
  ).toEqual(pattern);
  expect(
    flightSchema.parse({ ...newFlight(), trafficPattern: undefined })
      .trafficPattern,
  ).toBeNull();
});
test("downwind reports at its midpoint once; Base only reports on a direct Base join", () => {
  const g = trafficPatternGeometry(pattern);
  const route = [{ ident: "DCT", lat: 49, lon: 20 }, ...g.points];
  const at = middle(g.positions.downwind, g.positions.base);
  expect(trafficPatternReport(pattern, route, 1, at, null, [])).toBe(
    "downwind",
  );
  expect(
    trafficPatternReport(pattern, route, 1, at, null, ["downwind"]),
  ).toBeNull();
  expect(
    trafficPatternReport(
      pattern,
      route,
      1,
      { ...at, lat: at.lat + 1 },
      null,
      [],
    ),
  ).toBeNull();
  const basePattern = { ...pattern, join: "base" as const };
  const bg = trafficPatternGeometry(basePattern);
  const baseRoute = [{ ident: "DCT", lat: 49, lon: 20 }, ...bg.points];
  const baseMid = middle(bg.positions.base, bg.positions.final);
  expect(
    trafficPatternReport(basePattern, baseRoute, 1, baseMid, null, []),
  ).toBe("base");
  expect(trafficPatternReport(pattern, route, 2, baseMid, null, [])).toBeNull();
  // Fly-by can start the Final turn before the Base midpoint; its report remains eligible.
  const active = computeProgress(baseRoute, baseMid, 1)!.activeLeg;
  expect(
    trafficPatternReport(basePattern, baseRoute, active, baseMid, null, []),
  ).toBe("base");
});
test.each([
  [8, "longFinal"],
  [4, "final"],
  [2, "shortFinal"],
  [5.3, "final"],
] as const)(
  "%s NM Final reports %s at leg start",
  (finalDistanceNm, expected) => {
    const p = { ...pattern, join: "final" as const, finalDistanceNm };
    const g = trafficPatternGeometry(p);
    expect(
      trafficPatternReport(
        p,
        [{ ident: "DCT", lat: 49, lon: 20 }, ...g.points],
        0,
        g.positions.final,
        null,
        [],
      ),
    ).toBe(expected);
  },
);
test("joining an active flight retains timers/track and remembers reports without persisting the popup", async () => {
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem,
    removeItem: vi.fn(),
  });
  vi.resetModules();
  const { useInFlight: persisted } = await import("~/stores/inflight");
  const s = persisted.getState();
  s.start([{ ident: "START", lat: 49, lon: 20 }, airport]);
  const before = persisted.getState();
  s.joinTrafficPattern(pattern, { lat: 49, lon: 20 });
  persisted.setState({ activeLeg: 1 });
  const g = trafficPatternGeometry(pattern);
  const at = middle(g.positions.downwind, g.positions.base);
  s.observePattern({ ...at, time: "2026-10-15T12:00:00Z" });
  const after = persisted.getState();
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.timers).toBe(before.timers);
  expect(after.track).toBe(before.track);
  expect(after.patternNotice?.report).toBe("downwind");
  s.dismissPatternNotice();
  s.observePattern({ ...at, time: "2026-10-15T12:00:01Z" });
  expect(persisted.getState().patternNotice).toBeNull();
  expect(persisted.getState().patternReports).toEqual(["downwind"]);
  expect(setItem).toHaveBeenCalled();
  s.clearTrafficPattern();
  expect(persisted.getState().route.map((p) => p.ident)).toEqual([
    "DCT",
    "EPAA",
  ]);
});

test("rehydration refreshes saved pattern geometry without resetting flight progress", async () => {
  const g = trafficPatternGeometry(pattern);
  const oldSide = destinationPoint(
    g.positions.crosswind,
    pattern.runway.trueHeadingDeg - 90,
    1000 / 1852,
  );
  const savedRoute = [
    { ident: "DCT", lat: 49, lon: 20 },
    ...g.points.map((p, i) => (i === 0 ? { ...p, ...oldSide } : p)),
  ];
  const startedAt = "2026-10-15T12:00:00Z";
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        version: 1,
        state: {
          startedAt,
          route: savedRoute,
          trafficPattern: pattern,
          patternReports: ["downwind"],
          activeLeg: 1,
          phase: "cruise",
        },
      }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.resetModules();
  const { useInFlight: reloaded } = await import("~/stores/inflight");
  const state = reloaded.getState();
  expect(state.route).toEqual([savedRoute[0], ...g.points]);
  expect(state.startedAt).toBe(startedAt);
  expect(state.activeLeg).toBe(1);
  expect(state.phase).toBe("cruise");
  expect(state.patternReports).toEqual(["downwind"]);
});

test("pattern entry retains the last arrival fix in planned and active routes", () => {
  const departure = { ident: "DEPARTURE", lat: 49, lon: 20 };
  const lastFix = { ident: "EPAAD", lat: 49.9, lon: 20.1 };
  const route = [departure, lastFix, airport];
  const expected = [
    departure,
    lastFix,
    ...trafficPatternGeometry(pattern).points,
  ];
  expect(routeWithTrafficPattern(route, pattern)).toEqual(expected);
  const active = activeRouteWithTrafficPattern(route, 0, pattern, departure);
  expect(active).toEqual({ route: expected, activeLeg: 0 });
  useInFlight.getState().start(route);
  const before = useInFlight.getState();
  before.joinTrafficPattern(pattern, departure);
  expect(useInFlight.getState().route).toEqual(expected);
  expect(useInFlight.getState().startedAt).toEqual(before.startedAt);
  expect(useInFlight.getState().timers).toBe(before.timers);
  // A direct to a reporting fix keeps that fix before the pattern.
  expect(
    activeRouteWithTrafficPattern(
      [{ ...departure, ident: "DCT" }, lastFix, airport],
      0,
      pattern,
      departure,
    ).route[1],
  ).toEqual(lastFix);
});

test("already direct to the airport goes directly to entry, without restoring passed fixes", () => {
  const departure = { ident: "DEPARTURE", lat: 49, lon: 20 };
  const lastFix = { ident: "EPAAD", lat: 49.9, lon: 20.1 };
  const position = { lat: 49.95, lon: 20.15 };
  const expected = [
    { ident: "DCT", ...position },
    ...trafficPatternGeometry(pattern).points,
  ];
  expect(
    activeRouteWithTrafficPattern(
      [departure, lastFix, airport],
      1,
      pattern,
      position,
    ),
  ).toEqual({ route: expected, activeLeg: 0 });
  expect(
    activeRouteWithTrafficPattern(
      [{ ...departure, ident: "DCT" }, airport],
      0,
      pattern,
      position,
    ).route,
  ).toEqual(expected);
  const old = trafficPatternGeometry({ ...pattern, join: "base" }).points;
  expect(
    activeRouteWithTrafficPattern(
      [{ ...departure, ident: "DCT" }, ...old],
      0,
      pattern,
      position,
    ).route,
  ).toEqual(expected);
});

test("Final report follows the fly-by tangent exit instead of requiring passage over its virtual corner", () => {
  const route = [
    { ident: "DCT", lat: 49, lon: 20 },
    ...trafficPatternGeometry(pattern).points,
  ];
  const performance = { tasKt: 60 };
  const finalIndex = route.length - 2;
  const turn = flyByRoute(route, performance).turns.get(finalIndex)!;
  expect(turn).toBeDefined();
  const exit = turn.points.at(-1)!;
  expect(distanceNm(exit, route[finalIndex]!)).toBeGreaterThan(0.1);
  expect(
    trafficPatternReport(
      pattern,
      route,
      finalIndex,
      exit,
      null,
      [],
      performance,
    ),
  ).toBe("shortFinal");
});

test("without GPS, pattern acceptance retains the remaining route and its active leg", () => {
  const a = { ident: "START", lat: 49, lon: 20 };
  const b = { ident: "MID", lat: 49.5, lon: 20 };
  const last = { ident: "EPAAD", lat: 49.9, lon: 20.1 };
  const route = [a, b, last, airport];
  const expected = [a, b, last, ...trafficPatternGeometry(pattern).points];
  expect(activeRouteWithTrafficPattern(route, 1, pattern)).toEqual({
    route: expected,
    activeLeg: 1,
  });
  useInFlight.getState().start(route);
  useInFlight.setState({ activeLeg: 1 });
  const before = useInFlight.getState();
  before.joinTrafficPattern(pattern);
  const after = useInFlight.getState();
  expect(after.route).toEqual(expected);
  expect(after.activeLeg).toBe(1);
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.timers).toBe(before.timers);
});

test("without any GPS history, an airport direct retains its existing origin and a changed pattern restarts at entry", () => {
  const origin = { ident: "DCT", lat: 49.9, lon: 20.1 };
  const points = trafficPatternGeometry(pattern).points;
  expect(
    activeRouteWithTrafficPattern([origin, airport], 0, pattern, null),
  ).toEqual({ route: [origin, ...points], activeLeg: 0 });
  expect(
    activeRouteWithTrafficPattern(
      [origin, ...points],
      2,
      { ...pattern, join: "base" },
      null,
    ).activeLeg,
  ).toBe(0);
});

test("without a live fix, a stored track position anchors DCT without clearing the recorded flight", () => {
  const origin = { ident: "DCT", lat: 49, lon: 20 };
  const recorded = {
    lat: 49.9,
    lon: 20.2,
    altitudeFt: 3000,
    time: "2026-10-15T12:00:00Z",
  };
  useInFlight.getState().start([origin, airport]);
  useInFlight.setState({ track: [recorded], phase: "cruise" });
  const before = useInFlight.getState();
  before.joinTrafficPattern(pattern);
  const after = useInFlight.getState();
  expect(after.route[0]).toEqual({
    ident: "DCT",
    lat: recorded.lat,
    lon: recorded.lon,
  });
  expect(after.route.slice(1)).toEqual(trafficPatternGeometry(pattern).points);
  expect(after.track).toBe(before.track);
  expect(after.timers).toBe(before.timers);
  expect(after.startedAt).toBe(before.startedAt);
  expect(after.phase).toBe("cruise");
});
