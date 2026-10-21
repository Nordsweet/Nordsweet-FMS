import { z } from "zod";
import { aviationFetch } from "./aviation/client";
import { logbookEntrySchema, type LogbookEntry } from "~/data/logbook";
import { flightSnapshotSchema } from "~/data/flight-session";

async function call(path: string, body?: unknown) {
  const response = await aviationFetch(
    new URL(`/flight-sync/logbook${path}`, location.origin),
    {
      method: body === undefined ? "GET" : "POST",
      cache: "no-store",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!response.ok) throw new Error(`Logbook ${response.status}`);
  return response.json() as Promise<unknown>;
}

export const logbookApi = {
  list: async (offset: number) =>
    z
      .object({ entries: z.array(logbookEntrySchema), hasMore: z.boolean() })
      .parse(await call(`?offset=${offset}`)),
  save: async (entry: LogbookEntry) =>
    logbookEntrySchema.parse(
      await call(`/${encodeURIComponent(entry.id)}`, entry),
    ),
  pic: async (id: string, pic: string) =>
    call(`/${encodeURIComponent(id)}/pic`, { pic }),
  legacy: async (token: string, offset: number) => {
    const response = await fetch(`/flight-sync/sessions?offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Archive ${response.status}`);
    return z
      .object({
        flights: z.array(
          z.object({
            id: z.string(),
            startedAt: z.string(),
            snapshot: flightSnapshotSchema,
          }),
        ),
        hasMore: z.boolean(),
      })
      .parse(await response.json());
  },
};
