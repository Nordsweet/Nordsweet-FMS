import { z } from "zod";

/**
 * Response schemas for the Aviation API Collector (see its /llms.txt). The service publishes no
 * response schemas in OpenAPI, so these are written from the docs and checked against recorded
 * responses in ./fixtures.
 */

/** Per-request upstream status: "ok", "skipped: <reason>" or "error: <ExceptionName>". */
export const sourcesSchema = z.record(z.string(), z.string());

const timestamp = z.iso.datetime({ offset: true });

/** `role` stays a plain string: a role the API adds later must not break login. */
export const meResponseSchema = z.object({
  username: z.string(),
  role: z.string(),
});
export const createdUserSchema = z.object({
  username: z.string(),
  role: z.string(),
  user_id: z.string(),
});
export const loginResponseSchema = meResponseSchema.extend({
  token: z.string().min(1),
  /** Seconds; 30 days today. */
  expires_in: z.number(),
});

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

const httpsUrl = z.string().startsWith("https://");

/** `kind` and `interests` stay plain strings: a value the API adds later must not break the whole list. */
export const inspirationSpotSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  icao: z.string().nullable(),
  interests: z.array(z.string()),
  summary: z.string().nullable(),
  photo_url: httpsUrl.nullable(),
  page_url: httpsUrl.nullable(),
  license: z.string().nullable(),
  distance_nm: z.number().nullable(),
});

export const inspirationRouteSchema = z.object({
  id: z.string(),
  name: z.string(),
  interests: z.array(z.string()),
  distance_nm: z.number(),
  stops: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      lat: z.number(),
      lon: z.number(),
      icao: z.string().nullable(),
    }),
  ),
});

export const inspirationResponseSchema = z.object({
  spots: z.array(inspirationSpotSchema),
  routes: z.array(inspirationRouteSchema),
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
  /** Community reports require confirmations from two independent browser/device identifiers. */
  source: z.string().default("atis.guru"),
  id: z.string().optional(),
  confirmation_count: z.number().int().nonnegative().default(0),
  fields: z
    .record(z.string(), z.union([z.string(), z.array(z.string())]))
    .default({}),
  verified: z.boolean().optional(),
  observed_at: timestamp.nullable().optional(),
});

export const atisResponseSchema = z.object({
  icao: z.string(),
  atis: z.array(atisSchema),
  sources: sourcesSchema,
});

/** The one current ATIS cut out of a telephone recording; `text` is null when none could be found. */
export const atisMessageSchema = z.object({
  text: z.string().nullable(),
  error: z.string().nullable(),
  changed: z.boolean(),
  misheard: z.boolean(),
  redo: z.boolean(),
});

export const atisMessageResponseSchema = z.object({
  icao: z.string(),
  captured_at: z.number().nullable(),
  message: atisMessageSchema.nullable(),
});

export const atisCallAccountSchema = z.object({
  username: z.string(),
  enabled: z.boolean(),
  airports: z.array(z.string()),
  requests: z.array(
    z.object({
      id: z.string(),
      icao: z.string(),
      status: z.enum(["queued", "requesting", "ready", "failed"]),
      created_at: z.number(),
      updated_at: z.number(),
      error: z.string().nullable(),
      /** `ready` only ends the call: the text follows as `transcript` or `transcript_error`. */
      transcript: z.string().nullable().default(null),
      transcript_error: z.string().nullable().default(null),
      message: atisMessageSchema.nullable().default(null),
    }),
  ),
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

export const fuelResponseSchema = z.object({
  icao: z.string(),
  fuel: z.array(z.object({ supplier: z.string(), fuels: z.array(z.string()) })),
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
export const airspaceServiceSchema = z.object({
  frequencyMhz: z.string(),
  callsign: z.string().default(""),
  sector: z.string().nullable().default(null),
  serviceId: z.string().default(""),
});

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
    frequencies: z.array(airspaceServiceSchema).default([]),
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
export type InspirationSpot = z.infer<typeof inspirationSpotSchema>;
export type InspirationRoute = z.infer<typeof inspirationRouteSchema>;
export type Metar = z.infer<typeof metarSchema>;
export type Atis = z.infer<typeof atisSchema>;
export type AtisMessage = z.infer<typeof atisMessageSchema>;
export type Notam = z.infer<typeof notamSchema>;
export type TrafficAircraft = z.infer<typeof aircraftSchema>;
export type AirspaceFeature = z.infer<typeof airspaceFeatureSchema>;
export type Activation = z.infer<typeof activationSchema>;
