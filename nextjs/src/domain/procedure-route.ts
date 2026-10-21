import { sameFlightPoint } from "./waypoint-insertion";
import { type NavPoint } from "./progress";
import { type LatLon } from "./geo";

/** A procedure edit retains flown fixes and the current leg when its target still exists. */
export function procedureRoute(
  route: NavPoint[],
  activeLeg: number,
  planned: NavPoint[],
  departure: boolean,
  position: LatLon | null,
) {
  if (planned.length < 2) return null;
  if (departure || route.length < 2) return { route: planned, activeLeg: 0 };
  const leg = Math.min(Math.max(0, activeLeg), route.length - 2);
  const prefix = route.slice(0, leg + 1);
  const target = planned.findIndex((p) => sameFlightPoint(p, route[leg + 1]!));
  const anchor = prefix.reduce((found, p) => {
    const index = planned.findIndex((q) => sameFlightPoint(p, q));
    return index >= 0 ? index : found;
  }, 0);
  if (target === anchor + 1)
    return { route: [...prefix, ...planned.slice(target)], activeLeg: leg };
  const tail = planned.slice(anchor + 1);
  if (!tail.length) return null;
  return position
    ? {
        route: [...prefix, { ident: "DCT", ...position }, ...tail],
        activeLeg: prefix.length,
      }
    : { route: [...prefix, ...tail], activeLeg: leg };
}
