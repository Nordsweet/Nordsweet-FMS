import { z } from "zod";

const point = z.object({
  ident: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});

const wind = z.object({
  directionDeg: z.number(),
  speedKt: z.number().nonnegative(),
});

export const flightSchema = z.object({
  id: z.string(),
  name: z.string(),
  savedAt: z.iso.datetime(),
  aircraftId: z.string().nullable(),
  /** As typed; a registration with its own profile selects that profile. */
  registration: z.string().default(""),
  departure: point.nullable(),
  destination: point.nullable(),
  alternate: point.nullable(),
  waypoints: z.array(point),
  /** Designators of the chosen SID/STAR; their legs are added around the waypoints. */
  sid: z.string().nullable().default(null),
  star: z.string().nullable().default(null),
  cruiseAltitudeFt: z.number(),
  cruiseTasKt: z.number().positive(),
  /** Direction the wind blows from, true. */
  wind,
  /** Forecast winds aloft per leg, valid only for the route and altitude they were fetched for. */
  legWinds: z
    .object({
      routeKey: z.string(),
      winds: z.array(wind),
      levelHpa: z.number(),
      validAt: z.string(),
    })
    .nullable()
    .default(null), // flights saved before this field existed
  fuelFlowLph: z.number().positive(),
  fuel: z.object({ blockL: z.number().nonnegative() }),
  /** Fuel table rows the pilot typed over the planner's suggestion (legacy fuel planning). */
  fuelOverrides: z
    .partialRecord(
      z.enum([
        "plannedTrip",
        "startTaxi",
        "climb",
        "departureArrival",
        "alternate",
      ]),
      z.object({
        minutes: z.number().nonnegative().nullable().optional(),
        fuelL: z.number().nonnegative().nullable().optional(),
      }),
    )
    .default({}),
  /** Cruise OAT for the POH cruise tables (legacy cruise tile, 15 °C by default). */
  cruiseOatC: z.number().default(15),
  stationsKg: z.record(z.string(), z.number().nonnegative()),
});

export type Flight = z.infer<typeof flightSchema>;
export type FlightPoint = z.infer<typeof point>;

export function newFlight(): Flight {
  return {
    id: crypto.randomUUID(),
    name: "",
    savedAt: new Date().toISOString(),
    aircraftId: null,
    registration: "",
    departure: null,
    destination: null,
    alternate: null,
    waypoints: [],
    sid: null,
    star: null,
    cruiseAltitudeFt: 3000,
    cruiseTasKt: 120,
    wind: { directionDeg: 0, speedKt: 0 },
    legWinds: null,
    // Legacy defaults: 120 kt, and 35 L/h when the aircraft has no cruise table.
    fuelFlowLph: 35,
    fuel: { blockL: 0 },
    fuelOverrides: {},
    cruiseOatC: 15,
    stationsKg: {},
  };
}

/** Identifies the legs and level that leg winds were fetched for. */
export function routeKey(points: FlightPoint[], cruiseAltitudeFt: number) {
  return `${points.map((p) => `${p.ident}@${p.lat},${p.lon}`).join(">")}|${cruiseAltitudeFt}`;
}
