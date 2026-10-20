import type { RoutePoint } from "./route-plan";
import type { NavPoint } from "./progress";
import { distanceNm, trackOffset } from "./geo";

/** Profile events are map annotations, including events coincident with a real fix; never FPL waypoints. */
export function mapProfilePoints(
  points: Pick<
    RoutePoint,
    "id" | "lat" | "lon" | "isProfilePoint" | "profileLabels"
  >[],
  activeRoute?: NavPoint[],
) {
  return points.flatMap((point) => {
    if (
      activeRoute &&
      !activeRoute.some((to, i) => {
        const from = activeRoute[i - 1];
        if (!from || distanceNm(from, to) < 0.001) return false;
        const offset = trackOffset(from, to, point);
        return (
          Math.abs(offset.crossTrackNm) < 0.3 &&
          offset.alongTrackNm >= -0.01 &&
          offset.alongTrackNm <= distanceNm(from, to) + 0.01
        );
      })
    )
      return [];
    return [
      ...new Set([
        ...(point.isProfilePoint ? [point.id] : []),
        ...(point.profileLabels ?? []),
      ]),
    ]
      .filter((id): id is "TOC" | "TOD" => id === "TOC" || id === "TOD")
      .map((id) => ({ id, lat: point.lat, lon: point.lon }));
  });
}
