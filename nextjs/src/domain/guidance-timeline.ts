import {
  flightGuidance,
  flightGuidanceAvailable,
  plannedGuidanceAltitude,
  type GuidanceCommand,
} from "./flight-guidance";
import { distanceNm, initialBearingDeg, trackOffset, type LatLon } from "./geo";
import { flyByRoute, type TurnPerformance } from "./fly-by";
import { nearestLeg, type NavPoint } from "./progress";

export type TimedGuidance = {
  key: string;
  command: GuidanceCommand;
  dueAt: number;
};

/** Warn thirty seconds before the actual curved-path leg boundary or TOD, with a fresh-fix fallback for already-due corrections. */
export function guidanceTimeline(
  input: Parameters<typeof flightGuidance>[0] & {
    route: NavPoint[];
    activeLeg: number;
    performance: TurnPerformance;
    plan: Parameters<typeof plannedGuidanceAltitude>[2];
    cruiseAltitudeFt: number;
    holdingActive?: boolean;
  },
): TimedGuidance[] {
  if (!flightGuidanceAvailable(input) || !input.fix) return [];
  const events: TimedGuidance[] = [];
  const add = (command: GuidanceCommand, leg: number, dueAt: number) => {
    const key =
      command.category === "heading"
        ? `heading-leg:${leg}`
        : `altitude-leg:${leg}:${command.altitudeFt}`;
    if (!events.some((e) => e.key === key))
      events.push({ key, command, dueAt });
  };
  for (const command of flightGuidance(input))
    add(command, input.activeLeg, input.now);
  if (input.holdingActive || !("lat" in input.fix) || !("lon" in input.fix))
    return events;
  const position = input.fix as typeof input.fix & LatLon;
  const path = flyByRoute(input.route, input.performance);
  const nearest = nearestLeg(path, position, input.activeLeg);
  if (!nearest || nearest.distance > 1) return events;
  const distances = new Map<number, number>();
  let remaining = nearest.remaining + nearest.distance;
  distances.set(nearest.index + 1, remaining);
  for (let i = nearest.index + 1; i < path.points.length - 1; i++) {
    remaining += distanceNm(path.points[i]!, path.points[i + 1]!);
    distances.set(i + 1, remaining);
  }
  const due = (nm: number) =>
    Date.parse(input.fix!.time) + (nm * 3600000) / input.fix!.groundSpeedKt!;
  const within = (at: number) =>
    at - input.now <= 30000 && at - input.now >= -1000;
  for (let leg = input.activeLeg + 1; leg < input.route.length - 1; leg++) {
    const index = path.legs.indexOf(leg);
    const nm = distances.get(index);
    if (nm === undefined) continue;
    const at = due(nm);
    if (at - input.now > 30000) break;
    if (!within(at)) continue;
    const from = input.route[leg]!,
      next = input.route[leg + 1]!,
      previous = input.route[leg - 1]!;
    const projected = {
      ...input.fix,
      headingTrueDeg: undefined,
      trackDeg: initialBearingDeg(previous, from),
    };
    for (const command of flightGuidance({
      ...input,
      fix: projected,
      courseTrueDeg: initialBearingDeg(from, next),
      targetAltitudeFt: null,
    }))
      add(command, leg, at);
    const before = plannedGuidanceAltitude(
      from,
      0,
      input.plan,
      input.cruiseAltitudeFt,
    );
    const after = plannedGuidanceAltitude(
      next,
      distanceNm(from, next),
      input.plan,
      input.cruiseAltitudeFt,
    );
    if (Math.abs(before - after) >= 150)
      for (const command of flightGuidance({
        ...input,
        courseTrueDeg: null,
        targetAltitudeFt: after,
      }))
        add(command, leg, at);
  }
  // Vertical profile points are not navigable fixes; locate TOD on the same drawn path.
  for (const p of input.plan?.points ?? []) {
    if (!p.isProfilePoint || p.id !== "TOD") continue;
    let closest: { cross: number; nm: number; leg: number } | null = null;
    for (let i = nearest.index; i < path.legs.length; i++) {
      const a = path.points[i]!,
        b = path.points[i + 1]!,
        length = distanceNm(a, b);
      const offset = trackOffset(a, b, p);
      const along = Math.max(0, Math.min(length, offset.alongTrackNm));
      const cross =
        offset.alongTrackNm < 0
          ? distanceNm(p, a)
          : offset.alongTrackNm > length
            ? distanceNm(p, b)
            : Math.abs(offset.crossTrackNm);
      const nm =
        (distances.get(i + 1) ?? nearest.remaining + nearest.distance) -
        length +
        along;
      if (nm >= 0 && (!closest || cross < closest.cross))
        closest = { cross, nm, leg: path.legs[i]! };
    }
    if (!closest || closest.cross > 0.5 || !within(due(closest.nm))) continue;
    const next = input.route[closest.leg + 1];
    if (!next) continue;
    const target = plannedGuidanceAltitude(
      next,
      0,
      input.plan,
      input.cruiseAltitudeFt,
    );
    for (const command of flightGuidance({
      ...input,
      courseTrueDeg: null,
      targetAltitudeFt: target,
    }))
      add(command, closest.leg, due(closest.nm));
  }
  return events;
}
