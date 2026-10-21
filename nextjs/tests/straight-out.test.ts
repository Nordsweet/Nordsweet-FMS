import { expect, test } from "vitest";
import { airportSchema } from "~/data/schemas";
import airports from "../public/data/airports.json";
import { trafficPatternSchema } from "~/data/traffic-pattern";
import {
  patternRunwayGeometry,
  trafficPatternGeometry,
  routeWithTrafficPattern,
} from "~/domain/traffic-pattern";
import {
  destinationPoint,
  distanceNm,
  trackOffset,
  initialBearingDeg,
} from "~/domain/geo";
import { flyByRoute } from "~/domain/fly-by";

const airport = airportSchema.parse(airports.find((a) => a.ident === "EPKK"));
const runway = airport.runways.find((r) => r.designator === "25")!;
const base = trafficPatternSchema.parse({
  id: "straight-out",
  operation: "leave",
  airport,
  runway: { ...runway, ...patternRunwayGeometry(airport, runway) },
  direction: "left",
  join: "final",
  altitudeAalFt: 1000,
  finalDistanceNm: 8,
});

test.each(["left", "right"] as const)(
  "Straight-out %s leaves on the axis before the first turn and never flies the circuit",
  (direction) => {
    for (const tasKt of [72, 100, 120]) {
      const pattern = { ...base, direction, turnPerformance: { tasKt } };
      const geometry = trafficPatternGeometry(pattern);
      expect(geometry.points).toHaveLength(2);
      const exit = geometry.points[1]!;
      const offset = trackOffset(
        pattern.runway.threshold,
        pattern.runway.departureEnd,
        exit,
      );
      const length = distanceNm(
        pattern.runway.threshold,
        pattern.runway.departureEnd,
      );
      expect(Math.abs(offset.crossTrackNm)).toBeLessThan(0.00001);
      expect(offset.alongTrackNm).toBeGreaterThan(length);
      expect(offset.alongTrackNm).toBeLessThan(length + 2);
      const turn = flyByRoute(
        [
          pattern.runway.threshold,
          geometry.positions.crosswind,
          geometry.positions.downwind,
        ],
        pattern.turnPerformance,
      ).candidates.get(1)!;
      expect(distanceNm(exit, geometry.positions.crosswind)).toBeCloseTo(
        turn.entryNm,
        4,
      );
      expect(exit.patternOperation).toBe("leave");
    }
  },
);

test.each(["left", "right"] as const)(
  "Straight-out %s connects smoothly to an outbound fix ahead, abeam or behind",
  (direction) => {
    const pattern = { ...base, direction, turnPerformance: { tasKt: 100 } };
    const h = initialBearingDeg(
      pattern.runway.threshold,
      pattern.runway.departureEnd,
    );
    for (const bearing of [h, h - 90, h + 90, h + 180]) {
      const outbound = {
        ident: "OUT",
        ...destinationPoint(pattern.airport, bearing, 15),
      };
      const route = routeWithTrafficPattern(
        [pattern.airport, outbound],
        pattern,
      );
      expect(route.at(-1)).toBe(outbound);
      expect(route.filter((p) => p.ident.startsWith("TPD"))).toHaveLength(1);
      expect(flyByRoute(route, pattern.turnPerformance).issues).toEqual([]);
      expect(flyByRoute(route, pattern.turnPerformance).turns.has(1)).toBe(
        false,
      );
    }
  },
);

test("arrival Final still starts behind the threshold at the selected final distance", () => {
  const arrival = { ...base, operation: "join" as const };
  const geometry = trafficPatternGeometry(arrival);
  expect(distanceNm(arrival.runway.threshold, geometry.points[0]!)).toBeCloseTo(
    8,
    5,
  );
  expect(geometry.points[0]?.patternOperation).toBe("join");
  expect(geometry.points.at(-1)?.ident).toBe(airport.ident);
});
