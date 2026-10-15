import { angleDiffDeg, toDeg, toRad } from "./angles";
import {
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  type LatLon,
} from "./geo";

export type TurnPerformance = {
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

/** Constant-air-relative 3°/s turns in a geodesic local frame; never shrink a radius to fit. */
export function flyByRoute(
  route: readonly (LatLon & { flyOver?: boolean })[],
  performance: TurnPerformance,
) {
  const turns = new Map<number, FlyByTurn>();
  const issues: TurnIssue[] = [];
  const v = performance.tasKt / 3600;
  const w = unit(toRad(performance.windDirectionDeg ?? 0));
  w.e *= -(performance.windSpeedKt ?? 0) / 3600;
  w.n *= -(performance.windSpeedKt ?? 0) / 3600;
  for (let i = 1; i < route.length - 1; i++) {
    if (route[i]!.flyOver) continue;
    const p = route[i]!;
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
    if (
      !(entryNm > 0 && exitNm > 0) ||
      entryNm >= distanceNm(route[i - 1]!, p) ||
      exitNm >= distanceNm(p, route[i + 1]!)
    ) {
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
    turns.set(i, {
      index: i,
      entryNm,
      exitNm,
      radiusNm: v / OMEGA,
      durationSeconds: duration,
      points,
    });
  }
  // Mark both conflicting turns before removing either, so results do not depend on traversal order.
  const blocked = new Set<number>();
  for (let i = 1; i < route.length - 2; i++) {
    const a = turns.get(i),
      b = turns.get(i + 1);
    if (a && b && a.exitNm + b.entryNm > distanceNm(route[i]!, route[i + 1]!)) {
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
    if (turn) turn.points.forEach((p, j) => append(p, j === 0 ? i - 1 : i));
    else append(p, Math.max(0, i - 1));
  });
  return { points, legs, turns, issues };
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
