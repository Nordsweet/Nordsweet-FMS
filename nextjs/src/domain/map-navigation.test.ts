import { expect, test } from "vitest";
import { distanceNm } from "./geo";
import {
  airspaceAltitudeFt,
  trafficAlertLevel,
  nearestRouteSegment,
  nextWaypointIdent,
  polygonContainsPoint,
  positionAgeAlpha,
  projectedPosition,
  routeCrossesPolygon,
} from "./map-navigation";
import {
  appendTrafficSample,
  currentCallsignHistory,
  trafficCallsign,
  trafficTrailSegments,
} from "./traffic-history";

test("traffic and ownship fade only after a minute and disappear at two minutes", () => {
  expect([0, 60000, 90000, 120000, 130000].map(positionAgeAlpha)).toEqual([
    1, 1, 0.5, 0, 0,
  ]);
  const time = "2026-10-13T10:00:00Z",
    start = { lat: 50, lon: 19 };
  const projected = projectedPosition(
    start,
    time,
    120,
    90,
    Date.parse(time) + 30000,
  )!;
  expect(distanceNm(start, projected)).toBeCloseTo(1, 6);
  expect(
    projectedPosition(start, time, 120, 90, Date.parse(time) + 120000),
  ).toBeNull();
  expect(projectedPosition(start, "bad", 120, 90, Date.now())).toBeNull();
});

test("polygon holes, boundaries and a crossing with neither endpoint inside", () => {
  const outer = [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
    hole = [
      [1, 1],
      [3, 1],
      [3, 3],
      [1, 3],
      [1, 1],
    ];
  expect(polygonContainsPoint([outer, hole], { lat: 2, lon: 2 })).toBe(false);
  expect(polygonContainsPoint([outer], { lat: 0, lon: 2 })).toBe(true);
  expect(
    routeCrossesPolygon(
      [
        { lat: 2, lon: -1 },
        { lat: 2, lon: 5 },
      ],
      [outer],
    ),
  ).toBe(true);
  expect(
    routeCrossesPolygon(
      [
        { lat: 2, lon: 1.5 },
        { lat: 2, lon: 2.5 },
      ],
      [outer, hole],
    ),
  ).toBe(false);
});

test("snapped waypoints remain on a selected route leg and numbering has no collision", () => {
  const route = [
    { ident: "A", lat: 50, lon: 19 },
    { ident: "WPT 3", lat: 51, lon: 19 },
    { ident: "C", lat: 51, lon: 20 },
  ];
  const snapped = nearestRouteSegment(route, { lat: 50.5, lon: 19.01 })!;
  expect(snapped.index).toBe(0);
  expect(snapped.fraction).toBeCloseTo(0.5, 3);
  expect(snapped.point.lon).toBeCloseTo(19, 8);
  expect(nextWaypointIdent(route)).toBe("WPT 4");
});

test("no previous callsign flight is joined to a newly selected airframe", () => {
  const sample = (sampledAt: number, callsign: string) => ({
    lat: 50,
    lon: 19,
    sampledAt,
    callsign,
  });
  const remote = [
    sample(1, "OLD"),
    sample(2, "NEW"),
    sample(3, "OLD"),
    sample(4, "NEW"),
  ];
  const local = [sample(4, "NEW"), sample(5, "NEW")];
  expect(
    currentCallsignHistory(remote, local, "new").map((p) => p.sampledAt),
  ).toEqual([4, 5]);
  // A temporarily missing live callsign falls back to the last confirmed flight.
  expect(
    currentCallsignHistory(remote, local, null).map((p) => p.sampledAt),
  ).toEqual([4, 5]);
  expect(appendTrafficSample(local, sample(4, "NEW"))).toEqual(local);
});

test("published limits use legacy units; A055 follows the collector contract", () => {
  expect(
    ["GND", "FL095", "A055", "2000ft AMSL", "600 M", "UNL"].map(
      airspaceAltitudeFt,
      trafficAlertLevel,
    ),
  ).toEqual([0, 9500, 5500, 2000, 1968.504, Infinity]);
});

test("CPA colours preserve legacy time and vertical boundaries", () => {
  const own = { lat: 0, lon: 0, altitudeFt: 3000, speedKt: 0, trackDeg: 0 };
  const target = (seconds: number, vertical: number) => ({
    lat: 0,
    lon: seconds / 3600,
    altitudeFt: 3000 + vertical,
    speedKt: 60,
    trackDeg: 270,
  });
  expect(trafficAlertLevel(own, target(30, 200))).toBe("red");
  expect(trafficAlertLevel(own, target(40, 500))).toBe("amber");
  expect(trafficAlertLevel(own, target(250, 1000))).toBe("caution");
  expect(trafficAlertLevel(own, target(301, 0))).toBe("normal");
  expect(trafficAlertLevel(own, target(-30, 0))).toBe("normal");
});

test("confirmed trails split at missing observations and suppress provider identifiers", () => {
  const points = [0, 1000, 400000, 401000].map((sampledAt) => ({
    lat: 50,
    lon: 19,
    sampledAt,
    callsign: "ABC",
  }));
  expect(trafficTrailSegments(points).map((group) => group.length)).toEqual([
    2, 2,
  ]);
  expect(trafficCallsign(" ICA123ABC ")).toBe("");
  expect(trafficCallsign(" WMT7003 ")).toBe("WMT7003");
});
