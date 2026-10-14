import { type Flight, type FlightPoint } from "~/data/flight";
import { distanceNm } from "./geo";

const samePoint = (a: FlightPoint, b: FlightPoint) =>
  a.ident.trim().toUpperCase() === b.ident.trim().toUpperCase() &&
  Math.abs(a.lat - b.lat) < 0.00001 &&
  Math.abs(a.lon - b.lon) < 0.00001;

/** Prefer the leg with the smallest added distance, keeping planned endpoints at the ends. */
export function optimalWaypointIndex(route: FlightPoint[], point: FlightPoint) {
  if (route.length < 2) return route.length;
  let index = 1,
    best = Infinity;
  for (let i = 1; i < route.length; i++) {
    const score = Math.max(
      0,
      distanceNm(route[i - 1]!, point) +
        distanceNm(point, route[i]!) -
        distanceNm(route[i - 1]!, route[i]!),
    );
    if (score < best) {
      index = i;
      best = score;
    }
  }
  return index;
}

/** Persist an explicit before/after target, so recalculation cannot move the chosen waypoint. */
export function anchoredWaypoint(
  route: FlightPoint[],
  point: FlightPoint,
  index: number,
): FlightPoint {
  const at = Math.max(0, Math.min(route.length, index));
  const target = route[at] ?? route.at(-1);
  if (!target) return { ident: point.ident, lat: point.lat, lon: point.lon };
  const from = route[at - 1] ?? target;
  return {
    ident: point.ident,
    lat: point.lat,
    lon: point.lon,
    anchor: {
      from: from.ident,
      to: target.ident,
      fromPosition: { lat: from.lat, lon: from.lon },
      toPosition: { lat: target.lat, lon: target.lon },
      placement: at < route.length ? "before" : "after",
      occurrence: route
        .slice(0, at < route.length ? at : route.length - 1)
        .filter((p) => samePoint(p, target)).length,
    },
  };
}

/** Resolve saved explicit order; old leg anchors retain their adjacent-leg behavior. */
export function waypointInsertionIndex(
  route: FlightPoint[],
  point: FlightPoint,
) {
  const anchor = point.anchor;
  if (anchor?.placement) {
    const target = {
      ident: anchor.placement === "before" ? anchor.to : anchor.from,
      ...(anchor.placement === "before"
        ? anchor.toPosition
        : anchor.fromPosition),
    };
    const matches = route.flatMap((p, i) =>
      p.ident.trim().toUpperCase() === target.ident.trim().toUpperCase() &&
      (target.lat === undefined ||
        target.lon === undefined ||
        samePoint(p, { ...target, lat: target.lat, lon: target.lon }))
        ? [i]
        : [],
    );
    const at = matches[anchor.occurrence ?? 0];
    if (at !== undefined) return at + (anchor.placement === "after" ? 1 : 0);
  } else if (anchor) {
    const matches = (
      p: FlightPoint,
      id: string,
      position?: { lat: number; lon: number },
    ) =>
      p.ident === id ||
      (!!position &&
        Math.abs(p.lat - position.lat) < 0.00001 &&
        Math.abs(p.lon - position.lon) < 0.00001);
    const from = route.findIndex((p) =>
      matches(p, anchor.from, anchor.fromPosition),
    );
    const to = route.findIndex(
      (p, i) => i > from && matches(p, anchor.to, anchor.toPosition),
    );
    if (from >= 0 && to === from + 1) return to;
  }
  return optimalWaypointIndex(route, point);
}

/** Coordinate/GPX plans use the same explicit insertion anchors as airport-based plans. */
export function fallbackFlightRoute(
  flight: Pick<Flight, "departure" | "destination" | "waypoints">,
) {
  const route = [flight.departure, flight.destination].filter(
    (p): p is FlightPoint => p !== null,
  );
  for (const point of flight.waypoints) {
    const at = point.anchor
      ? waypointInsertionIndex(route, point)
      : flight.destination
        ? Math.max(0, route.length - 1)
        : route.length;
    route.splice(at, 0, point);
  }
  return route;
}
