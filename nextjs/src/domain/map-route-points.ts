import { distanceNm } from "./geo";
import { mapSearchKey } from "./map-search";
import type { FlightPoint } from "~/data/flight";

/** Route markers replace their ordinary chart symbol/label, without removing the search catalogue. */
export function withoutRoutePoints<
  T extends FlightPoint & { aliases?: string[] },
>(points: T[], route: FlightPoint[], routeVisible: boolean): T[] {
  if (!routeVisible || !route.length) return points;
  const byId = new Map<string, FlightPoint[]>();
  for (const point of route) {
    const key = mapSearchKey(point.ident);
    if (key) byId.set(key, [...(byId.get(key) ?? []), point]);
  }
  return points.filter(
    (point) =>
      ![point.ident, ...(point.aliases ?? [])].some((id) =>
        byId.get(mapSearchKey(id))?.some((fix) => distanceNm(point, fix) < 0.3),
      ),
  );
}
