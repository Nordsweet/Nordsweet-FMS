import { type Flight, type FlightPoint } from "~/data/flight";
import { distanceNm } from "./geo";

type InsertionPoint = FlightPoint & {
  patternId?: string;
  patternOperation?: "join" | "leave";
};

/** Keep departure and arrival circuits intact, including their threshold and ARP. */
export function waypointInsertionSlots(route: InsertionPoint[]) {
  let first = 0;
  let last = route.length;
  route.forEach((p, i) => {
    if (!p.patternId) return;
    if (p.patternOperation === "leave") first = Math.max(first, i + 1);
    else last = Math.min(last, i);
  });
  return Array.from({ length: route.length + 1 }, (_, i) => i).filter(
    (i) => i >= first && i <= last,
  );
}

/** Also validate callers outside the dialog and anchors restored from older saved plans. */
export function safeWaypointIndex(route: InsertionPoint[], index: number) {
  const slots = waypointInsertionSlots(route);
  if (!slots.length) return null;
  return slots.reduce((best, slot) =>
    Math.abs(slot - index) < Math.abs(best - index) ? slot : best,
  );
}

/** Match a fix by identifier and position across saved plans and map data. */
export const sameFlightPoint = (a: FlightPoint, b: FlightPoint) =>
  a.ident.trim().toUpperCase() === b.ident.trim().toUpperCase() &&
  Math.abs(a.lat - b.lat) < 0.00001 &&
  Math.abs(a.lon - b.lon) < 0.00001;

/** Prefer the leg with the smallest added distance, keeping planned endpoints at the ends. */
export function optimalWaypointIndex(
  route: InsertionPoint[],
  point: FlightPoint,
) {
  if (route.length < 2)
    return safeWaypointIndex(route, route.length) ?? route.length;
  const slots = waypointInsertionSlots(route);
  let index = slots[0] ?? 0,
    best = Infinity;
  for (const i of slots) {
    if (i === 0 || i === route.length) continue;
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
  route: InsertionPoint[],
  point: FlightPoint,
  index: number,
): FlightPoint {
  const at = safeWaypointIndex(route, index) ?? route.length;
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
        .filter((p) => sameFlightPoint(p, target)).length,
    },
  };
}

/** Resolve saved explicit order; old leg anchors retain their adjacent-leg behavior. */
export function waypointInsertionIndex(
  route: InsertionPoint[],
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
        sameFlightPoint(p, { ...target, lat: target.lat, lon: target.lon }))
        ? [i]
        : [],
    );
    const at = matches[anchor.occurrence ?? 0];
    if (at !== undefined)
      return (
        safeWaypointIndex(route, at + (anchor.placement === "after" ? 1 : 0)) ??
        route.length
      );
    // Circuit fixes are regenerated after manual waypoints. Retain the other end of that leg.
    if (anchor.placement === "before") {
      const from = route
        .map(
          (p) =>
            p.ident === anchor.from &&
            (!anchor.fromPosition ||
              sameFlightPoint(p, {
                ident: anchor.from,
                ...anchor.fromPosition,
              })),
        )
        .lastIndexOf(true);
      if (from >= 0) return safeWaypointIndex(route, from + 1) ?? route.length;
    }
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
    if (from >= 0 && to === from + 1)
      return safeWaypointIndex(route, to) ?? route.length;
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
