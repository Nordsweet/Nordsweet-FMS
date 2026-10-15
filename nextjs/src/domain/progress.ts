import { type LatLon, distanceNm, initialBearingDeg, trackOffset } from "./geo";

export type NavPoint = LatLon & {
  ident: string;
  patternId?: string;
  altitudeFt?: number;
};

/** Within this distance of the next waypoint it counts as passed even if not yet abeam. */
const PASSED_NM = 0.3;

export type Progress = {
  /** Index of the leg being flown: route[active] → route[active + 1]. */
  activeLeg: number;
  next: NavPoint;
  distanceToNextNm: number;
  /** True bearing from present position to the next waypoint. */
  bearingToNextDeg: number;
  /** True course of the active leg (desired track). */
  desiredTrackDeg: number;
  /** Positive = right of track. */
  crossTrackNm: number;
  distanceToDestinationNm: number;
};

/**
 * Leg sequencing: keeps the current leg until its waypoint is passed (abeam or within 0.3 NM),
 * then moves on. Never goes backwards, so a turn short of a waypoint does not flip legs.
 */
export function computeProgress(
  route: NavPoint[],
  position: LatLon,
  currentLeg: number,
): Progress | null {
  if (route.length < 2) return null;
  let leg = Math.min(Math.max(0, currentLeg), route.length - 2);
  while (leg < route.length - 2) {
    const from = route[leg]!;
    const to = route[leg + 1]!;
    const passed =
      distanceNm(position, to) <
        (to.patternId
          ? Math.min(0.05, distanceNm(from, to) * 0.2)
          : PASSED_NM) ||
      trackOffset(from, to, position).alongTrackNm >= distanceNm(from, to);
    if (!passed) break;
    leg++;
  }
  const from = route[leg]!;
  const next = route[leg + 1]!;
  const distanceToNextNm = distanceNm(position, next);
  let distanceToDestinationNm = distanceToNextNm;
  for (let i = leg + 1; i < route.length - 1; i++)
    distanceToDestinationNm += distanceNm(route[i]!, route[i + 1]!);
  return {
    activeLeg: leg,
    next,
    distanceToNextNm,
    bearingToNextDeg: initialBearingDeg(position, next),
    desiredTrackDeg: initialBearingDeg(from, next),
    crossTrackNm: trackOffset(from, next, position).crossTrackNm,
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
