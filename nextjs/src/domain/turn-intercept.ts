import { angleDiffDeg, toRad, toDeg } from "./angles";
import {
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  trackOffset,
  type LatLon,
} from "./geo";
import { turnPerformance } from "./fly-by";
import { windTriangle, type Wind } from "./wind";

/** Time on the measured ground track before a 3°/s air-relative turn rolls onto the next leg. */
export function rateOneIntercept(
  fix: LatLon & {
    groundSpeedKt: number | null;
    trackDeg: number | null;
    headingTrueDeg?: number;
    trueAirspeedKt?: number;
  },
  from: LatLon,
  to: LatLon,
  wind: Wind,
) {
  if (
    fix.trackDeg === null ||
    !Number.isFinite(fix.trackDeg) ||
    !Number.isFinite(fix.groundSpeedKt) ||
    !(fix.groundSpeedKt! > 0)
  )
    return null;
  const tasKt =
    fix.trueAirspeedKt ??
    turnPerformance(
      0,
      {
        windDirection: wind.directionDeg,
        windSpeed: wind.speedKt,
      },
      fix,
    ).tasKt;
  if (!(tasKt > 0) || !Number.isFinite(tasKt)) return null;
  const course = initialBearingDeg(from, to);
  const target = windTriangle(course, tasKt, wind);
  const current = Number.isFinite(fix.headingTrueDeg)
    ? fix.headingTrueDeg!
    : windTriangle(fix.trackDeg, tasKt, wind)?.headingDeg;
  if (!target || current === undefined) return null;
  const change = angleDiffDeg(current, target.headingDeg);
  if (Math.abs(change) < 1 || Math.abs(change) >= 175) return null;
  const omega = (Math.sign(change) * Math.PI) / 60;
  const duration = toRad(change) / omega;
  const heading = toRad(current),
    end = toRad(target.headingDeg);
  const speed = tasKt / 3600,
    windSpeed = wind.speedKt / 3600;
  const e =
    (speed / omega) * (Math.cos(heading) - Math.cos(end)) -
    windSpeed * Math.sin(toRad(wind.directionDeg)) * duration;
  const n =
    (speed / omega) * (Math.sin(end) - Math.sin(heading)) -
    windSpeed * Math.cos(toRad(wind.directionDeg)) * duration;
  const beta = toRad(course);
  const across =
    (fix.groundSpeedKt! / 3600) * Math.sin(toRad(fix.trackDeg - course));
  if (Math.abs(across) < 1e-6) return null;
  const seconds =
    -(
      trackOffset(from, to, fix).crossTrackNm +
      e * Math.cos(beta) -
      n * Math.sin(beta)
    ) / across;
  if (!Number.isFinite(seconds) || seconds < -1) return null;
  const start = destinationPoint(
    fix,
    fix.trackDeg,
    (fix.groundSpeedKt! * Math.max(0, seconds)) / 3600,
  );
  const rollout = destinationPoint(
    start,
    toDeg(Math.atan2(e, n)),
    Math.hypot(e, n),
  );
  const along = trackOffset(from, to, rollout).alongTrackNm;
  // An outside offset may roll onto the extension before the fix, then fly through it.
  // Reject only a rollout beyond the far end, which would skip the whole next leg.
  if (along > distanceNm(from, to) + 0.01) return null;
  return {
    seconds: Math.max(0, seconds),
    headingTrueDeg: target.headingDeg,
    direction: change > 0 ? ("right" as const) : ("left" as const),
    rollout,
  };
}
