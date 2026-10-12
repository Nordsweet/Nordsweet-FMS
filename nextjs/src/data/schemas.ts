import { z } from "zod";

import { aircraftSchema } from "./aircraft";

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

export const procedureSchema = z.object({
  airport: z.string(),
  type: z.enum(["SID", "STAR"]),
  designator: z.string(),
  runways: z.array(z.string()),
  legs: z
    .array(
      z.object({
        ident: z.string(),
        lat: latitude,
        lon: longitude,
        /** As published, e.g. "+2800ft", "FL70". */
        altitude: z.string().nullable(),
        speedKt: z.number().nullable(),
      }),
    )
    .min(1),
  source: z.string(),
});

/** Taxiway graph: element ids with their direct connections. */
export const groundSchema = z.object({
  airport: z.string(),
  elements: z.array(
    z.object({
      id: z.string(),
      type: z.enum([
        "taxiway",
        "apron",
        "stand",
        "holdingPoint",
        "runway",
        "arp",
        "vor",
      ]),
      label: z.string(),
    }),
  ),
  connections: z.record(z.string(), z.array(z.string())),
  /** Taxiways a stand can be left by (legacy "startOptions"). */
  standExits: z.record(z.string(), z.array(z.string())),
});

export const chartSchema = z.object({
  airport: z.string(),
  title: z.string(),
  src: z.string(),
});

export const datasetSchemas = {
  airports: z.array(airportSchema),
  navpoints: z.array(navpointSchema),
  frequencies: z.array(frequencySchema),
  aircraft: z.array(aircraftSchema),
  procedures: z.array(procedureSchema),
  ground: z.array(groundSchema),
  charts: z.array(chartSchema),
} as const;

export type DatasetName = keyof typeof datasetSchemas;
export type Airport = z.infer<typeof airportSchema>;
export type AirportType = Airport["type"];
export type Runway = z.infer<typeof runwaySchema>;
export type Navpoint = z.infer<typeof navpointSchema>;
export type NavpointKind = Navpoint["kind"];
export type Frequency = z.infer<typeof frequencySchema>;
export type Procedure = z.infer<typeof procedureSchema>;
export type Ground = z.infer<typeof groundSchema>;
export type Chart = z.infer<typeof chartSchema>;
