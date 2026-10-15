import { afterEach, expect, test, vi } from "vitest";
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
import { distanceNm, destinationPoint } from "./geo";
import { buildRoutePlan, pointKey } from "./route-plan";
import { computeProgress } from "./progress";
import { useInFlight } from "~/stores/inflight";
import { flyByRoute } from "./fly-by";

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
afterEach(() => {
  useInFlight.setState(original, true);
  vi.unstubAllGlobals();
});

test("left and right patterns use exactly 0.75 NM lateral spacing and 2 NM threshold extensions", () => {
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
