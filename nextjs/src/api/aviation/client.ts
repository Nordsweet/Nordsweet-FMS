import { z } from "zod";
import { airrepSchema, type Airrep } from "~/data/airrep";

import { env } from "~/env";
import { correctTrafficMetadata } from "~/domain/traffic-metadata";
import { useAuth } from "~/stores/auth";
import { expiring, renewedToken } from "../oidc-session";
import { useServerConnection } from "~/stores/server-connection";

import {
  activationsResponseSchema,
  airportResponseSchema,
  fuelResponseSchema,
  airspaceResponseSchema,
  atisMessageResponseSchema,
  atisResponseSchema,
  atisCallAccountSchema,
  type PlaceKind,
  placesResponseSchema,
  sourcesSchema,
  inspirationResponseSchema,
  createdUserSchema,
  meResponseSchema,
  notamsResponseSchema,
  trafficResponseSchema,
  weatherResponseSchema,
} from "./schemas";

/** The service answered, but no upstream source had data (502), the request was invalid (422) or login failed (401, 429). */
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

/**
 * Every Aviation API call goes through here: it adds the bearer token and is the only place a 401
 * ends the session. No retry: the login screen takes over, and a late 401 for an old token cannot
 * end a newer session.
 */
export async function aviationFetch(url: URL, init: RequestInit = {}) {
  // Read synchronously unless a renewal is due: sign-out revokes the token it reads right here.
  const session = useAuth.getState().session;
  const token = expiring(session) ? await renewedToken() : session?.token;
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(url, { ...init, headers, cache: "no-store" });
  // This transport also serves the separate local logbook proxy. Only API replies count here;
  // even an HTTP error proves contact, while failed/aborted requests do not.
  if (url.origin === new URL(env.NEXT_PUBLIC_AVIATION_API_URL).origin)
    useServerConnection.getState().received();
  if (
    response.status === 401 &&
    token &&
    useAuth.getState().session?.token === token
  )
    useAuth.getState().signOut();
  return response;
}

type Params = Record<string, string | number | readonly string[] | undefined>;

async function send<S extends z.ZodType>(
  path: string,
  schema: S,
  url: URL,
  init?: RequestInit,
) {
  const response = await aviationFetch(url, init);
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
/** `sources`: the traffic networks to query (the API merges all of them when omitted). */
export type TrafficAround = Around & { sources?: readonly string[] };
export type AirspacePlan = "current" | "next";

/** Pilot-reported ATIS; independent device confirmations are counted by the collector. */
export type CommunityAtisReport = {
  id: string;
  airportIcao: string;
  information: string;
  atisObservedAt: string;
  datisText: string;
  fields: Record<string, string | string[]>;
  reporterId: string;
};

export const aviationApi = {
  atisMessage: (icao: string, format: "text" | "datis" = "text") =>
    get(icaoPath(icao, "/atis-message"), atisMessageResponseSchema, { format }),
  atisCallAccount: () => get("/atis-calls", atisCallAccountSchema),
  requestAtisCall: ({ icao, requestId }: { icao: string; requestId: string }) =>
    post(
      icaoPath(icao, "/atis-call"),
      atisCallAccountSchema.extend({ request_id: z.string() }),
      { request_id: requestId },
    ),
  submitAirrep: (report: Airrep, signal?: AbortSignal) =>
    send(
      "/community/airrep",
      z.object({ id: z.string() }),
      new URL("/community/airrep", env.NEXT_PUBLIC_AVIATION_API_URL),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(report),
        signal,
      },
    ),
  airreps: (source: "gps" | "simulator" = "gps") =>
    get("/community/airrep", z.object({ reports: z.array(airrepSchema) }), {
      source,
    }),
  /** Admin only: the API creates the user in Zitadel (initial password) and grants the project role. */
  createZitadelUser: (user: {
    username: string;
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    role: "user" | "admin";
  }) => post("/admin/zitadel-users", createdUserSchema, user),
  /** 401 = expired or revoked: the central handler has already ended the session. */
  me: () => get("/auth/me", meResponseSchema),
  submitAtis: (report: CommunityAtisReport) =>
    post("/community/atis", z.object({ id: z.string() }).loose(), report),
  confirmAtis: ({ id, reporterId }: { id: string; reporterId: string }) =>
    post(
      `/community/atis/${encodeURIComponent(id)}/confirm`,
      z.object({
        id: z.string(),
        confirmation_count: z.number(),
        verified: z.boolean(),
      }),
      { reporterId },
    ),
  briefing: async (icao: string) => {
    const [weather, atis] = await Promise.allSettled([
      get(icaoPath(icao, "/weather"), weatherResponseSchema),
      get(icaoPath(icao, "/atis"), atisResponseSchema),
    ]);
    if (weather.status === "rejected" && atis.status === "rejected")
      throw weather.reason instanceof Error
        ? weather.reason
        : new Error("Weather unavailable");
    return {
      icao,
      metar: weather.status === "fulfilled" ? weather.value.metar : null,
      taf: weather.status === "fulfilled" ? weather.value.taf : null,
      atis: atis.status === "fulfilled" ? atis.value.atis : [],
      sources: {
        ...(weather.status === "fulfilled"
          ? weather.value.sources
          : { weather: "error" }),
        ...(atis.status === "fulfilled"
          ? atis.value.sources
          : { atis: "error" }),
      },
    };
  },
  airport: (icao: string) => get(icaoPath(icao), airportResponseSchema),
  fuel: (icao: string) => get(icaoPath(icao, "/fuel"), fuelResponseSchema),
  weather: (icao: string) =>
    get(icaoPath(icao, "/weather"), weatherResponseSchema),
  atis: (icao: string) => get(icaoPath(icao, "/atis"), atisResponseSchema),
  notams: (icao: string) =>
    get(icaoPath(icao, "/notams"), notamsResponseSchema),
  traffic: ({ lat, lon, radiusNm, sources }: TrafficAround) =>
    // An empty list must not reach the API: omitting `sources` there means every network.
    sources?.length === 0
      ? Promise.resolve({ count: 0, aircraft: [], sources: {} })
      : get("/traffic", trafficResponseSchema, {
          lat,
          lon,
          radius_nm: radiusNm,
          sources: sources?.join(","),
        }).then((response) => ({
          ...response,
          aircraft: response.aircraft.map(correctTrafficMetadata),
        })),
  /** The whole curated list: the app filters it itself, so favourites never disappear with a filter. */
  inspiration: ({ lang }: { lang: "pl" | "en" }) =>
    get("/inspiration", inspirationResponseSchema, { lang }),
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
