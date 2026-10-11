import { z } from "zod";

/**
 * Response schemas for the Aviation API Collector (see its /llms.txt). The service publishes no
 * response schemas in OpenAPI, so these are written from the docs and checked against recorded
 * responses in ./fixtures.
 */

/** Per-request upstream status: "ok", "skipped: <reason>" or "error: <ExceptionName>". */
export const sourcesSchema = z.record(z.string(), z.string());

const timestamp = z.iso.datetime({ offset: true });

export const placeKinds = [
  "vfr_point",
  "airfield_grass",
  "airstrip",
  "gliding_airfield",
  "airfield_paved",
] as const;

export const placeSchema = z.object({
  name: z.string(),
  code: z.string().nullable(),
  kind: z.enum(placeKinds),
  lat: z.number(),
  lon: z.number(),
  elevation_m: z.number().nullable(),
  runway_direction_deg: z.number().nullable(),
  runway_length_m: z.number().nullable(),
  frequency: z.string().nullable(),
  description: z.string().nullable(),
});

export const placesResponseSchema = z.object({
  /** null when the request had no lat/lon. */
  places: z.array(placeSchema.extend({ distance_nm: z.number().nullable() })),
  sources: sourcesSchema,
});

export const metarSchema = z.object({
  raw: z.string(),
  observed_at: timestamp,
  age_minutes: z.number(),
  stale: z.boolean(),
  status: z.enum(["confirmed", "single_source", "newest_selected", "conflict"]),
  sources: z.array(z.string()),
  disagreeing: z.record(z.string(), z.string()),
});

export const weatherResponseSchema = z.object({
  icao: z.string(),
  metar: metarSchema.nullable(),
  taf: z.string().nullable(),
  sources: sourcesSchema,
});

export const atisSchema = z.object({
  kind: z.enum(["arrival", "departure", "combined"]),
  letter: z.string().nullable(),
  received_at: timestamp.nullable(),
  age_minutes: z.number().nullable(),
  stale: z.boolean(),
  qnh_hpa: z.number().nullable(),
  qnh_matches_metar: z.boolean().nullable(),
  text: z.string(),
});

export const atisResponseSchema = z.object({
  icao: z.string(),
  atis: z.array(atisSchema),
  sources: sourcesSchema,
});

export const notamSchema = z.object({
  id: z.string(),
  number: z.string().nullable(),
  location: z.string(),
  starts_at: timestamp.nullable(),
  ends_at: timestamp.nullable(),
  summary: z.string().nullable(),
  text: z.string(),
});

export const notamsResponseSchema = z.object({
  icao: z.string(),
  notams: z.array(notamSchema),
  sources: sourcesSchema,
});

export const airportResponseSchema = z.object({
  icao: z.string(),
  aerodrome: placeSchema.nullable(),
  metar: metarSchema.nullable(),
  taf: z.string().nullable(),
  atis: z.array(atisSchema),
  notams: z.array(notamSchema).default([]),
  sources: sourcesSchema,
});

export const aircraftSchema = z.object({
  hex: z.string(),
  callsign: z.string().nullable(),
  registration: z.string().nullable(),
  type: z.string().nullable(),
  lat: z.number(),
  lon: z.number(),
  altitude_ft: z.number().nullable(),
  on_ground: z.boolean(),
  ground_speed_kt: z.number().nullable(),
  track_deg: z.number().nullable(),
  vertical_rate_fpm: z.number().nullable(),
  squawk: z.string().nullable(),
  position_time: timestamp,
  sources: z.array(z.string()),
});

export const trafficResponseSchema = z.object({
  count: z.number(),
  aircraft: z.array(aircraftSchema),
  sources: sourcesSchema,
});

export const activationSchema = z.object({
  designator: z.string(),
  country: z.string(),
  lower: z.string(),
  upper: z.string(),
  starts_at: timestamp,
  ends_at: timestamp,
  unit: z.string().nullable(),
  remarks: z.string().nullable(),
  source: z.enum(["pansa.aup", "pansa.uup", "ans_cr.aup", "ans_cr.uup"]),
});

const position = z.tuple([z.number(), z.number()]);

export const airspaceFeatureSchema = z.object({
  type: z.literal("Feature"),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  geometry: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(position)),
  }),
  properties: z.object({
    name: z.string(),
    class: z.string(),
    lower: z.string(),
    upper: z.string(),
    activations: z.array(activationSchema),
    /** null: not booked in the plan (permanent zones always look like this). */
    active_now: z.boolean().nullable(),
  }),
});

export const airspaceResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(airspaceFeatureSchema),
  sources: sourcesSchema,
});

export const activationsResponseSchema = z.object({
  plan: z.enum(["current", "next"]),
  activations: z.array(activationSchema.extend({ has_geometry: z.boolean() })),
  sources: sourcesSchema,
});

export type Place = z.infer<typeof placeSchema>;
export type PlaceKind = Place["kind"];
export type Metar = z.infer<typeof metarSchema>;
export type Atis = z.infer<typeof atisSchema>;
export type Notam = z.infer<typeof notamSchema>;
export type TrafficAircraft = z.infer<typeof aircraftSchema>;
export type AirspaceFeature = z.infer<typeof airspaceFeatureSchema>;
export type Activation = z.infer<typeof activationSchema>;
