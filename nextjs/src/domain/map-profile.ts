import type { RoutePoint } from "./route-plan";
import type { NavPoint } from "./progress";
import { distanceNm, trackOffset } from "./geo";
import type { LatLon } from "./geo";

/** Place annotations on the same straight Mercator segments rendered by the map, including fly-by arcs. */
function onRenderedPath(point: LatLon, path: LatLon[]) {
  const y = (lat: number) =>
    Math.log(
      Math.tan(
        Math.PI / 4 + (Math.max(-85, Math.min(85, lat)) * Math.PI) / 360,
      ),
    );
  const wrap = (lon: number) => ((lon + 540) % 360) - 180;
  const py = y(point.lat);
  let best = Infinity;
  let result = point;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!,
      b = path[i]!;
    const ax = (wrap(a.lon - point.lon) * Math.PI) / 180;
    const bx = ax + (wrap(b.lon - a.lon) * Math.PI) / 180;
    const ay = y(a.lat) - py,
      by = y(b.lat) - py;
    const dx = bx - ax,
      dy = by - ay;
    const length = dx * dx + dy * dy;
    const t =
      length > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length)) : 0;
    const x = ax + t * dx,
      sy = ay + t * dy;
    const score = x * x + sy * sy;
    if (score < best) {
      best = score;
      result = {
        lon: wrap(point.lon + (x * 180) / Math.PI),
        lat: ((2 * Math.atan(Math.exp(py + sy)) - Math.PI / 2) * 180) / Math.PI,
      };
    }
  }
  return result;
}

/** Profile events are map annotations, including events coincident with a real fix; never FPL waypoints. */
export function mapProfilePoints(
  points: Pick<
    RoutePoint,
    "id" | "lat" | "lon" | "isProfilePoint" | "profileLabels"
  >[],
  activeRoute?: NavPoint[],
  renderedPath?: LatLon[],
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
      .map((id) => ({
        id,
        ...(renderedPath
          ? onRenderedPath(point, renderedPath)
          : { lat: point.lat, lon: point.lon }),
      }));
  });
}
