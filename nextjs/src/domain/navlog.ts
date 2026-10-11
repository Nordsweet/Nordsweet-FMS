import {
  type LatLon,
  destinationPoint,
  distanceNm,
  initialBearingDeg,
} from "./geo";
import { magneticVariationDeg, trueToMagneticDeg } from "./magnetic";
import { type Wind, windTriangle } from "./wind";

export type NavPoint = LatLon & { ident: string };

export type NavLeg = {
  from: NavPoint;
  to: NavPoint;
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
};

/**
 * Leg-by-leg log at cruise: great-circle distance, course at the leg midpoint (where variation and
 * the great-circle course are averaged best), wind correction and time. Wind direction is true.
 */
export function computeNavLog(
  points: NavPoint[],
  {
    tasKt,
    wind,
    fuelFlowLph,
    date = new Date(),
  }: { tasKt: number; wind: Wind; fuelFlowLph: number; date?: Date },
): NavLog {
  const legs = points.slice(1).map((to, i): NavLeg => {
    const from = points[i]!;
    const distance = distanceNm(from, to);
    const mid = destinationPoint(
      from,
      initialBearingDeg(from, to),
      distance / 2,
    );
    const trueCourse = distance > 0 ? initialBearingDeg(mid, to) : 0;
    const variation = magneticVariationDeg(mid, date);
    const solved = windTriangle(trueCourse, tasKt, wind);
    const minutes = solved ? (distance / solved.groundSpeedKt) * 60 : null;
    return {
      from,
      to,
      distanceNm: distance,
      trueCourseDeg: trueCourse,
      magneticCourseDeg: trueToMagneticDeg(trueCourse, variation),
      magneticHeadingDeg: solved
        ? trueToMagneticDeg(solved.headingDeg, variation)
        : null,
      groundSpeedKt: solved?.groundSpeedKt ?? null,
      minutes,
      fuelL: minutes === null ? null : (minutes / 60) * fuelFlowLph,
    };
  });
  const sum = (key: "minutes" | "fuelL") =>
    legs.some((l) => l[key] === null)
      ? null
      : legs.reduce((total, l) => total + l[key]!, 0);
  return {
    legs,
    distanceNm: legs.reduce((total, l) => total + l.distanceNm, 0),
    minutes: sum("minutes"),
    fuelL: sum("fuelL"),
  };
}
