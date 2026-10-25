import { type LatLon, distanceNm, initialBearingDeg, trackOffset } from "./geo";
import { flyByRoute, type TurnPerformance, type FlyByPoint } from "./fly-by";
import { rateOneIntercept } from "./turn-intercept";

export type NavPoint = FlyByPoint & {
  ident: string;
  patternId?: string;
  patternOperation?: "join" | "leave";
  altitudeFt?: number;
};

/** Within this distance of the next waypoint it counts as passed even if not yet abeam. */
const PASSED_NM = 0.3;

export type Progress = {
  /** Index of the leg being flown: route[active] → route[active + 1]. */
  activeLeg: number;
  next: NavPoint;
  distanceToNextNm: number;
  /** True bearing to the next guidance point on the straight or arc. */
  bearingToNextDeg: number;
  /** True tangent course on the active straight or turn (desired track). */
  desiredTrackDeg: number;
  /** Positive = right of track. */
  crossTrackNm: number;
  distanceToDestinationNm: number;
};

/** Project only onto the sequenced curved leg; later nearby legs cannot skip a fix. */
export function nearestLeg(
  path: ReturnType<typeof flyByRoute>,
  position: LatLon,
  leg: number,
) {
  let nearest: {
    index: number;
    distance: number;
    remaining: number;
    cross: number;
  } | null = null;
  for (let i = 0; i < path.legs.length; i++) {
    if (path.legs[i] !== leg) continue;
    const a = path.points[i]!,
      b = path.points[i + 1]!;
    const length = distanceNm(a, b);
    const offset = trackOffset(a, b, position);
    const along = Math.max(0, Math.min(length, offset.alongTrackNm));
    const distance =
      offset.alongTrackNm < 0
        ? distanceNm(position, a)
        : offset.alongTrackNm > length
          ? distanceNm(position, b)
          : Math.abs(offset.crossTrackNm);
    if (!nearest || distance < nearest.distance)
      nearest = {
        index: i,
        distance,
        remaining: length - along,
        cross: offset.crossTrackNm,
      };
  }
  return nearest;
}

/**
 * Measured motion sequences fly-by turns at the same live intercept as their countdown.
 * Without motion telemetry, use the planned tangent; distances follow the drawn path.
 * Unavailable turns retain waypoint passage sequencing; legs never move backwards.
 */
export function computeProgress(
  route: NavPoint[],
  position: LatLon & {
    groundSpeedKt?: number | null;
    trackDeg?: number | null;
    headingTrueDeg?: number;
    trueAirspeedKt?: number;
  },
  currentLeg: number,
  performance: TurnPerformance = { tasKt: 100 },
): Progress | null {
  if (route.length < 2) return null;
  const path = flyByRoute(route, performance);
  let leg = Math.min(Math.max(0, currentLeg), route.length - 2);
  while (leg < route.length - 2) {
    const from = route[leg]!;
    const to = route[leg + 1]!;
    const turn = path.turns.get(leg + 1);
    const liveTurn =
      turn &&
      position.groundSpeedKt != null &&
      position.trackDeg != null &&
      position.groundSpeedKt >= 30
        ? rateOneIntercept(
            {
              ...position,
              groundSpeedKt: position.groundSpeedKt,
              trackDeg: position.trackDeg,
            },
            to,
            route[leg + 2]!,
            {
              directionDeg: performance.windDirectionDeg ?? 0,
              speedKt: performance.windSpeedKt ?? 0,
            },
          )
        : null;
    const offset = trackOffset(from, to, position);
    // An exit dogleg can cross the original DCT's abeam plane early. Sequence
    // only at the end of its actual curve, including the next real fix's tangent.
    const curvedExit = leg === 0 && from.initialCourseDeg != null;
    const last = path.legs.lastIndexOf(leg);
    const endFrom = path.points[last]!,
      endTo = path.points[last + 1]!;
    const passed =
      curvedExit && last >= 0
        ? distanceNm(position, endTo) < 0.05 ||
          (nearestLeg(path, position, leg)?.index === last &&
            trackOffset(endFrom, endTo, position).alongTrackNm >=
              distanceNm(endFrom, endTo))
        : turn
          ? liveTurn
            ? liveTurn.seconds <= 0.5
            : (Math.abs(offset.crossTrackNm) <= 0.15 &&
                offset.alongTrackNm >= distanceNm(from, to) - turn.entryNm) ||
              offset.alongTrackNm >= distanceNm(from, to)
          : distanceNm(position, to) <
              (to.patternId || to.flyOver
                ? Math.min(0.05, distanceNm(from, to) * 0.2)
                : PASSED_NM) || offset.alongTrackNm >= distanceNm(from, to);
    if (!passed) break;
    leg++;
  }
  const from = route[leg]!;
  const next = route[leg + 1]!;
  const nearest = nearestLeg(path, position, leg);
  let distanceToNextNm = nearest
    ? nearest.remaining + nearest.distance
    : distanceNm(position, next);
  let distanceToDestinationNm = distanceToNextNm;
  for (
    let i = (nearest?.index ?? path.legs.length) + 1;
    i < path.legs.length;
    i++
  ) {
    const d = distanceNm(path.points[i]!, path.points[i + 1]!);
    distanceToDestinationNm += d;
    if (path.legs[i] === leg) distanceToNextNm += d;
  }
  const guidanceFrom = nearest ? path.points[nearest.index]! : from;
  const guidanceTo = nearest ? path.points[nearest.index + 1]! : next;
  return {
    activeLeg: leg,
    next,
    distanceToNextNm,
    bearingToNextDeg: initialBearingDeg(position, guidanceTo),
    desiredTrackDeg: initialBearingDeg(guidanceFrom, guidanceTo),
    crossTrackNm:
      nearest?.cross ?? trackOffset(from, next, position).crossTrackNm,
    distanceToDestinationNm,
  };
}

/** Direct-to: a new route from the present position to `target`, then the rest of the route after it. */
export function directTo(
  route: NavPoint[],
  position: LatLon,
  targetIndex: number,
): NavPoint[] {
  return [
    { ident: "DCT", lat: position.lat, lon: position.lon },
    ...route.slice(targetIndex),
  ];
}
