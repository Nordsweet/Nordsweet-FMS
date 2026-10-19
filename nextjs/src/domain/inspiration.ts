import { type FlightPoint } from "~/data/flight";
import { distanceNm, type LatLon } from "./geo";

export const INSPIRATION_KINDS = ["airfield", "scenic", "attraction"] as const;
export const INSPIRATION_INTERESTS = [
  "aviation",
  "history",
  "nature",
  "coast",
  "lakes",
  "mountains",
  "city",
] as const;

type Stop = LatLon & { id: string; icao: string | null };
type Spot = Stop & { kind: string; interests: string[] };
type Route = { interests: string[]; distance_nm: number; stops: Stop[] };

export type InspirationFilters = {
  /** Null: no limit. Both limits need an origin. */
  maxDistanceNm: number | null;
  maxMinutes: number | null;
  interests: string[];
  kinds: string[];
  favoritesOnly: boolean;
};

/** Straight-line time at the plan's cruise TAS, no wind: a rough "is it worth it", not a flight-time estimate. */
export const flightMinutes = (distanceNm: number, cruiseKt: number) =>
  Math.round((distanceNm / cruiseKt) * 60);

/** What it takes to fly an idea from `origin`: a spot is a direct leg, a route is the leg to its start plus the route. */
export function spotTrip(spot: Spot, origin: LatLon | null) {
  return origin ? distanceNm(origin, spot) : null;
}
export function routeTrip(route: Route, origin: LatLon | null) {
  const first = route.stops[0];
  return route.distance_nm + (origin && first ? distanceNm(origin, first) : 0);
}

function withinLimits(
  tripNm: number | null,
  f: InspirationFilters,
  cruiseKt: number,
) {
  if (tripNm === null) return true; // no origin: nothing to measure the limits against
  return (
    (f.maxDistanceNm === null || tripNm <= f.maxDistanceNm) &&
    (f.maxMinutes === null || flightMinutes(tripNm, cruiseKt) <= f.maxMinutes)
  );
}
const anyInterest = (have: string[], want: string[]) =>
  want.length === 0 || want.some((i) => have.includes(i));

export function filterSpots<T extends Spot>(
  spots: T[],
  f: InspirationFilters,
  origin: LatLon | null,
  cruiseKt: number,
  favorites: readonly string[],
) {
  return spots
    .filter(
      (s) =>
        (f.kinds.length === 0 || f.kinds.includes(s.kind)) &&
        anyInterest(s.interests, f.interests) &&
        (!f.favoritesOnly || favorites.includes(s.id)) &&
        withinLimits(spotTrip(s, origin), f, cruiseKt),
    )
    .sort(
      (a, b) => (spotTrip(a, origin) ?? 0) - (spotTrip(b, origin) ?? 0), // stable: list order without an origin
    );
}

export function filterRoutes<T extends Route & { id: string }>(
  routes: T[],
  f: InspirationFilters,
  origin: LatLon | null,
  cruiseKt: number,
  favorites: readonly string[],
) {
  return routes.filter(
    (r) =>
      anyInterest(r.interests, f.interests) &&
      (!f.favoritesOnly || favorites.includes(r.id)) &&
      withinLimits(origin ? routeTrip(r, origin) : null, f, cruiseKt),
  );
}

/** Airports keep their ICAO code so the planner resolves them; anything else is a coordinate point named by its id. */
export const inspirationPoint = (stop: Stop): FlightPoint => ({
  ident: stop.icao ?? stop.id.toUpperCase(),
  lat: stop.lat,
  lon: stop.lon,
});

/** First stop departs, last arrives, the rest are waypoints in flying order. */
export function routeToPlan(stops: Stop[]) {
  const points = stops.map(inspirationPoint);
  return {
    departure: points[0] ?? null,
    destination: points.length > 1 ? (points.at(-1) ?? null) : null,
    waypoints: points.slice(1, -1),
  };
}

/** The OSM tile (2x2 around the spot, so it sits near the middle) and the spot's position in that 512 px square. */
export function tilePreview({ lat, lon }: LatLon, zoom = 9) {
  const n = 2 ** zoom;
  const x = ((lon + 180) / 360) * n;
  const sinLat = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * n;
  const x0 = Math.floor(x - 0.5);
  const y0 = Math.floor(y - 0.5);
  return {
    zoom,
    tiles: [0, 1].flatMap((dy) =>
      [0, 1].map((dx) => ({ x: x0 + dx, y: y0 + dy, dx, dy })),
    ),
    /** Position of the spot inside the 2x2 square, px (tile size 256). */
    offsetPx: { x: (x - x0) * 256, y: (y - y0) * 256 },
  };
}

/** Points of a route scaled into a `size` square (equirectangular, longitude shrunk by latitude). */
export function routeOutline(stops: LatLon[], size = 100, pad = 10) {
  if (stops.length === 0) return [];
  const midLat = stops.reduce((s, p) => s + p.lat, 0) / stops.length;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = stops.map((p) => p.lon * k);
  const ys = stops.map((p) => -p.lat);
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = (size - 2 * pad) / span;
  const offX = (size - (maxX - minX) * scale) / 2;
  const offY = (size - (maxY - minY) * scale) / 2;
  return stops.map((_, i) => ({
    x: offX + (xs[i]! - minX) * scale,
    y: offY + (ys[i]! - minY) * scale,
  }));
}
