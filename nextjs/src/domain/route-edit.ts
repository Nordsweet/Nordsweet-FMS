import { type Flight } from "~/data/flight";
import { type RoutePoint } from "./route-plan";

/** Stable occurrence keys keep a deleted published fix out of subsequent recalculations. */
export function routeEditKeys(points: RoutePoint[]) {
  const occurrences = new Map<string, number>();
  return points.map((point) => {
    const key = `${point.id}:${point.lat.toFixed(6)}:${point.lon.toFixed(6)}`;
    const occurrence = occurrences.get(key) ?? 0;
    occurrences.set(key, occurrence + 1);
    return `${key}:${occurrence}`;
  });
}

/** Clear navigation inputs while retaining the aircraft, fuel and performance configuration. */
export const clearedRoute: Partial<Flight> = {
  departure: null,
  destination: null,
  alternate: null,
  routeText: "",
  waypoints: [],
  removedRoutePoints: [],
  sid: null,
  star: null,
  approach: null,
  inlineProcedureSelections: {},
  departurePattern: null,
  departureRunway: null,
  trafficPattern: null,
  holding: null,
  arrivalToArp: false,
  waypointAltitudes: {},
  waypointWx: {},
  pointRestrictions: {},
};
