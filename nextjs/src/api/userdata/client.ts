import { type z } from "zod";

import { aviationFetch } from "~/api/aviation/client";
import { env } from "~/env";

import {
  airframePageSchema,
  airframeSchema,
  conflictSchema,
  deletedSchema,
  documentPageSchema,
  documentRowSchema,
  type DocumentRow,
  favoritesPageSchema,
  flightLogResultSchema,
  flightLogSchema,
  flightLogsPageSchema,
  flightLogTrackSchema,
  importResultSchema,
  meSchema,
  readingResultSchema,
  settingsSchema,
  type SettingsBody,
} from "./schemas";

/** A user-data call the server (or the network) refused; `status` 0 means no response. */
export class UserDataError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterS: number | null = null,
    /** 409 on a document: the server's row, `null` when it does not exist. */
    readonly current: DocumentRow | null = null,
  ) {
    super(message);
    this.name = "UserDataError";
  }
}

type Request = (url: URL, init?: RequestInit) => Promise<Response>;

const detailText = (detail: unknown, fallback: string) => {
  if (typeof detail === "string") return detail;
  const message = (detail as { message?: unknown } | null)?.message;
  if (typeof message === "string") return message;
  // FastAPI validation errors: [{ loc, msg }]
  if (Array.isArray(detail) && detail.length)
    return detail
      .map((d: { msg?: string }) => d.msg)
      .filter(Boolean)
      .join("; ");
  return fallback;
};

export function createUserDataApi({
  baseUrl = env.NEXT_PUBLIC_AVIATION_API_URL,
  request = aviationFetch,
}: { baseUrl?: string; request?: Request } = {}) {
  const call = async (path: string, init: RequestInit = {}) => {
    let response: Response;
    try {
      response = await request(new URL(path, baseUrl), init);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      throw new UserDataError(0, "Network unavailable");
    }
    if (response.ok) return response;
    const body: unknown = await response.json().catch(() => null);
    const retry = Number(response.headers.get("Retry-After"));
    const conflict = conflictSchema.safeParse(body);
    throw new UserDataError(
      response.status,
      detailText(
        (body as { detail?: unknown } | null)?.detail,
        `${path} failed (${response.status})`,
      ),
      Number.isFinite(retry) && retry > 0 ? retry : null,
      conflict.success ? conflict.data.detail.current : null,
    );
  };
  // A 2xx that is not the documented shape is a server problem, not something to retry as our bug.
  const parse = async <S extends z.ZodType>(response: Response, schema: S) => {
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new UserDataError(502, "Unexpected response");
    return parsed.data;
  };
  const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const id = encodeURIComponent;
  const query = (params: Record<string, string | number | undefined>) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params))
      if (value !== undefined) search.set(key, String(value));
    return `?${search}`;
  };

  /** `/flights` and `/aircraft/custom`: versioned documents. */
  const documents = (root: "/flights" | "/aircraft/custom") => ({
    /** `cursor` null: the full state. The returned cursor is stored and sent back as is. */
    pull: async (cursor: string | null, limit = 100) =>
      parse(
        await call(
          `${root}${query({ updatedSince: cursor ?? undefined, limit })}`,
        ),
        documentPageSchema,
      ),
    put: async (
      docId: string,
      body: {
        document: Record<string, unknown>;
        schema_version: number;
        version: number;
      },
    ) =>
      parse(
        await call(`${root}/${id(docId)}`, json("PUT", body)),
        documentRowSchema,
      ),
    remove: async (docId: string, version?: number) => {
      await call(`${root}/${id(docId)}${query({ version })}`, {
        method: "DELETE",
      });
    },
  });

  return {
    me: async () => parse(await call("/me"), meSchema),
    /** `null` until settings were saved once (then push the local copy). */
    settings: async () => {
      try {
        return await parse(await call("/me/settings"), settingsSchema);
      } catch (error) {
        if (error instanceof UserDataError && error.status === 404) return null;
        throw error;
      }
    },
    putSettings: async (body: SettingsBody) =>
      parse(await call("/me/settings", json("PUT", body)), settingsSchema),
    favorites: async (offset = 0, limit = 500) =>
      parse(
        await call(`/me/favorites${query({ limit, offset })}`),
        favoritesPageSchema,
      ),
    putFavorite: async (itemId: string) => {
      await call(`/me/favorites/${id(itemId)}`, { method: "PUT" });
    },
    removeFavorite: async (itemId: string) => {
      await call(`/me/favorites/${id(itemId)}`, { method: "DELETE" });
    },
    deleteMyData: async (confirm: string) =>
      parse(
        await call(`/me/data${query({ confirm })}`, { method: "DELETE" }),
        deletedSchema,
      ),

    flights: documents("/flights"),
    customAircraft: documents("/aircraft/custom"),

    airframes: async (offset = 0, limit = 200) =>
      parse(
        await call(`/airframes${query({ limit, offset })}`),
        airframePageSchema,
      ),
    /** Finds or creates the airframe, so the client learns the id of its `TYPE::REG` key. */
    resolveAirframe: async (body: { type: string; registration: string }) =>
      parse(await call("/airframes", json("POST", body)), airframeSchema),
    airframeState: async (airframeId: string) =>
      parse(await call(`/airframes/${id(airframeId)}/state`), airframeSchema),
    setFuelIndicationMode: async (
      airframeId: string,
      mode: "exact" | "estimated" | null,
    ) =>
      parse(
        await call(
          `/airframes/${id(airframeId)}`,
          json("PATCH", { fuel_indication_mode: mode }),
        ),
        airframeSchema,
      ),
    addReading: async (airframeId: string, body: Record<string, unknown>) =>
      parse(
        await call(`/airframes/${id(airframeId)}/readings`, json("POST", body)),
        readingResultSchema,
      ),

    postFlightLog: async (body: Record<string, unknown>) =>
      parse(
        await call("/flight-logs", json("POST", body)),
        flightLogResultSchema,
      ),
    flightLogs: async (offset = 0, limit = 50) =>
      parse(
        await call(`/flight-logs${query({ limit, offset })}`),
        flightLogsPageSchema,
      ),
    flightLog: async (logId: string) =>
      parse(await call(`/flight-logs/${id(logId)}`), flightLogSchema),
    flightLogTrack: async (logId: string) =>
      parse(
        await call(`/flight-logs/${id(logId)}/track`),
        flightLogTrackSchema,
      ),
    removeFlightLog: async (logId: string) => {
      await call(`/flight-logs/${id(logId)}`, { method: "DELETE" });
    },

    importData: async (body: Record<string, unknown>) =>
      parse(await call("/import", json("POST", body)), importResultSchema),
  };
}

export type UserDataApi = ReturnType<typeof createUserDataApi>;
