import {
  type LatLon,
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  midpoint,
} from "./geo";
import { magneticVariationDeg, trueToMagneticDeg } from "./magnetic";
import { type Wind, windTriangle } from "./wind";

export type NavPoint = LatLon & { ident: string };
export type FlightPhase = "climb" | "cruise" | "descent";

export type NavLeg = {
  from: NavPoint;
  to: NavPoint;
  phase: FlightPhase;
  wind: Wind;
  distanceNm: number;
  trueCourseDeg: number;
  magneticCourseDeg: number;
  /** null when the wind is stronger than the aircraft can correct for. */
  magneticHeadingDeg: number | null;
  groundSpeedKt: number | null;
  minutes: number | null;
  fuelL: number | null;
};

export type NavLog = {
  legs: NavLeg[];
  distanceNm: number;
  minutes: number | null;
  fuelL: number | null;
  /** Climb and descent need more distance than the route has. */
  cruiseNotReached: boolean;
};

/** A climb or descent: how long it lasts, at what true airspeed and fuel flow. */
export type Segment = { minutes: number; tasKt: number; fuelFlowLph: number };

type Options = {
  tasKt: number;
  wind: Wind;
  legWinds?: Wind[];
  fuelFlowLph: number;
  climb?: Segment;
  descent?: Segment;
  date?: Date;
};

type RouteLeg = {
  from: NavPoint;
  to: NavPoint;
  start: number; // distance from departure
  distance: number;
  trueCourse: number;
  variation: number;
  wind: Wind;
};

const groundSpeed = (leg: RouteLeg, tasKt: number) =>
  windTriangle(leg.trueCourse, tasKt, leg.wind)?.groundSpeedKt ?? null;

/** Ground distance covered in `minutes` flying `legs` in order at `tasKt`; null if a leg is unflyable. */
function distanceFor(legs: RouteLeg[], minutes: number, tasKt: number) {
  let remaining = minutes;
  let covered = 0;
  for (const leg of legs) {
    const gs = groundSpeed(leg, tasKt);
    if (gs === null) return null;
    const legMinutes = (leg.distance / gs) * 60;
    if (remaining <= legMinutes) return covered + (remaining / 60) * gs;
    remaining -= legMinutes;
    covered += leg.distance;
  }
  return Infinity; // the route ends before the segment does
}

/**
 * Leg-by-leg log: great-circle distance, course at the leg midpoint (where variation and the
 * great-circle course are averaged best), wind correction, time and fuel. With climb and descent
 * segments, TOC and TOD are inserted where they fall along the route. Wind direction is true.
 */
export function computeNavLog(points: NavPoint[], options: Options): NavLog {
  const {
    tasKt,
    wind,
    legWinds,
    fuelFlowLph,
    climb,
    descent,
    date = new Date(),
  } = options;
  let start = 0;
  const route = points.slice(1).map((to, i): RouteLeg => {
    const from = points[i]!;
    const distance = distanceNm(from, to);
    const mid = midpoint(from, to);
    const leg = {
      from,
      to,
      start,
      distance,
      trueCourse: distance > 0 ? initialBearingDeg(mid, to) : 0,
      variation: magneticVariationDeg(mid, date),
      wind: legWinds?.[i] ?? wind,
    };
    start += distance;
    return leg;
  });
  const total = start;

  let toc = climb ? (distanceFor(route, climb.minutes, climb.tasKt) ?? 0) : 0;
  let tod = descent
    ? total -
      (distanceFor([...route].reverse(), descent.minutes, descent.tasKt) ?? 0)
    : total;
  const cruiseNotReached = toc > tod;
  if (cruiseNotReached) {
    // Meet in the middle in proportion to the distance each segment wants.
    const climbWants = Math.min(toc, total);
    const descentWants = Math.min(total - tod, total);
    toc = tod = (total * climbWants) / (climbWants + descentWants || 1);
  }

  const phaseFor = (from: number, to: number): FlightPhase =>
    to <= toc + 1e-9 && climb
      ? "climb"
      : from >= tod - 1e-9 && descent
        ? "descent"
        : "cruise";
  const segmentOf = (phase: FlightPhase): Segment =>
    phase === "climb"
      ? climb!
      : phase === "descent"
        ? descent!
        : { minutes: 0, tasKt, fuelFlowLph };

  const legs: NavLeg[] = [];
  for (const leg of route) {
    const cuts = [0, leg.distance];
    const markers = new Map<number, string>();
    for (const [at, ident] of [
      [toc, "TOC"],
      [tod, "TOD"],
    ] as const) {
      const offset = at - leg.start;
      if (
        offset > 1e-6 &&
        offset < leg.distance - 1e-6 &&
        !(ident === "TOD" && cruiseNotReached)
      ) {
        cuts.push(offset);
        markers.set(offset, ident);
      }
    }
    cuts.sort((a, b) => a - b);
    const course = initialBearingDeg(leg.from, leg.to);
    const pointAt = (offset: number): NavPoint =>
      offset === 0
        ? leg.from
        : offset === leg.distance
          ? leg.to
          : {
              ident: markers.get(offset)!,
              ...destinationPoint(leg.from, course, offset),
            };
    for (let c = 0; c < cuts.length - 1; c++) {
      const a = cuts[c]!;
      const b = cuts[c + 1]!;
      const phase = phaseFor(leg.start + a, leg.start + b);
      const segment = segmentOf(phase);
      const solved = windTriangle(leg.trueCourse, segment.tasKt, leg.wind);
      const minutes = solved ? ((b - a) / solved.groundSpeedKt) * 60 : null;
      legs.push({
        from: pointAt(a),
        to: pointAt(b),
        phase,
        wind: leg.wind,
        distanceNm: b - a,
        trueCourseDeg: leg.trueCourse,
        magneticCourseDeg: trueToMagneticDeg(leg.trueCourse, leg.variation),
        magneticHeadingDeg: solved
          ? trueToMagneticDeg(solved.headingDeg, leg.variation)
          : null,
        groundSpeedKt: solved?.groundSpeedKt ?? null,
        minutes,
        fuelL: minutes === null ? null : (minutes / 60) * segment.fuelFlowLph,
      });
    }
  }

  const sum = (key: "minutes" | "fuelL") =>
    legs.some((l) => l[key] === null)
      ? null
      : legs.reduce((t, l) => t + l[key]!, 0);
  return {
    legs,
    distanceNm: total,
    minutes: sum("minutes"),
    fuelL: sum("fuelL"),
    cruiseNotReached,
  };
}
