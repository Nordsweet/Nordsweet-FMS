import { z } from "zod";
import { trafficPatternSchema } from "./traffic-pattern";

export const pointRestrictionSchema = z.object({
  speedKt: z.number().positive().nullable().default(null),
  altitudeFt: z.number().nonnegative().nullable().default(null),
  altitudeMode: z.enum(["at", "above", "below"]).default("at"),
});

const point = z.object({
  ident: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  anchor: z
    .object({
      from: z.string(),
      to: z.string(),
      /** Explicit map insertion order; absent on legacy nearest-leg anchors. */
      placement: z.enum(["before", "after"]).optional(),
      occurrence: z.number().int().nonnegative().optional(),
      fromPosition: z
        .object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        })
        .optional(),
      toPosition: z
        .object({
          lat: z.number().min(-90).max(90),
          lon: z.number().min(-180).max(180),
        })
        .optional(),
    })
    .optional(),
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
  /** Map points: explicit before/after anchors, or nearest leg for older saved points. */
  waypoints: z.array(point),
  trafficPattern: trafficPatternSchema.nullable().default(null),
  departurePattern: trafficPatternSchema.nullable().default(null),
  departureRunway: z
    .object({
      airport: z.string(),
      designator: z.string(),
      source: z.enum(["takeoff", "taxi"]),
    })
    .nullable()
    .default(null),
  pointRestrictions: z.record(z.string(), pointRestrictionSchema).default({}),
  /** Legacy route text: DCT, airways, procedures ("SID NAVUR"), coordinates. */
  routeText: z.string().default(""),
  /** Procedure selects: null = none, "AUTO" = suggested for the runway, else a procedure id. */
  sid: z.string().nullable().default(null),
  star: z.string().nullable().default(null),
  approach: z.string().nullable().default(null),
  /** Variant chosen in a leg's Type select for "SID NAVUR"-style requests. */
  inlineProcedureSelections: z.record(z.string(), z.string()).default({}),
  cruiseAltitudeFt: z.number(),
  cruiseTasKt: z.number().positive(),
  /** ECO: cruise speed from the route's best-range cruise table speeds. */
  cruiseSpeedEco: z.boolean().default(false),
  /** ALT at point typed by the pilot, by point key. */
  waypointAltitudes: z.record(z.string(), z.number().nonnegative()).default({}),
  /** Waypoint WX wind profile rows as typed, by point key. */
  waypointWx: z
    .record(
      z.string(),
      z.array(
        z.object({
          altitudeFt: z.string(),
          windDirection: z.string(),
          windSpeed: z.string(),
        }),
      ),
    )
    .default({}),
  /** Times the pilot set ("YYYY-MM-DDTHH:mm", local); the other one follows the ETE. */
  schedule: z
    .object({ departure: z.string(), destination: z.string() })
    .default({ departure: "", destination: "" }),
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
  checklistChecked: z.record(z.string(), z.array(z.string())).default({}),
  performanceInputs: z
    .record(
      z.string(),
      z.object({
        runwayId: z.string().nullable().default(null),
        configId: z.string().nullable().default(null),
        oatC: z.number().default(15),
        qnhHpa: z.number().positive().default(1013),
        windDirectionDeg: z.number().default(0),
        windSpeedKt: z.number().nonnegative().default(0),
      }),
    )
    .default({}),
  taxiInputs: z
    .record(
      z.string(),
      z.object({ from: z.string().nullable(), to: z.string().nullable() }),
    )
    .default({}),
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
    trafficPattern: null,
    departurePattern: null,
    departureRunway: null,
    pointRestrictions: {},
    routeText: "",
    sid: null,
    star: null,
    approach: null,
    inlineProcedureSelections: {},
    cruiseAltitudeFt: 3000,
    cruiseTasKt: 120,
    cruiseSpeedEco: false,
    waypointAltitudes: {},
    waypointWx: {},
    schedule: { departure: "", destination: "" },
    fuel: { blockL: 0 },
    fuelOverrides: {},
    cruiseOatC: 15,
    checklistChecked: {},
    performanceInputs: {},
    taxiInputs: {},
    stationsKg: {},
  };
}
