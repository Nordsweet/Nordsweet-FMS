import {
  flightGuidance,
  flightGuidanceAvailable,
  plannedGuidanceAltitude,
  type GuidanceCommand,
} from "./flight-guidance";
import { distanceNm, initialBearingDeg, trackOffset, type LatLon } from "./geo";
import { flyByRoute, type TurnPerformance } from "./fly-by";
import { nearestLeg, type NavPoint } from "./progress";
import { mapProfilePoints } from "./map-profile";
import { holdingGeometry, type HoldingRuntime } from "./holding";
import { trueToMagneticDeg } from "./magnetic";
import { windTriangle } from "./wind";

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
    holding?: HoldingRuntime | null;
  },
): TimedGuidance[] {
  if (!flightGuidanceAvailable(input) || !input.fix) return [];
  const events: TimedGuidance[] = [];
  const add = (command: GuidanceCommand, leg: number, dueAt: number) => {
    const key =
      command.category === "heading"
        ? `heading-leg:${leg}`
        : command.direction === "levelOff"
          ? `level-off:${command.altitudeFt}`
          : `altitude-leg:${leg}:${command.altitudeFt}`;
    if (!events.some((e) => e.key === key))
      events.push({ key, command, dueAt });
  };
  for (const command of flightGuidance(input))
    if (!(input.holdingActive && command.category === "heading"))
      add(command, input.activeLeg, input.now);
  if (input.holdingActive && input.holding) {
    const hold = input.holding;
    const end =
      hold.timerStartedAt === null
        ? null
        : hold.timerStartedAt + hold.config.legSeconds * 1000;
    const fixTurn = hold.phase === "turn";
    if (
      fixTurn ||
      (end !== null && end - input.now <= 30000 && input.now - end < 12000)
    ) {
      const course = fixTurn
        ? holdingGeometry(hold.config, hold.entry).outboundDeg
        : hold.config.inboundTrueDeg;
      const opposite = hold.entry === "parallel" && hold.circuits === 0;
      const direction = opposite
        ? hold.config.direction === "right"
          ? "left"
          : "right"
        : hold.config.direction;
      const heading =
        windTriangle(course, input.tasKt, input.wind)?.headingDeg ?? course;
      events.push({
        key: `hold-${fixTurn ? "fix" : "outbound"}:${hold.config.fix.ident}:${hold.circuits}`,
        command: {
          category: "heading",
          direction,
          headingDeg:
            Math.round(trueToMagneticDeg(heading, input.variationDeg)) % 360 ||
            360,
        },
        dueAt: fixTurn ? input.now : end!,
      });
    }
    return events;
  }
  const toClimb =
    input.targetAltitudeFt !== null && input.fix.altitudeFt !== null
      ? input.targetAltitudeFt - input.fix.altitudeFt
      : Infinity;
  // Allow one normal telemetry interval around the 1000-ft crossing, without a late callout near capture.
  if (
    (input.fix.verticalSpeedFpm ?? 0) > 50 &&
    toClimb <= 1000 &&
    toClimb >= 850
  )
    add(
      {
        category: "altitude",
        direction: "levelOff",
        altitudeFt: Math.round(input.targetAltitudeFt!),
      },
      input.activeLeg,
      input.now,
    );
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
  for (const p of mapProfilePoints(
    input.plan?.points ?? [],
    input.route,
    path.points,
  )) {
    if (p.id !== "TOD") continue;
    // A profile event at a real waypoint is already covered by its leg-boundary countdown.
    if (input.route.some((fix) => distanceNm(fix, p) < 0.001)) continue;
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
