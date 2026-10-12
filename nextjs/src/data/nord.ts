import { z } from "zod";

import { type Flight, type FlightPoint, newFlight } from "./flight";

/**
 * Legacy `.nord` flight files (format "nordsweet.flight", version 1) and the planner's saved routes
 * (localStorage `nordsweet.savedRoutes.v1`, same `route` shape). Imports are lenient — these come
 * from users' files — but anything without usable coordinates is rejected.
 */
const numberish = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .pipe(z.number());

const nordRoute = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  savedAt: z.string().optional(),
  aircraftType: z.string().optional(),
  aircraftRegistration: z.string().optional(),
  departureIcao: z.string().optional(),
  destinationIcao: z.string().optional(),
  alternateIcao: z.string().optional(),
  altitudeFt: numberish.optional(),
  cruiseSpeedKt: numberish.optional(),
  plan: z
    .object({
      points: z.array(
        z.object({
          id: z.string(),
          lat: z.number(),
          lon: z.number(),
          altitudeFt: z.number().optional(),
        }),
      ),
    })
    .optional(),
});

export const nordDocumentSchema = z.object({
  format: z.literal("nordsweet.flight"),
  version: z.number(),
  route: nordRoute,
});

type NordRoute = z.infer<typeof nordRoute>;

/** Legacy profile keys ("A-1A HUSKY", "C152" + "SPRBB") → aircraft ids ("A-1A-HUSKY", "C152-SPRBB"). */
function aircraftId(
  type: string | undefined,
  registration: string | undefined,
  known: readonly string[],
) {
  if (!type) return null;
  const base = type.trim().toUpperCase().replace(/\s+/g, "-");
  const reg = registration
    ?.trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (reg && known.includes(`${base}-${reg}`)) return `${base}-${reg}`;
  return known.includes(base) ? base : null;
}

export function flightFromNordRoute(
  route: NordRoute,
  knownAircraftIds: readonly string[],
): Flight {
  const points = (route.plan?.points ?? []).filter(
    (p) => p.id !== "TOC" && p.id !== "TOD",
  );
  // A local flight (departure = destination) is stored as a single point.
  if (points.length < 1) throw new Error("Flight file has no route points");
  const toPoint = (p: (typeof points)[number]): FlightPoint => ({
    ident: p.id,
    lat: p.lat,
    lon: p.lon,
  });
  const flight = newFlight();
  return {
    ...flight,
    id: route.id ?? flight.id,
    name: route.name ?? "",
    savedAt:
      route.savedAt && !Number.isNaN(Date.parse(route.savedAt))
        ? new Date(route.savedAt).toISOString()
        : flight.savedAt,
    aircraftId: aircraftId(
      route.aircraftType,
      route.aircraftRegistration,
      knownAircraftIds,
    ),
    departure: toPoint(points[0]!),
    destination: toPoint(points.at(-1)!),
    // The legacy file stores only the alternate's code; it is resolved against the airport list by the caller.
    alternate: null,
    waypoints: points.slice(1, -1).map(toPoint),
    cruiseAltitudeFt:
      route.altitudeFt && route.altitudeFt > 0
        ? route.altitudeFt
        : flight.cruiseAltitudeFt,
    cruiseTasKt:
      route.cruiseSpeedKt && route.cruiseSpeedKt > 0
        ? route.cruiseSpeedKt
        : flight.cruiseTasKt,
  };
}

export function parseNordFile(
  text: string,
  knownAircraftIds: readonly string[],
) {
  const doc = nordDocumentSchema.parse(JSON.parse(text));
  return {
    flight: flightFromNordRoute(doc.route, knownAircraftIds),
    alternateCode:
      doc.route.alternateIcao?.trim() === ""
        ? null
        : (doc.route.alternateIcao ?? null),
  };
}

/** Writes a file the legacy planner can still open. */
export function toNordFile(
  flight: Flight,
  aircraftType: string | null,
  /** Full route incl. SID/STAR legs; defaults to departure, waypoints, destination. */
  points: FlightPoint[] = [
    flight.departure,
    ...flight.waypoints,
    flight.destination,
  ].filter((p): p is FlightPoint => p !== null),
) {
  return JSON.stringify(
    {
      format: "nordsweet.flight",
      savedAt: flight.savedAt,
      version: 1,
      route: {
        id: flight.id,
        name: flight.name,
        savedAt: flight.savedAt,
        aircraftType: aircraftType ?? "",
        aircraftRegistration: "",
        departureIcao: flight.departure?.ident ?? "",
        destinationIcao: flight.destination?.ident ?? "",
        alternateIcao: flight.alternate?.ident ?? "",
        altitudeFt: String(flight.cruiseAltitudeFt),
        cruiseSpeedKt: String(flight.cruiseTasKt),
        routeText: flight.waypoints.map((p) => p.ident).join(" "),
        approach: "NONE",
        sid: flight.sid ?? "NONE",
        star: flight.star ?? "NONE",
        plan: {
          altitudeFt: flight.cruiseAltitudeFt,
          cruiseSpeedKt: flight.cruiseTasKt,
          points: points.map((p) => ({
            id: p.ident,
            name: p.ident,
            lat: p.lat,
            lon: p.lon,
            altitudeFt: flight.cruiseAltitudeFt,
          })),
        },
      },
    },
    null,
    2,
  );
}
