import {
  distanceNm,
  destinationPoint,
  initialBearingDeg,
  type LatLon,
} from "./geo";
import { flyByRoute, type TurnPerformance } from "./fly-by";
import { nearestLeg, type NavPoint } from "./progress";
import { pointKey, type RoutePlan } from "./route-plan";

type ProfileRow = {
  point: NavPoint;
  routeIndex: number | null;
  distanceNm: number;
  altitudeFt: number;
  event?: "TOC" | "TOD";
};

/** Display-only events and heights follow the active curved route; navigation indexes stay unchanged. */
export function flightPlanProfile(
  route: NavPoint[],
  plan: RoutePlan | null,
  performance: TurnPerformance,
  cruiseAltitudeFt: number,
) {
  const path = flyByRoute(route, performance);
  const distances = [0];
  for (let i = 1; i < path.points.length; i++)
    distances.push(
      distances[i - 1]! + distanceNm(path.points[i - 1]!, path.points[i]!),
    );
  const totalNm = distances.at(-1) ?? 0;
  // Work backwards so a return to the departure airport uses the arrival occurrence.
  const indexes: (number | null)[] = Array.from(
    { length: route.length },
    () => null,
  );
  let cursor = plan?.points.length ?? 0;
  for (let i = route.length - 1; i >= 0; i--) {
    if (route[i]!.ident === "DCT") continue;
    for (let k = cursor - 1; k >= 0; k--) {
      const p = plan!.points[k]!;
      const separationNm = distanceNm(p, route[i]!);
      // A flight started before reference data loads can retain rounded saved ARP coordinates.
      const savedAirport =
        p.kind === "airport" && p.id === route[i]!.ident && separationNm < 0.3;
      if (!p.isProfilePoint && (separationNm < 0.001 || savedAirport)) {
        indexes[i] = k;
        cursor = k;
        break;
      }
    }
  }
  const rows: ProfileRow[] = route.map((point, i) => {
    const index = indexes[i];
    const original = index == null ? undefined : plan?.points[index];
    const end = i === 0 ? 0 : path.legs.lastIndexOf(i - 1) + 1;
    return {
      point,
      routeIndex: i,
      distanceNm: distances[end] ?? totalNm,
      altitudeFt:
        point.altitudeFt ??
        (original ? plan?.pointAltitudeByKey[pointKey(original)] : undefined) ??
        cruiseAltitudeFt,
    };
  });
  for (let i = 0; i < route.length; i++) {
    const index = indexes[i];
    if (index == null || !plan) continue;
    const original = plan.points[index]!;
    for (const id of original.profileLabels ?? []) {
      if (id === "TOC" || id === "TOD")
        rows.push({
          ...rows[i]!,
          point: { ...route[i]!, ident: id },
          routeIndex: null,
          event: id,
        });
    }
    const previous = indexes[i - 1];
    if (previous == null) continue;
    const between = plan.points.slice(previous + 1, index);
    if (between.some((p) => !p.isProfilePoint)) continue;
    for (const event of between) {
      if (event.id !== "TOC" && event.id !== "TOD") continue;
      const projection = nearestLeg(path, event, i - 1);
      if (!projection) continue;
      const distance = distances[projection.index + 1]! - projection.remaining;
      const a = path.points[projection.index]!,
        b = path.points[projection.index + 1]!;
      const location = destinationPoint(
        a,
        initialBearingDeg(a, b),
        distance - distances[projection.index]!,
      );
      rows.push({
        point: { ...location, ident: event.id },
        routeIndex: null,
        event: event.id,
        distanceNm: distance,
        altitudeFt:
          plan.pointAltitudeByKey[pointKey(event)] ?? cruiseAltitudeFt,
      });
    }
  }
  rows.sort(
    (a, b) =>
      a.distanceNm - b.distanceNm || Number(!!a.event) - Number(!!b.event),
  );
  const samples: (LatLon & { distanceNm: number; altitudeFt: number })[] = [];
  const spacingNm = Math.max(0.1, totalNm / 4096);
  let anchor = 0;
  for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1]!,
      b = path.points[i]!;
    const length = distances[i]! - distances[i - 1]!;
    const count = Math.max(1, Math.ceil(length / spacingNm));
    for (let k = samples.length ? 1 : 0; k <= count; k++) {
      const distance = distances[i - 1]! + (length * k) / count;
      while (
        anchor < rows.length - 2 &&
        rows[anchor + 1]!.distanceNm < distance
      )
        anchor++;
      const from = rows[anchor],
        to = rows[anchor + 1] ?? from;
      const fraction =
        from && to && to.distanceNm > from.distanceNm
          ? Math.max(
              0,
              Math.min(
                1,
                (distance - from.distanceNm) /
                  (to.distanceNm - from.distanceNm),
              ),
            )
          : 0;
      samples.push({
        ...destinationPoint(a, initialBearingDeg(a, b), (length * k) / count),
        distanceNm: distance,
        altitudeFt:
          from && to
            ? from.altitudeFt + fraction * (to.altitudeFt - from.altitudeFt)
            : cruiseAltitudeFt,
      });
    }
  }
  return { path, distances, rows, samples, totalNm };
}

/** Project only onto the sequenced leg, including circuits and crossing/parallel route sections. */
export function profileAircraftDistance(
  profile: ReturnType<typeof flightPlanProfile>,
  position: LatLon,
  activeLeg: number,
) {
  const projection = nearestLeg(profile.path, position, activeLeg);
  return projection
    ? {
        distanceNm:
          profile.distances[projection.index + 1]! - projection.remaining,
        crossTrackNm: projection.distance,
      }
    : null;
}

/** Interpolate the same planned altitude line shown in the FPL vertical profile. */
export function profileAltitudeAtDistance(
  profile: ReturnType<typeof flightPlanProfile>,
  distanceNm: number,
) {
  if (!Number.isFinite(distanceNm) || profile.rows.length < 2) return null;
  const rows = profile.rows;
  if (distanceNm <= rows[0]!.distanceNm) return rows[0]!.altitudeFt;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!,
      b = rows[i]!;
    if (distanceNm <= b.distanceNm && b.distanceNm > a.distanceNm) {
      const fraction =
        (distanceNm - a.distanceNm) / (b.distanceNm - a.distanceNm);
      return a.altitudeFt + fraction * (b.altitudeFt - a.altitudeFt);
    }
  }
  return rows.at(-1)!.altitudeFt;
}

/** Missing DEM samples split the filled profile; they never imply zero terrain height. */
export function terrainProfileSections<T extends { terrainFt: number | null }>(
  samples: T[],
) {
  const sections: T[][] = [];
  let current: T[] = [];
  for (const sample of samples) {
    if (sample.terrainFt !== null && Number.isFinite(sample.terrainFt))
      current.push(sample);
    else if (current.length) {
      sections.push(current);
      current = [];
    }
  }
  if (current.length) sections.push(current);
  return sections;
}
