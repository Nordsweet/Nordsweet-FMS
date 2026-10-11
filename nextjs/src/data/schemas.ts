import { z } from "zod";

const latitude = z.number().min(-90).max(90);
const longitude = z.number().min(-180).max(180);

export const airportTypes = [
  "aerodrome",
  "controlled",
  "military",
  "airstrip",
  "airstrip-difficult",
  "airstrip-unconfirmed",
  "road-strip",
] as const;

export const runwaySchema = z.object({
  designator: z.string().min(1),
  /** True heading (the source data is geographic). */
  trueHeadingDeg: z.number().min(0).max(360),
  surface: z.enum(["asphalt", "concrete", "paved", "grass", "unknown"]),
  lengthM: z.number().positive().nullable(),
  widthM: z.number().positive().nullable(),
  slopePct: z.number(),
  toraM: z.number().positive().nullable(),
  todaM: z.number().positive().nullable(),
  asdaM: z.number().positive().nullable(),
  ldaM: z.number().positive().nullable(),
  threshold: z
    .object({ lat: latitude, lon: longitude, elevationFt: z.number() })
    .nullable(),
});

export const airportSchema = z.object({
  /** ICAO code, or the CUP code for strips without one. */
  ident: z.string().min(1),
  /** Other codes the legacy data used for this field (e.g. truncated CUP codes in saved routes). */
  aliases: z.array(z.string()),
  isIcao: z.boolean(),
  name: z.string().min(1),
  country: z.string().length(2),
  type: z.enum(airportTypes),
  lat: latitude,
  lon: longitude,
  elevationFt: z.number(),
  runways: z.array(runwaySchema),
  /** Station to use for METAR/TAF when the field has none. */
  weatherStation: z.string().nullable(),
  contact: z.string().nullable(),
  links: z.array(z.string()),
  remarks: z.string().nullable(),
  source: z.string(),
});

export const navpointKinds = [
  "ifr-waypoint",
  "vfr-reporting-point",
  "navaid",
  "runway-threshold",
  /** Airfield without an airport record (no runway data). */
  "airfield",
] as const;

export const navpointSchema = z.object({
  ident: z.string().min(1),
  /** Codes used by legacy saved routes (e.g. "EPMLA" for "EPML ALFA"). */
  aliases: z.array(z.string()),
  name: z.string().min(1),
  kind: z.enum(navpointKinds),
  lat: latitude,
  lon: longitude,
  /** Airport the point belongs to (VFR reporting points, thresholds). */
  airport: z.string().nullable(),
  description: z.string().nullable(),
  airways: z.array(z.string()),
  navaid: z
    .object({
      type: z.string(),
      frequency: z.string().nullable(),
      channel: z.string().nullable(),
    })
    .nullable(),
  source: z.string(),
});

export const frequencySchema = z.object({
  airport: z.string().min(1),
  service: z.enum([
    "radio",
    "informacja",
    "radar",
    "zblizanie",
    "tower",
    "atis",
    "ground",
    "delivery",
    "fiss",
  ]),
  frequencyMhz: z.string().regex(/^\d{3}\.\d{1,3}$/),
  callsign: z.string(),
  sector: z.string().nullable(),
  notes: z.string().nullable(),
  primary: z.boolean(),
});

export const datasetSchemas = {
  airports: z.array(airportSchema),
  navpoints: z.array(navpointSchema),
  frequencies: z.array(frequencySchema),
} as const;

export type DatasetName = keyof typeof datasetSchemas;
export type Airport = z.infer<typeof airportSchema>;
export type AirportType = Airport["type"];
export type Runway = z.infer<typeof runwaySchema>;
export type Navpoint = z.infer<typeof navpointSchema>;
export type NavpointKind = Navpoint["kind"];
export type Frequency = z.infer<typeof frequencySchema>;
