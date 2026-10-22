import { type TrafficPattern } from "~/data/traffic-pattern";
import { type Airport, type Runway } from "~/data/schemas";
import { type NavPoint } from "./progress";
import {
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  trackOffset,
  type LatLon,
} from "./geo";
import { angleDiffDeg } from "./angles";
import { flyByRoute, courseExitGuides, type TurnPerformance } from "./fly-by";
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
export function trafficPatternGeometry(
  pattern: TrafficPattern,
  outbound?: LatLon,
) {
  const turnPerformance =
    pattern.turnPerformance ??
    patternPlanningPerformance(
      pattern.speedKias ?? 100,
      pattern.airport.elevationFt,
      pattern.altitudeAalFt,
      null,
    );
  const runwayLengthNm = distanceNm(
    pattern.runway.threshold,
    pattern.runway.departureEnd,
  );
  // Stored headings can disagree with published thresholds. Derive the axis here too
  // so persisted patterns use the same centreline as newly selected runways.
  const h =
    runwayLengthNm > 0.000001
      ? initialBearingDeg(pattern.runway.threshold, pattern.runway.departureEnd)
      : pattern.runway.trueHeadingDeg;
  const side = h + (pattern.direction === "left" ? -90 : 90);
  // Extend from the first threshold: restarting at the opposite end with the
  // initial bearing would introduce another error from course convergence.
  const crosswind = destinationPoint(
    pattern.runway.threshold,
    h,
    runwayLengthNm + 2,
  );
  const standardFinal = destinationPoint(pattern.runway.threshold, h + 180, 2);
  let lateralOffsetNm = 0.75;
  let firstTurnEntryNm = 0;
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
    firstTurnEntryNm = candidates.get(1)?.entryNm ?? 0;
    const required = Math.max(
      0.75,
      (candidates.get(1)?.exitNm ?? 0) + (candidates.get(2)?.entryNm ?? 0),
      (candidates.get(3)?.exitNm ?? 0) + (candidates.get(4)?.entryNm ?? 0),
    );
    if (required <= lateralOffsetNm + 1e-8) break;
    lateralOffsetNm = required;
  }
  const downwind = destinationPoint(crosswind, side, lateralOffsetNm);
  // Leave on the runway axis before the first circuit turn, at its inbound tangent.
  const straightOut = destinationPoint(
    pattern.runway.threshold,
    h,
    Math.max(runwayLengthNm, runwayLengthNm + 2 - firstTurnEntryNm),
  );
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
    overhead:
      pattern.operation === "leave"
        ? destinationPoint(pattern.runway.threshold, h, runwayLengthNm / 2)
        : pattern.airport,
    crosswind,
    downwind,
    base,
    final:
      pattern.operation === "leave" && pattern.join === "final"
        ? straightOut
        : final,
  };
  const all = ["overhead", "crosswind", "downwind", "base", "final"] as const;
  const selected = all.slice(all.indexOf(pattern.join));
  if (pattern.operation === "leave") {
    const legs =
      pattern.join === "overhead"
        ? (["crosswind", "downwind", "base", "final", "overhead"] as const)
        : pattern.join === "final"
          ? (["crosswind"] as const)
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
        ...(pattern.join === "final" ? straightOut : positions[leg]),
        ident: `TPD${i + 1}/${pattern.airport.ident}`,
        patternId: pattern.id,
        patternOperation: "leave" as const,
        turnPerformance,
        // Complete Final along the runway axis before starting the outbound turn.
        ...(leg === "overhead" ? { flyOver: true } : {}),
      })),
    ];
    if (outbound) {
      const nextLeg = {
        overhead: crosswind,
        crosswind: downwind,
        downwind: base,
        base: final,
        final: crosswind,
      };
      points.push(
        ...departureExitGuides(
          points,
          nextLeg[pattern.join],
          outbound,
          pattern,
          turnPerformance,
        ),
      );
    }
    return {
      points,
      positions,
      finalDistance,
      lateralOffsetNm,
      turnPerformance,
    };
  }
  const points: NavPoint[] = selected.map((leg, i) => ({
    ...positions[leg],
    ident: `TP${i + 1}/${pattern.airport.ident}`,
    patternId: pattern.id,
    patternOperation: "join" as const,
    altitudeFt: pattern.airport.elevationFt + pattern.altitudeAalFt,
    turnPerformance,
  }));
  if (distanceNm(pattern.runway.threshold, pattern.airport) > 0.000001)
    points.push({
      ...pattern.runway.threshold,
      ident: `${pattern.airport.ident} THR${pattern.runway.designator}`,
      patternId: pattern.id,
      patternOperation: "join",
      altitudeFt: pattern.runway.threshold.elevationFt,
      turnPerformance,
      // Final must reach the landing threshold before continuing toward an off-axis ARP.
      flyOver: true,
    });
  points.push({
    ...pattern.airport,
    ident: pattern.airport.ident,
    patternId: pattern.id,
    patternOperation: "join",
    altitudeFt: pattern.airport.elevationFt,
    turnPerformance,
  });
  return { points, positions, finalDistance, lateralOffsetNm, turnPerformance };
}

/** Establish the selected leg's track before turning outbound; never squeeze rate-one arcs. */
function departureExitGuides(
  points: NavPoint[],
  legEnd: LatLon,
  outbound: LatLon,
  pattern: TrafficPattern,
  performance: TurnPerformance,
): NavPoint[] {
  const start = points.at(-1)!;
  const heading = initialBearingDeg(start, legEnd);
  return courseExitGuides(
    points,
    heading,
    [outbound],
    performance,
    pattern.direction,
  ).map((position, index): NavPoint => ({
    ...position,
    ident: `TPX${index + 1}/${pattern.airport.ident}`,
    patternId: pattern.id,
    patternOperation: "leave",
    turnPerformance: performance,
  }));
}

/** Replace the destination arrival with the selected pattern, retaining the preceding route. */
export function trafficPatternEntryPoints(
  pattern: TrafficPattern,
  inbound: readonly NavPoint[],
) {
  const points = trafficPatternGeometry(pattern).points;
  if (
    pattern.operation === "leave" ||
    (pattern.join !== "base" &&
      pattern.join !== "downwind" &&
      pattern.join !== "crosswind") ||
    !inbound.length
  )
    return points;
  const entry = points[0]!,
    next = points[1]!;
  const performance = entry.turnPerformance ?? {
    tasKt: pattern.speedKias ?? 100,
  };
  const boundary = inbound.length;
  const fits = (route: readonly NavPoint[]) =>
    !flyByRoute(route, performance).issues.some(
      (issue) => issue.index >= boundary - 1 && issue.index <= boundary + 2,
    );
  const direct = [...inbound, ...points];
  const entryTurn = flyByRoute(direct, performance).candidates.get(boundary);
  const downwindCapture = entryTurn?.points.at(-1);
  const capturesBeforeRunway =
    !downwindCapture ||
    trackOffset(
      pattern.runway.threshold,
      pattern.runway.departureEnd,
      downwindCapture,
    ).alongTrackNm >=
      distanceNm(pattern.runway.threshold, pattern.runway.departureEnd);
  // An acute Downwind entry can fit geometrically yet consume the leg past runway abeam.
  // Establish its course before the selected leg start, rather than trimming that start.
  if (fits(direct) && (pattern.join !== "downwind" || capturesBeforeRunway))
    return points;
  // Reverse the established leg course to solve its incoming connector. The forward
  // validation keeps the real wind and full rate-one radii, including adjacent arcs.
  for (const direction of [
    pattern.direction === "left" ? "right" : "left",
    pattern.direction,
  ] as const) {
    const guides = courseExitGuides(
      [...points]
        .reverse()
        .map((p, i) => (i === points.length - 1 ? { ...p, flyOver: true } : p)),
      initialBearingDeg(entry, next) + 180,
      [...inbound].reverse(),
      performance,
      direction,
    );
    const joining: NavPoint[] = [...guides].reverse().map((p, i) => ({
      ...p,
      ident: `TPJ${i + 1}/${pattern.airport.ident}`,
      patternId: pattern.id,
      patternOperation: "join",
      altitudeFt: pattern.airport.elevationFt + pattern.altitudeAalFt,
      turnPerformance: performance,
    }));
    if (joining.length && fits([...inbound, ...joining, ...points]))
      return [...joining, ...points];
  }
  return points;
}

export function routeWithTrafficPattern(
  route: NavPoint[],
  pattern: TrafficPattern,
): NavPoint[] {
  const operation = pattern.operation ?? "join";
  const clean = route.filter(
    (p) => !p.patternId || (p.patternOperation ?? "join") !== operation,
  );
  const replacing = clean.length !== route.length;
  if (operation === "leave") {
    const first = clean[0];
    // On a round trip the same airport/threshold also occurs at the arrival end.
    const hasOrigin =
      !replacing &&
      first &&
      !first.patternId &&
      (first.ident === pattern.airport.ident ||
        first.ident.startsWith(pattern.airport.ident + " THR"));
    const outbound = hasOrigin ? clean.slice(1) : clean;
    return [
      ...trafficPatternGeometry(pattern, outbound[0]).points,
      ...outbound,
    ];
  }
  const reverseIndex = [...clean]
    .reverse()
    .findIndex(
      (p) =>
        !p.patternId &&
        (p.ident === pattern.airport.ident ||
          p.ident.startsWith(pattern.airport.ident + " THR")),
    );
  const at = reverseIndex < 0 ? -1 : clean.length - reverseIndex - 1;
  const prefix = !replacing && at >= 0 ? clean.slice(0, at) : clean;
  return [...prefix, ...trafficPatternEntryPoints(pattern, prefix)];
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
          ...trafficPatternEntryPoints(pattern, [
            { ident: "DCT", ...position },
          ]),
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

/** Map-only closed circuit; never inserts extra legs into the navigation route. */
export function trafficPatternCircuit(pattern: TrafficPattern): LatLon[] {
  if (!pattern.multipleTrafficPatterns) return [];
  const geometry = trafficPatternGeometry({
    ...pattern,
    operation: "join",
    join: "downwind",
    finalDistanceNm: 2,
  });
  const { crosswind, downwind, base, final } = geometry.positions;
  // Duplicate the seam neighbours so the first/last circuit corner is also a fly-by.
  const loop = [final, crosswind, downwind, base, final, crosswind, downwind];
  const path = flyByRoute(loop, geometry.turnPerformance);
  const first = path.turns.get(1)?.points[0] ?? crosswind;
  const last = path.turns.get(5)?.points[0] ?? crosswind;
  const start = path.points.indexOf(first);
  const end = path.points.indexOf(last, start + 1);
  const circuit = path.points.slice(start, end);
  return [...circuit, first];
}
