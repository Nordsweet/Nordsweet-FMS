import { type z } from "zod";

import { env } from "~/env";

import {
  activationsResponseSchema,
  airportResponseSchema,
  airspaceResponseSchema,
  atisResponseSchema,
  type Place,
  type PlaceKind,
  placesResponseSchema,
  sourcesSchema,
  notamsResponseSchema,
  trafficResponseSchema,
  weatherResponseSchema,
} from "./schemas";

/** The service answered, but no upstream source had data (502) or the request was invalid (422). */
export class AviationApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly sources: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AviationApiError";
  }
}

type Params = Record<string, string | number | readonly string[] | undefined>;

async function get<S extends z.ZodType>(
  path: string,
  schema: S,
  params: Params = {},
) {
  const url = new URL(path, env.NEXT_PUBLIC_AVIATION_API_URL);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, String(item));
    }
  }
  const response = await fetch(url);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (
      body as { detail?: { message?: string; sources?: unknown } } | null
    )?.detail;
    const sources = sourcesSchema.safeParse(detail?.sources);
    throw new AviationApiError(
      response.status,
      detail?.message ?? `Aviation API ${path} failed (${response.status})`,
      sources.success ? sources.data : {},
    );
  }
  return schema.parse(body);
}

const icaoPath = (icao: string, suffix = "") =>
  `/airports/${encodeURIComponent(icao.trim().toUpperCase())}${suffix}`;

export type Around = { lat: number; lon: number; radiusNm?: number };
export type AirspacePlan = "current" | "next";

export const aviationApi = {
  airport: (icao: string) => get(icaoPath(icao), airportResponseSchema),
  weather: (icao: string) =>
    get(icaoPath(icao, "/weather"), weatherResponseSchema),
  atis: (icao: string) => get(icaoPath(icao, "/atis"), atisResponseSchema),
  notams: (icao: string) =>
    get(icaoPath(icao, "/notams"), notamsResponseSchema),
  traffic: ({ lat, lon, radiusNm }: Around) =>
    get("/traffic", trafficResponseSchema, { lat, lon, radius_nm: radiusNm }),
  airspace: ({ lat, lon, radiusNm, plan }: Around & { plan?: AirspacePlan }) =>
    get("/airspace", airspaceResponseSchema, {
      lat,
      lon,
      radius_nm: radiusNm,
      plan,
    }),
  activations: (plan: AirspacePlan = "current") =>
    get("/airspace/activations", activationsResponseSchema, { plan }),
  places: ({
    lat,
    lon,
    radiusNm,
    kinds,
  }: Around & { kinds?: readonly PlaceKind[] }) =>
    get("/places", placesResponseSchema, {
      lat,
      lon,
      radius_nm: radiusNm,
      kind: kinds,
    }),
};

/**
 * Centres of 250 NM circles that together cover Poland, Czechia and Slovakia (the API's coverage).
 * The service only answers radius queries, so the whole region is fetched as a few tiles.
 */
const REGION_TILES = [
  { lat: 54.0, lon: 16.0 },
  { lat: 52.0, lon: 19.4 },
  { lat: 50.5, lon: 23.0 },
  { lat: 49.8, lon: 15.5 },
  { lat: 48.7, lon: 19.5 },
] as const;

export async function placesInRegion(
  kinds?: readonly PlaceKind[],
): Promise<Place[]> {
  const responses = await Promise.all(
    REGION_TILES.map((tile) =>
      aviationApi.places({ ...tile, radiusNm: 250, kinds }),
    ),
  );
  const unique = new Map<string, Place>();
  for (const { places } of responses) {
    for (const { distance_nm: _distance, ...place } of places) {
      unique.set(
        `${place.kind}|${place.code ?? place.name}|${place.lat}|${place.lon}`,
        place,
      );
    }
  }
  return [...unique.values()];
}
