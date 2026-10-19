import { z } from "zod";
import { env } from "~/env";
import { type TrafficSample } from "~/domain/traffic-history";
import { normalizeRegistration } from "~/domain/aircraft";
import { confirmedTrafficAircraft } from "~/domain/traffic-metadata";

const identitySchema = z.object({
  response: z.object({
    aircraft: z.object({
      registration: z.string().min(1),
      mode_s: z
        .string()
        .regex(/^[a-f0-9]{6}$/i)
        .refine((hex) => !["000000", "ffffff"].includes(hex.toLowerCase())),
      icao_type: z.string().nullish(),
      type: z.string().nullish(),
    }),
  }),
});

/** Look up an airframe, validating the echoed registration before accepting its Mode S address. */
export async function trafficAircraftIdentity({
  registration,
}: {
  registration: string;
}) {
  const input = registration.toUpperCase().replace(/\s/g, "");
  if (
    !/^[A-Z0-9+-]{3,12}$/.test(input) ||
    normalizeRegistration(input).length < 3
  )
    return null;
  const confirmed = confirmedTrafficAircraft.find(
    (record) =>
      normalizeRegistration(record.registration) ===
      normalizeRegistration(input),
  );
  if (confirmed)
    return {
      registration: confirmed.registration,
      hex: confirmed.hex,
      icaoType: confirmed.type,
    };
  // The database requires country separators; compact registrations need bounded, verified variants.
  const candidates = new Set([input]);
  if (!/[-+]/.test(input) && !/^N\d/.test(input))
    for (let at = 1; at <= Math.min(3, input.length - 2); at++)
      candidates.add(input.slice(0, at) + "-" + input.slice(at));
  for (const candidate of candidates) {
    const response = await fetch(
      `https://api.adsbdb.com/v0/aircraft/${encodeURIComponent(candidate)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`Aircraft identity: ${response.status}`);
    const aircraft = identitySchema.parse(await response.json()).response
      .aircraft;
    if (
      normalizeRegistration(aircraft.registration) !==
      normalizeRegistration(input)
    )
      throw new Error("Aircraft registration mismatch");
    return {
      registration: aircraft.registration,
      hex: aircraft.mode_s.toLowerCase(),
      icaoType: aircraft.icao_type ?? null,
      model: aircraft.type ?? null,
    };
  }
  return null;
}

const routeSchema = z.object({
  response: z.object({
    flightroute: z.object({
      callsign: z.string(),
      callsign_icao: z.string().nullable().optional(),
      callsign_iata: z.string().nullable().optional(),
      destination: z.object({
        icao_code: z.string().regex(/^[A-Z]{4}$/),
        name: z.string().min(1),
      }),
    }),
  }),
});
async function trafficRoute(callsign: string) {
  if (!/^[A-Z0-9]{2,10}$/.test(callsign)) return null;
  const response = await fetch(
    `https://api.adsbdb.com/v0/callsign/${encodeURIComponent(callsign)}`,
    { signal: AbortSignal.timeout(5000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Destination: ${response.status}`);
  const route = routeSchema.parse(await response.json()).response.flightroute;
  if (
    ![route.callsign, route.callsign_icao, route.callsign_iata].some(
      (value) => value?.toUpperCase() === callsign,
    )
  )
    throw new Error("Callsign mismatch");
  return route;
}
export async function trafficDestination({ callsign }: { callsign: string }) {
  const route = await trafficRoute(callsign);
  return route
    ? { icao: route.destination.icao_code, name: route.destination.name }
    : null;
}

/** Translate a flight number to the provider's published ICAO/IATA callsign aliases. */
export async function trafficIdentifiers({ callsign }: { callsign: string }) {
  const route = await trafficRoute(callsign);
  if (!route) return [];
  const aliases = [route.callsign, route.callsign_icao, route.callsign_iata]
    .filter((value): value is string => !!value)
    .map((value) => value.toUpperCase());
  return aliases;
}
const sampleSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  sampledAt: z.number().finite(),
  callsign: z
    .string()
    .nullish()
    .transform((value) => value ?? ""),
});
const historySchema = z.object({
  hex: z.string(),
  history: z.array(sampleSchema),
});
export async function trafficHistory({
  hex,
}: {
  hex: string;
}): Promise<TrafficSample[]> {
  if (!/^[a-f0-9]{6}$/i.test(hex)) return [];
  const url = new URL(
    `/traffic/${hex.toLowerCase()}/history`,
    env.NEXT_PUBLIC_AVIATION_API_URL,
  );
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Traffic history: ${response.status}`);
  const payload = historySchema.parse(await response.json());
  if (payload.hex.toLowerCase() !== hex.toLowerCase())
    throw new Error("Aircraft mismatch");
  return payload.history
    .map((p) => ({
      ...p,
      callsign: p.callsign.trim().toUpperCase().replace(/\s+/g, ""),
    }))
    .sort((a, b) => a.sampledAt - b.sampledAt);
}
