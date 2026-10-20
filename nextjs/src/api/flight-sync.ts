import { z } from "zod";
import { serverFlightSchema, type PendingFlight } from "~/data/flight-session";

const root = "/flight-sync/sessions";
export class FlightSyncError extends Error {
  constructor(readonly status: number) {
    super(`Flight storage: ${status}`);
  }
}
async function request(
  path: string,
  token: string,
  body?: unknown,
  keepalive = false,
) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
    keepalive,
  });
  if (!response.ok) throw new FlightSyncError(response.status);
  return response.json() as Promise<unknown>;
}
export const flightSyncApi = {
  latest: async (token: string) =>
    serverFlightSchema.nullable().parse(await request(root, token)),
  get: async ({ token, id }: { token: string; id: string }) =>
    serverFlightSchema.parse(await request(`${root}/${id}`, token)),
  close: async ({ token, id }: { token: string; id: string }) =>
    request(`${root}/${id}/close`, token, {}),
  save: async ({
    token,
    flight,
    keepalive = false,
  }: {
    token: string;
    flight: PendingFlight;
    keepalive?: boolean;
  }) => {
    const body = {
      name: flight.name,
      startedAt: flight.startedAt,
      registration: flight.registration,
      revision: flight.revision + 1,
      offset: flight.trackCount,
      points: flight.track.slice(flight.trackCount, flight.trackCount + 500),
      snapshot: flight.snapshot,
      ended: flight.snapshot.inflight.startedAt === null,
    };
    // Browser keepalive has a shared 64 KiB budget. Normal uploads/retries remain authoritative.
    if (
      keepalive &&
      new TextEncoder().encode(JSON.stringify(body)).length > 60000
    )
      return null;
    return z
      .object({ revision: z.number().int(), trackCount: z.number().int() })
      .parse(await request(`${root}/${flight.id}`, token, body, keepalive));
  },
};
