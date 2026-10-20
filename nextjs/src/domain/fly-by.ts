import { angleDiffDeg, toDeg, toRad } from "./angles";
import {
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  type LatLon,
} from "./geo";

export type TurnPerformance = {
  departureTasKt?: number;
  tasKt: number;
  windDirectionDeg?: number;
  windSpeedKt?: number;
};
type Vec = { e: number; n: number };
const cross = (a: Vec, b: Vec) => a.e * b.n - a.n * b.e;
const dot = (a: Vec, b: Vec) => a.e * b.e + a.n * b.n;
const unit = (heading: number): Vec => ({
  e: Math.sin(heading),
  n: Math.cos(heading),
});
const OMEGA = Math.PI / 60;
/** Treat sub-metre projection/rounding gaps as a shared tangent, never as an extra straight leg. */
export const TURN_JOIN_TOLERANCE_NM = 0.0005;

export type FlyByTurn = {
  index: number;
  entryNm: number;
  exitNm: number;
  radiusNm: number;
  durationSeconds: number;
  points: LatLon[];
};
export type TurnIssue = {
  index: number;
  reason: "space" | "reversal" | "wind" | "speed";
};

export type FlyByPoint = LatLon & {
  patternOperation?: "join" | "leave";
  flyOver?: boolean;
  turnPerformance?: TurnPerformance;
  /** Start a resumed route on this ground track before turning toward its first fix. */
  initialCourseDeg?: number;
  initialTurnDirection?: "left" | "right";
};
type FlyByPath = {
  points: LatLon[];
  legs: number[];
  turns: Map<number, FlyByTurn>;
  candidates: Map<number, FlyByTurn>;
  issues: TurnIssue[];
};

/** Constant-air-relative 3°/s turns in a geodesic local frame; never shrink a radius to fit. */
export function flyByRoute(
  route: readonly FlyByPoint[],
  performance: TurnPerformance,
): FlyByPath {
  const start = route[0];
  if (start?.initialCourseDeg != null && route.length > 1) {
    const plain = [
      { ...start, initialCourseDeg: undefined },
      ...route.slice(1),
    ];
    const setting = start.turnPerformance ?? performance;
    const guides = courseExitGuides(
      plain.slice(0, 1),
      start.initialCourseDeg,
      plain.slice(1),
      setting,
      start.initialTurnDirection ?? "right",
      performance,
    ).map((p) => ({ ...p, turnPerformance: setting }));
    const path = flyByRoute(
      [plain[0]!, ...guides, ...plain.slice(1)],
      performance,
    );
    // Virtual corners shape the curve but never become FPL fixes or sequencing targets.
    const remap = (turns: Map<number, FlyByTurn>) =>
      new Map(
        [...turns]
          .filter(([index]) => index > guides.length)
          .map(([index, turn]) => [
            index - guides.length,
            { ...turn, index: index - guides.length },
          ]),
      );
    return {
      ...path,
      legs: path.legs.map((leg) => Math.max(0, leg - guides.length)),
      turns: remap(path.turns),
      candidates: remap(path.candidates),
      issues: [
        ...path.issues.map((issue) => ({
          ...issue,
          index: Math.max(0, issue.index - guides.length),
        })),
        ...(!guides.length &&
        Math.abs(
          angleDiffDeg(
            start.initialCourseDeg,
            initialBearingDeg(start, route[1]!),
          ),
        ) >= 1
          ? [{ index: 0, reason: "space" as const }]
          : []),
      ],
    };
  }
  const turns = new Map<number, FlyByTurn>();
  const candidates = new Map<number, FlyByTurn>();
  const issues: TurnIssue[] = [];
  for (let i = 1; i < route.length - 1; i++) {
    if (route[i]!.flyOver) continue;
    const p = route[i]!;
    const setting =
      p.patternOperation === "leave" && performance.departureTasKt
        ? { ...performance, tasKt: performance.departureTasKt }
        : (p.turnPerformance ?? performance);
    const v = setting.tasKt / 3600;
    const w = unit(toRad(setting.windDirectionDeg ?? 0));
    w.e *= -(setting.windSpeedKt ?? 0) / 3600;
    w.n *= -(setting.windSpeedKt ?? 0) / 3600;
    const incoming = toRad(initialBearingDeg(p, route[i - 1]!) + 180);
    const outgoing = toRad(initialBearingDeg(p, route[i + 1]!));
    const delta = toRad(angleDiffDeg(toDeg(incoming), toDeg(outgoing)));
    if (Math.abs(delta) < toRad(1)) continue;
    const issue = (reason: TurnIssue["reason"]) =>
      issues.push({ index: i, reason });
    if (!(v > 0) || !Number.isFinite(v)) {
      issue("speed");
      continue;
    }
    if (Math.abs(delta) >= toRad(175)) {
      issue("reversal");
      continue;
    }
    const u = unit(incoming),
      z = unit(outgoing);
    const heading = (track: number) => {
      const right = { e: Math.cos(track), n: -Math.sin(track) };
      const side = dot(w, right);
      if (
        Math.abs(side) >= v ||
        Math.sqrt(v * v - side * side) + dot(w, unit(track)) <= 0
      )
        return null;
      return track + Math.asin(-side / v);
    };
    const aHeading = heading(incoming),
      bHeading = heading(outgoing);
    if (aHeading === null || bHeading === null) {
      issue("wind");
      continue;
    }
    const sign = Math.sign(delta);
    let change = bHeading - aHeading;
    change =
      sign > 0
        ? ((change % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
        : -(((-change % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
    const q = sign * OMEGA,
      duration = change / q;
    const displacement = (t: number): Vec => ({
      e: (v / q) * (Math.cos(aHeading) - Math.cos(aHeading + q * t)) + w.e * t,
      n: (v / q) * (Math.sin(aHeading + q * t) - Math.sin(aHeading)) + w.n * t,
    });
    const d = displacement(duration),
      det = cross(u, z);
    const entryNm = cross(d, z) / det,
      exitNm = cross(u, d) / det;
    if (!(entryNm > 0 && exitNm > 0)) {
      issue("space");
      continue;
    }
    const count = Math.max(2, Math.ceil(duration));
    const points = Array.from({ length: count + 1 }, (_, j) => {
      const d = displacement((duration * j) / count);
      const e = -entryNm * u.e + d.e,
        n = -entryNm * u.n + d.n;
      return destinationPoint(p, toDeg(Math.atan2(e, n)), Math.hypot(e, n));
    });
    const candidate = {
      index: i,
      entryNm,
      exitNm,
      radiusNm: v / OMEGA,
      durationSeconds: duration,
      points,
    };
    candidates.set(i, candidate);
    if (
      entryNm > distanceNm(route[i - 1]!, p) + TURN_JOIN_TOLERANCE_NM ||
      exitNm > distanceNm(p, route[i + 1]!) + TURN_JOIN_TOLERANCE_NM
    ) {
      issue("space");
    } else turns.set(i, candidate);
  }
  // Mark both conflicting turns before removing either, so results do not depend on traversal order.
  const blocked = new Set<number>();
  for (let i = 1; i < route.length - 2; i++) {
    const a = turns.get(i),
      b = turns.get(i + 1);
    if (
      a &&
      b &&
      a.exitNm + b.entryNm >
        distanceNm(route[i]!, route[i + 1]!) + TURN_JOIN_TOLERANCE_NM
    ) {
      blocked.add(i);
      blocked.add(i + 1);
    }
  }
  for (const index of blocked) {
    turns.delete(index);
    issues.push({ index, reason: "space" });
  }
  const points: LatLon[] = [];
  const legs: number[] = [];
  const append = (point: LatLon, leg: number) => {
    if (points.length) legs.push(leg);
    points.push(point);
  };
  route.forEach((p, i) => {
    const turn = turns.get(i);
    if (turn)
      turn.points.forEach((p, j) => {
        if (
          j === 0 &&
          turns.has(i - 1) &&
          points.length &&
          distanceNm(points.at(-1)!, p) <= TURN_JOIN_TOLERANCE_NM
        )
          return;
        append(p, j === 0 ? i - 1 : i);
      });
    else append(p, Math.max(0, i - 1));
  });
  return { points, legs, turns, candidates, issues };
}

/** Shared departure/HOLD connector: establish the current course, then fit full rate-one arcs. */
export function courseExitGuides(
  prefix: readonly FlyByPoint[],
  heading: number,
  suffix: readonly FlyByPoint[],
  performance: TurnPerformance,
  direction: "left" | "right",
  routePerformance: TurnPerformance = performance,
): LatLon[] {
  const start = prefix.at(-1),
    outbound = suffix[0];
  if (!start || !outbound) return [];
  if (
    Math.abs(angleDiffDeg(heading, initialBearingDeg(start, outbound))) < 1 &&
    flyByRoute([...prefix, ...suffix], routePerformance).issues.length === 0
  )
    return [];
  const radius = performance.tasKt / (60 * Math.PI);
  const maxLength = Math.max(2, distanceNm(start, outbound) + 4 * radius);
  // A dogleg handles fixes behind the aircraft without an abrupt reversal.
  for (const dogleg of [false, true])
    for (
      let length = Math.max(0.05, 2 * radius + 0.01);
      length <= maxLength;
      length *= 1.2
    ) {
      const first = destinationPoint(start, heading, length);
      const guides = dogleg
        ? [
            first,
            destinationPoint(
              first,
              heading + (direction === "left" ? -90 : 90),
              length,
            ),
          ]
        : [first];
      const path = flyByRoute(
        [
          ...prefix,
          ...guides.map((p) => ({ ...p, turnPerformance: performance })),
          ...suffix,
        ],
        routePerformance,
      );
      if (
        !path.issues.some(
          (issue) =>
            issue.index >= prefix.length - 1 &&
            issue.index <= prefix.length + guides.length,
        )
      )
        return guides;
    }
  return [];
}

/** Live TAS is inferred from the measured ground vector minus the supplied planning wind. */
export function turnPerformance(
  plannedTasKt: number,
  wind:
    | { windDirection: number; windSpeed: number; variableWind?: boolean }
    | null
    | undefined,
  fix?: { groundSpeedKt: number | null; trackDeg: number | null } | null,
): TurnPerformance {
  const direction = wind?.variableWind ? 0 : (wind?.windDirection ?? 0);
  const speed = wind?.variableWind ? 0 : (wind?.windSpeed ?? 0);
  let tasKt = plannedTasKt;
  if (
    fix?.groundSpeedKt != null &&
    fix.groundSpeedKt > 5 &&
    fix.trackDeg != null
  ) {
    const ground = unit(toRad(fix.trackDeg)),
      from = unit(toRad(direction));
    tasKt = Math.hypot(
      ground.e * fix.groundSpeedKt + from.e * speed,
      ground.n * fix.groundSpeedKt + from.n * speed,
    );
  }
  return { tasKt, windDirectionDeg: direction, windSpeedKt: speed };
}
