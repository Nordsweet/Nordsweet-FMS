import { type TrafficPattern } from "~/data/traffic-pattern";
import { type Airport, type Runway } from "~/data/schemas";
import { type NavPoint } from "./progress";
import { destinationPoint, distanceNm, trackOffset, type LatLon } from "./geo";
import { angleDiffDeg } from "./angles";
import { flyByRoute, type TurnPerformance } from "./fly-by";
import { patternPlanningPerformance } from "./pattern-performance";

/** Use published thresholds where available; otherwise estimate from runway length and ARP. */
export function patternRunwayGeometry(airport: Airport, runway: Runway) {
  const designator = /^(\d{1,2})([LRC]?)$/i.exec(runway.designator);
  const reciprocal = designator
    ? String(((Number(designator[1]) + 17) % 36) + 1).padStart(2, "0") +
      ({ L: "R", R: "L", C: "C" }[
        designator[2]!.toUpperCase() as "L" | "R" | "C"
      ] ?? "")
    : null;
  const opposite =
    airport.runways.find((r) => r.designator.toUpperCase() === reciprocal) ??
    airport.runways.find(
      (r) =>
        Math.abs(angleDiffDeg(r.trueHeadingDeg, runway.trueHeadingDeg + 180)) <
        10,
    );
  const length =
    (runway.lengthM ?? runway.ldaM ?? opposite?.lengthM ?? 0) / 1852;
  if (!runway.threshold && !length) return null;
  const threshold = runway.threshold ?? {
    ...destinationPoint(
      opposite?.threshold ?? airport,
      runway.trueHeadingDeg + 180,
      opposite?.threshold ? length : length / 2,
    ),
    elevationFt: airport.elevationFt,
  };
  const departureEnd =
    opposite?.threshold ??
    (length
      ? destinationPoint(threshold, runway.trueHeadingDeg, length)
      : null);
  return departureEnd
    ? {
        threshold,
        departureEnd,
        estimated: !runway.threshold || !opposite?.threshold,
      }
    : null;
}

/** Keep a minimum 0.75 NM lateral offset and widen until adjacent rate-one arcs fit. */
export function trafficPatternGeometry(pattern: TrafficPattern) {
  const turnPerformance =
    pattern.turnPerformance ??
    patternPlanningPerformance(
      pattern.speedKias ?? 100,
      pattern.airport.elevationFt,
      pattern.altitudeAalFt,
      null,
    );
  const h = pattern.runway.trueHeadingDeg;
  const side = h + (pattern.direction === "left" ? -90 : 90);
  const crosswind = destinationPoint(pattern.runway.departureEnd, h, 2);
  const standardFinal = destinationPoint(pattern.runway.threshold, h + 180, 2);
  let lateralOffsetNm = 0.75;
  // Solve using the actual tangent budgets, including wind and geodesic course convergence.
  // Equality is allowed: two 90° arcs can share one tangent and form a continuous 180° turn.
  for (let iteration = 0; iteration < 12; iteration++) {
    const canonical = [
      pattern.runway.threshold,
      crosswind,
      destinationPoint(crosswind, side, lateralOffsetNm),
      destinationPoint(standardFinal, side, lateralOffsetNm),
      standardFinal,
      pattern.runway.threshold,
    ];
    const { candidates } = flyByRoute(canonical, turnPerformance);
    const required = Math.max(
      0.75,
      (candidates.get(1)?.exitNm ?? 0) + (candidates.get(2)?.entryNm ?? 0),
      (candidates.get(3)?.exitNm ?? 0) + (candidates.get(4)?.entryNm ?? 0),
    );
    if (required <= lateralOffsetNm + 1e-8) break;
    lateralOffsetNm = required;
  }
  const downwind = destinationPoint(crosswind, side, lateralOffsetNm);
  const finalDistance =
    pattern.operation !== "leave" && pattern.join === "final"
      ? pattern.finalDistanceNm
      : 2;
  const final = destinationPoint(
    pattern.runway.threshold,
    h + 180,
    finalDistance,
  );
  const base = destinationPoint(
    destinationPoint(pattern.runway.threshold, h + 180, 2),
    side,
    lateralOffsetNm,
  );
  const positions = {
    overhead: pattern.airport,
    crosswind,
    downwind,
    base,
    final,
  };
  const all = ["overhead", "crosswind", "downwind", "base", "final"] as const;
  const selected = all.slice(all.indexOf(pattern.join));
  if (pattern.operation === "leave") {
    const legs =
      pattern.join === "overhead"
        ? (["overhead"] as const)
        : all.slice(1, all.indexOf(pattern.join) + 1);
    const points: NavPoint[] = [
      {
        ...pattern.runway.threshold,
        ident: `${pattern.airport.ident} THR${pattern.runway.designator}`,
        patternId: pattern.id,
        patternOperation: "leave",
        altitudeFt: pattern.runway.threshold.elevationFt,
      },
      ...legs.map((leg, i) => ({
        ...positions[leg],
        ident: `TPD${i + 1}/${pattern.airport.ident}`,
        patternId: pattern.id,
        patternOperation: "leave" as const,
        turnPerformance,
      })),
    ];
    return {
      points,
      positions,
      finalDistance,
      lateralOffsetNm,
      turnPerformance,
    };
  }
  const points = selected.map((leg, i) => ({
    ...positions[leg],
    ident: `TP${i + 1}/${pattern.airport.ident}`,
    patternId: pattern.id,
    patternOperation: "join" as const,
    altitudeFt: pattern.airport.elevationFt + pattern.altitudeAalFt,
    turnPerformance,
  }));
  points.push({
    ...pattern.runway.threshold,
    ident: pattern.airport.ident,
    patternId: pattern.id,
    patternOperation: "join" as const,
    altitudeFt: pattern.runway.threshold.elevationFt,
    turnPerformance,
  });
  return { points, positions, finalDistance, lateralOffsetNm, turnPerformance };
}

/** Replace the destination arrival with the selected pattern, retaining the preceding route. */
export function routeWithTrafficPattern(
  route: NavPoint[],
  pattern: TrafficPattern,
): NavPoint[] {
  const operation = pattern.operation ?? "join";
  const clean = route.filter(
    (p) => !p.patternId || (p.patternOperation ?? "join") !== operation,
  );
  if (operation === "leave") {
    const start = clean.findIndex(
      (p) =>
        p.ident === pattern.airport.ident ||
        p.ident.startsWith(pattern.airport.ident + " THR"),
    );
    // Replacing a departure must retain both the outbound fixes and any arrival pattern.
    return [
      ...trafficPatternGeometry(pattern).points,
      ...clean.slice(start >= 0 ? start + 1 : 0),
    ];
  }
  const reverseIndex = [...clean]
    .reverse()
    .findIndex(
      (p) =>
        p.ident === pattern.airport.ident ||
        p.ident.startsWith(pattern.airport.ident + " THR"),
    );
  const at = reverseIndex < 0 ? -1 : clean.length - reverseIndex - 1;
  return [
    ...(at >= 0 ? clean.slice(0, at) : clean),
    ...trafficPatternGeometry(pattern).points,
  ];
}

/** Retain remaining en-route fixes; only an airport/pattern direct becomes a new direct to entry. */
export function activeRouteWithTrafficPattern(
  route: NavPoint[],
  activeLeg: number,
  pattern: TrafficPattern,
  position: LatLon | null = null,
): { route: NavPoint[]; activeLeg: number } {
  if (pattern.operation === "leave") {
    const next = route[activeLeg + 1];
    const amended = routeWithTrafficPattern(route, pattern);
    const target =
      activeLeg > 0 && next && !next.patternId
        ? amended.findIndex((p) => p === next) - 1
        : 0;
    return { route: amended, activeLeg: Math.max(0, target) };
  }
  const next = route[activeLeg + 1];
  const direct =
    !next ||
    (!!next.patternId && next.patternOperation !== "leave") ||
    next.ident === pattern.airport.ident ||
    next.ident.startsWith(pattern.airport.ident + " THR");
  const amended = routeWithTrafficPattern(route, pattern);
  const entryLeg = Math.max(
    0,
    amended.findIndex((point) => point.patternId === pattern.id) - 1,
  );
  return direct && position
    ? {
        route: [
          { ident: "DCT", lat: position.lat, lon: position.lon },
          ...trafficPatternGeometry(pattern).points,
        ],
        activeLeg: 0,
      }
    : // Without an ownship position, retain the existing inbound leg instead of inventing a GPS fix.
      { route: amended, activeLeg: Math.max(0, Math.min(activeLeg, entryLeg)) };
}

export type PatternReport =
  "downwind" | "base" | "longFinal" | "final" | "shortFinal";
/** Report at the specified point only on the accepted route, including GPS samples crossing it. */
export function trafficPatternReport(
  pattern: TrafficPattern,
  route: NavPoint[],
  activeLeg: number,
  position: LatLon,
  previous: LatLon | null,
  reported: readonly PatternReport[],
  performance?: TurnPerformance,
) {
  if (pattern.operation === "leave") return null;
  const geometry = trafficPatternGeometry(pattern);
  const midpoint = (a: LatLon, b: LatLon) => ({
    lat: (a.lat + b.lat) / 2,
    lon: (a.lon + b.lon) / 2,
  });
  const targets: {
    report: PatternReport;
    target: LatLon;
    from: LatLon;
    to: LatLon;
    fraction: number;
  }[] = [];
  if (["overhead", "crosswind", "downwind"].includes(pattern.join))
    targets.push({
      report: "downwind",
      target: midpoint(geometry.positions.downwind, geometry.positions.base),
      from: geometry.positions.downwind,
      to: geometry.positions.base,
      fraction: 0.5,
    });
  if (pattern.join === "base")
    targets.push({
      report: "base",
      target: midpoint(geometry.positions.base, geometry.positions.final),
      from: geometry.positions.base,
      to: geometry.positions.final,
      fraction: 0.5,
    });
  targets.push({
    report:
      geometry.finalDistance === 8
        ? "longFinal"
        : geometry.finalDistance === 2
          ? "shortFinal"
          : "final",
    target: geometry.positions.final,
    from: geometry.positions.final,
    to: pattern.runway.threshold,
    fraction: 0,
  });
  // A fly-by reaches the Final track at tangent exit, without overflying its virtual corner.
  if (performance) {
    const finalIndex = route.findIndex(
      (p) =>
        p.patternId === pattern.id &&
        distanceNm(p, geometry.positions.final) < 0.001,
    );
    const turn = flyByRoute(route, performance).turns.get(finalIndex);
    if (turn) {
      targets[targets.length - 1]!.target = turn.points.at(-1)!;
      targets[targets.length - 1]!.from = turn.points.at(-1)!;
    }
  }
  for (const t of targets) {
    if (reported.includes(t.report)) continue;
    const index = route.findIndex(
      (p) =>
        p.patternId === pattern.id &&
        distanceNm(p, t.fraction === 0 ? geometry.positions.final : t.from) <
          0.001,
    );
    if (
      index < 0 ||
      activeLeg < Math.max(0, index - (t.fraction === 0 ? 1 : 0)) ||
      activeLeg > index + 1
    )
      continue;
    if (distanceNm(position, t.target) <= 0.1) return t.report;
    if (previous && distanceNm(previous, position) <= 2) {
      const before = trackOffset(t.from, t.to, previous);
      const after = trackOffset(t.from, t.to, position);
      const along = distanceNm(t.from, t.to) * t.fraction;
      if (
        before.alongTrackNm < along &&
        after.alongTrackNm >= along &&
        Math.abs(before.crossTrackNm) <= 0.1 &&
        Math.abs(after.crossTrackNm) <= 0.1
      )
        return t.report;
    }
  }
  return null;
}
