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
  departure: point.nullable(),
  destination: point.nullable(),
  alternate: point.nullable(),
  waypoints: z.array(point),
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
  fuel: z.object({
    blockL: z.number().nonnegative(),
    taxiL: z.number().nonnegative(),
    climbExtraL: z.number().nonnegative(),
  }),
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
    departure: null,
    destination: null,
    alternate: null,
    waypoints: [],
    cruiseAltitudeFt: 3000,
    cruiseTasKt: 100,
    wind: { directionDeg: 0, speedKt: 0 },
    legWinds: null,
    fuelFlowLph: 30,
    fuel: { blockL: 0, taxiL: 5, climbExtraL: 0 },
    stationsKg: {},
  };
}

/** Identifies the legs and level that leg winds were fetched for. */
export function routeKey(flight: Flight) {
  const points = [
    flight.departure,
    ...flight.waypoints,
    flight.destination,
  ].filter((p) => p !== null);
  return `${points.map((p) => `${p.ident}@${p.lat},${p.lon}`).join(">")}|${flight.cruiseAltitudeFt}`;
}
