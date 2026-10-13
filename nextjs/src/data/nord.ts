import { z } from "zod";

import {
  type Flight,
  type FlightPoint,
  newFlight,
  flightSchema,
  pointRestrictionSchema,
} from "./flight";

/**
 * Legacy `.nord` flight files (format "nordsweet.flight", version 1) and the planner's saved routes
 * (localStorage `nordsweet.savedRoutes.v1`, same `route` shape). Imports are lenient — these come
 * from users' files — but anything without usable coordinates is rejected.
 */
const numberish = z
  .union([z.number(), z.string()])
  .transform((v) => Number(v))
  .pipe(z.number());

const anchorEnd = z.preprocess(
  (value) => (typeof value === "string" ? { id: value } : value),
  z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    lat: numberish.optional(),
    lon: numberish.optional(),
  }),
);
const anchorSchema = z
  .object({ from: anchorEnd, to: anchorEnd })
  .transform(({ from, to }) => ({
    from: (from.id ?? from.name ?? "").trim().toUpperCase(),
    to: (to.id ?? to.name ?? "").trim().toUpperCase(),
    ...(from.lat !== undefined && from.lon !== undefined
      ? { fromPosition: { lat: from.lat, lon: from.lon } }
      : {}),
    ...(to.lat !== undefined && to.lon !== undefined
      ? { toPosition: { lat: to.lat, lon: to.lon } }
      : {}),
  }));

const nordRoute = z.object({
  pointRestrictions: z.record(z.string(), pointRestrictionSchema).optional(),
  waypointRestrictions: z.record(z.string(), pointRestrictionSchema).optional(),
  id: z.string().optional(),
  name: z.string().optional(),
  customName: z.string().optional(),
  displayName: z.string().optional(),
  title: z.string().optional(),
  savedAt: z.string().optional(),
  aircraftType: z.string().optional(),
  aircraftRegistration: z.string().optional(),
  departureIcao: z.string().optional(),
  destinationIcao: z.string().optional(),
  alternateIcao: z.string().optional(),
  altitudeFt: numberish.optional(),
  cruiseSpeedKt: numberish.optional(),
  routeText: z.string().optional(),
  sid: z.string().optional(),
  star: z.string().optional(),
  approach: z.string().optional(),
  plannerCruiseSpeedEco: z.boolean().optional(),
  insertedWaypoints: z
    .array(
      z.object({
        id: z.string().optional(),
        label: z.string().optional(),
        name: z.string().optional(),
        lat: numberish,
        lon: numberish,
        anchor: anchorSchema.optional(),
      }),
    )
    .optional(),
  waypointAltitudes: z.record(z.string(), numberish).optional(),
  waypointWx: z
    .record(
      z.string(),
      z.array(
        z.object({
          altitudeFt: z.coerce.string(),
          windDirection: z.coerce.string(),
          windSpeed: z.coerce.string(),
        }),
      ),
    )
    .optional(),
  schedule: z
    .object({
      departure: z.string().optional(),
      departureManual: z.boolean().optional(),
      destination: z.string().optional(),
      destinationManual: z.boolean().optional(),
    })
    .optional(),
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
  plannerState: flightSchema.optional(),
});

type NordRoute = z.infer<typeof nordRoute>;

/** Legacy profile keys ("A-1A HUSKY", "C152" + "SPRBB") → aircraft ids ("A-1A-HUSKY", "C152-SPRBB"). */
export function legacyAircraftId(
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

/** "NONE" or empty → no procedure; "AUTO" or a procedure id as stored. */
const selection = (value: string | undefined) =>
  !value || value.toUpperCase() === "NONE" ? null : value;

/** The fields legacy "Load Route" replaces (route only: aircraft, loading and fuel stay). */
export function nordRouteFields(flight: Flight) {
  const {
    departure,
    destination,
    waypoints,
    pointRestrictions,
    routeText,
    sid,
    star,
    approach,
    cruiseAltitudeFt,
    cruiseTasKt,
    cruiseSpeedEco,
    waypointAltitudes,
    waypointWx,
    schedule,
  } = flight;
  return {
    departure,
    destination,
    waypoints,
    pointRestrictions,
    routeText,
    sid,
    star,
    approach,
    inlineProcedureSelections: {},
    cruiseAltitudeFt,
    cruiseTasKt,
    cruiseSpeedEco,
    waypointAltitudes,
    waypointWx,
    schedule,
  };
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
    name:
      [route.customName, route.displayName, route.title, route.name].find(
        (name) => name?.trim(),
      ) ?? "",
    savedAt:
      route.savedAt && !Number.isNaN(Date.parse(route.savedAt))
        ? new Date(route.savedAt).toISOString()
        : flight.savedAt,
    aircraftId: legacyAircraftId(
      route.aircraftType,
      route.aircraftRegistration,
      knownAircraftIds,
    ),
    registration: route.aircraftRegistration?.trim() ?? "",
    pointRestrictions:
      route.pointRestrictions ?? route.waypointRestrictions ?? {},
    departure: toPoint(points[0]!),
    destination: toPoint(points.at(-1)!),
    // The legacy file stores only the alternate's code; it is resolved against the airport list by the caller.
    alternate: null,
    ...(route.routeText === undefined
      ? // Files without route text: every planned point between the airports is a waypoint.
        { waypoints: points.slice(1, -1).map(toPoint) }
      : {
          routeText: route.routeText,
          waypoints: (route.insertedWaypoints ?? []).flatMap((w) => {
            const ident = (w.label ?? w.name ?? w.id ?? "")
              .trim()
              .toUpperCase();
            return ident
              ? [{ ident, lat: w.lat, lon: w.lon, anchor: w.anchor }]
              : [];
          }),
        }),
    sid: selection(route.sid),
    star: selection(route.star),
    approach: selection(route.approach),
    cruiseSpeedEco: route.plannerCruiseSpeedEco ?? false,
    waypointAltitudes: Object.fromEntries(
      Object.entries(route.waypointAltitudes ?? {})
        .filter(([, v]) => Number.isFinite(v) && v >= 0)
        .map(([k, v]) => [k.toUpperCase(), Math.round(v)]),
    ),
    waypointWx: route.waypointWx ?? {},
    // Legacy keeps both times with "manual" flags; only manual ones are inputs here.
    schedule: {
      departure:
        route.schedule?.departureManual !== false
          ? (route.schedule?.departure ?? "")
          : "",
      destination:
        route.schedule?.destinationManual !== false
          ? (route.schedule?.destination ?? "")
          : "",
    },
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
    flight: flightSchema.parse(
      doc.plannerState
        ? {
            ...doc.plannerState,
            aircraftId:
              doc.plannerState.aircraftId &&
              knownAircraftIds.includes(doc.plannerState.aircraftId)
                ? doc.plannerState.aircraftId
                : null,
          }
        : flightFromNordRoute(doc.route, knownAircraftIds),
    ),
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
  /** The planned route (all points); defaults to departure, waypoints, destination. */
  points: (FlightPoint & { altitudeFt?: number })[] = [
    flight.departure,
    ...flight.waypoints,
    flight.destination,
  ].filter((p): p is FlightPoint => p !== null),
) {
  return JSON.stringify(
    {
      plannerState: flightSchema.parse(flight),
      format: "nordsweet.flight",
      savedAt: flight.savedAt,
      version: 1,
      route: {
        id: flight.id,
        name: flight.name,
        savedAt: flight.savedAt,
        aircraftType: aircraftType ?? "",
        aircraftRegistration: flight.registration,
        departureIcao: flight.departure?.ident ?? "",
        destinationIcao: flight.destination?.ident ?? "",
        alternateIcao: flight.alternate?.ident ?? "",
        altitudeFt: String(flight.cruiseAltitudeFt),
        cruiseSpeedKt: String(flight.cruiseTasKt),
        routeText: flight.routeText,
        approach: flight.approach ?? "NONE",
        sid: flight.sid ?? "NONE",
        star: flight.star ?? "NONE",
        plannerCruiseSpeedEco: flight.cruiseSpeedEco,
        waypointRestrictions: Object.fromEntries(
          Object.entries(flight.pointRestrictions).map(([key, value]) => [
            key,
            {
              ...(value.speedKt === null ? {} : { speedKt: value.speedKt }),
              ...(value.altitudeFt === null
                ? {}
                : {
                    altitudeFt: value.altitudeFt,
                    altitudeMode: value.altitudeMode,
                  }),
            },
          ]),
        ),
        insertedWaypoints: flight.waypoints.map((p) => ({
          id: p.ident,
          label: p.ident,
          lat: p.lat,
          lon: p.lon,
          anchor: p.anchor
            ? {
                from: { id: p.anchor.from, ...p.anchor.fromPosition },
                to: { id: p.anchor.to, ...p.anchor.toPosition },
              }
            : undefined,
        })),
        waypointAltitudes: Object.fromEntries(
          Object.entries(flight.waypointAltitudes).map(([k, v]) => [
            k,
            String(v),
          ]),
        ),
        waypointWx: flight.waypointWx,
        schedule: {
          departure: flight.schedule.departure,
          departureManual: !!flight.schedule.departure,
          destination: flight.schedule.destination,
          destinationManual: !!flight.schedule.destination,
          open: "",
        },
        plan: {
          altitudeFt: flight.cruiseAltitudeFt,
          cruiseSpeedKt: flight.cruiseTasKt,
          points: points.map((p) => ({
            id: p.ident,
            name: p.ident,
            lat: p.lat,
            lon: p.lon,
            altitudeFt: p.altitudeFt ?? flight.cruiseAltitudeFt,
          })),
        },
      },
    },
    null,
    2,
  );
}
