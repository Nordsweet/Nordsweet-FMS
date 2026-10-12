import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { type Flight } from "~/data/flight";
import { type LatLon } from "~/domain/geo";

import { type AirspacePlan, type Around, aviationApi } from "./aviation/client";
import { loadDataset } from "./datasets";
import { listFlights, removeFlight, saveFlight } from "./flights";
import { cachedRemote } from "./remote-cache";
import { findAirport, searchAirports, searchNavpoints } from "./search";
import { vfrPointToNavpoint } from "./vfr-points";
import { fetchWindsAloft } from "./winds-aloft";

/**
 * The app's single data boundary ("dummy backend"). Procedures mirror the planned tRPC
 * routers. Live data comes from the Aviation API Collector; data it does not provide yet
 * (runways, IFR waypoints, navaids, frequencies) is bundled reference data. Components use
 * `api.x.y.queryOptions(input)`, so swapping in a tRPC client later does not touch them.
 */
function query<TInput, TOutput>(
  path: string,
  resolve: (input: TInput) => Promise<TOutput>,
  options: { staleTime?: number; gcTime?: number } = {},
) {
  return {
    call: resolve,
    queryOptions: (input: TInput) =>
      queryOptions({
        queryKey: [path, input] as const,
        queryFn: () => resolve(input),
        ...options,
      }),
  };
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

function mutation<TInput, TOutput>(
  path: string,
  resolve: (input: TInput) => Promise<TOutput>,
) {
  return {
    call: resolve,
    mutationOptions: () =>
      mutationOptions({ mutationKey: [path], mutationFn: resolve }),
  };
}

/** Bundled reference data only changes with an app release. */
const reference = { staleTime: Infinity };
/** Refresh no faster than the API's own cache (see its /llms.txt). */
const live = (staleTime: number) => ({ staleTime });

const loadVfrPoints = () =>
  cachedRemote("aviation-api.vfr-points.v2", 24 * HOUR, async () =>
    (await aviationApi.places({ kinds: ["vfr_point"] })).places.map(
      vfrPointToNavpoint,
    ),
  );

type Search = { query: string; limit?: number };
type Icao = { icao: string };

export const api = {
  aircraft: {
    list: query("aircraft.list", () => loadDataset("aircraft"), reference),
  },
  flights: {
    list: query("flights.list", () => listFlights()),
    save: mutation("flights.save", (flight: Flight) => saveFlight(flight)),
    remove: mutation("flights.remove", (id: string) => removeFlight(id)),
  },
  airports: {
    list: query("airports.list", () => loadDataset("airports"), reference),
    get: query(
      "airports.get",
      async ({ code }: { code: string }) =>
        findAirport(await loadDataset("airports"), code) ?? null,
      reference,
    ),
    search: query(
      "airports.search",
      async ({ query, limit }: Search) =>
        searchAirports(await loadDataset("airports"), query, limit),
      reference,
    ),
    /** Aerodrome record, METAR/TAF, ATIS and NOTAMs in one call. */
    briefing: query(
      "airports.briefing",
      ({ icao }: Icao) => aviationApi.airport(icao),
      live(2 * MINUTE),
    ),
  },
  navpoints: {
    /** Bundled points plus the API's VFR points (when reachable or cached). */
    list: query(
      "navpoints.list",
      async () => [
        ...(await loadDataset("navpoints")),
        ...(await loadVfrPoints().catch(() => [])),
      ],
      { staleTime: HOUR },
    ),
    search: query(
      "navpoints.search",
      async ({ query, limit }: Search) => {
        // Never cached and offline: search without the API's VFR points rather than fail.
        const [bundled, vfr] = await Promise.all([
          loadDataset("navpoints"),
          loadVfrPoints().catch(() => []),
        ]);
        return searchNavpoints([...bundled, ...vfr], query, limit);
      },
      { staleTime: HOUR },
    ),
  },
  frequencies: {
    byAirport: query(
      "frequencies.byAirport",
      async ({ airport }: { airport: string }) =>
        (await loadDataset("frequencies")).filter((f) => f.airport === airport),
      reference,
    ),
  },
  weather: {
    metarTaf: query(
      "weather.metarTaf",
      ({ icao }: Icao) => aviationApi.weather(icao),
      live(2 * MINUTE),
    ),
    windsAloft: mutation(
      "weather.windsAloft",
      ({ points, altitudeFt }: { points: LatLon[]; altitudeFt: number }) =>
        fetchWindsAloft(points, altitudeFt),
    ),
    atis: query(
      "weather.atis",
      ({ icao }: Icao) => aviationApi.atis(icao),
      live(2 * MINUTE),
    ),
  },
  notams: {
    byAirport: query(
      "notams.byAirport",
      ({ icao }: Icao) => aviationApi.notams(icao),
      live(10 * MINUTE),
    ),
  },
  traffic: {
    around: query(
      "traffic.around",
      (around: Around) => aviationApi.traffic(around),
      {
        staleTime: 5 * SECOND,
        gcTime: MINUTE, // positions are worthless after a minute; do not persist them
      },
    ),
  },
  airspace: {
    around: query(
      "airspace.around",
      (input: Around & { plan?: AirspacePlan }) => aviationApi.airspace(input),
      live(5 * MINUTE),
    ),
    activations: query(
      "airspace.activations",
      ({ plan }: { plan?: AirspacePlan }) => aviationApi.activations(plan),
      live(5 * MINUTE),
    ),
  },
};
