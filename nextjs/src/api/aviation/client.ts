import { z } from "zod";

import { env } from "~/env";
import { correctTrafficMetadata } from "~/domain/traffic-metadata";

import {
  activationsResponseSchema,
  airportResponseSchema,
  airspaceResponseSchema,
  atisResponseSchema,
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

async function send<S extends z.ZodType>(
  path: string,
  schema: S,
  url: URL,
  init?: RequestInit,
) {
  const response = await fetch(url, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = (body as { detail?: unknown } | null)?.detail;
    const info =
      typeof detail === "object" && detail !== null
        ? (detail as { message?: string; sources?: unknown })
        : {};
    const sources = sourcesSchema.safeParse(info.sources);
    throw new AviationApiError(
      response.status,
      info.message ??
        (typeof detail === "string"
          ? detail
          : `Aviation API ${path} failed (${response.status})`),
      sources.success ? sources.data : {},
    );
  }
  return schema.parse(body);
}

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
  return send(path, schema, url);
}

function post<S extends z.ZodType>(path: string, schema: S, body: unknown) {
  return send(path, schema, new URL(path, env.NEXT_PUBLIC_AVIATION_API_URL), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const icaoPath = (icao: string, suffix = "") =>
  `/airports/${encodeURIComponent(icao.trim().toUpperCase())}${suffix}`;

export type Around = { lat: number; lon: number; radiusNm?: number };
export type AirspacePlan = "current" | "next";

/** Pilot-reported ATIS (collector POST /community/atis). The server marks it unverified. */
export type CommunityAtisReport = {
  id: string;
  airportIcao: string;
  information: string;
  atisObservedAt: string;
  datisText: string;
  fields: Record<string, string | string[]>;
};

export const aviationApi = {
  submitAtis: (report: CommunityAtisReport) =>
    post("/community/atis", z.object({ id: z.string() }).loose(), report),
  airport: (icao: string) => get(icaoPath(icao), airportResponseSchema),
  weather: (icao: string) =>
    get(icaoPath(icao, "/weather"), weatherResponseSchema),
  atis: (icao: string) => get(icaoPath(icao, "/atis"), atisResponseSchema),
  notams: (icao: string) =>
    get(icaoPath(icao, "/notams"), notamsResponseSchema),
  traffic: ({ lat, lon, radiusNm }: Around) =>
    get("/traffic", trafficResponseSchema, {
      lat,
      lon,
      radius_nm: radiusNm,
    }).then((response) => ({
      ...response,
      aircraft: response.aircraft.map(correctTrafficMetadata),
    })),
  airspace: ({ lat, lon, radiusNm, plan }: Around & { plan?: AirspacePlan }) =>
    get("/airspace", airspaceResponseSchema, {
      lat,
      lon,
      radius_nm: radiusNm,
      plan,
    }),
  activations: (plan: AirspacePlan = "current") =>
    get("/airspace/activations", activationsResponseSchema, { plan }),
  /** Without lat/lon: every place in the API's coverage. */
  places: ({
    lat,
    lon,
    radiusNm,
    kinds,
  }: Partial<Around> & { kinds?: readonly PlaceKind[] }) =>
    get("/places", placesResponseSchema, {
      lat,
      lon,
      radius_nm: radiusNm,
      kind: kinds,
    }),
};
