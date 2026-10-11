import { queryOptions } from "@tanstack/react-query";

import { loadDataset } from "./datasets";
import { findAirport, searchAirports, searchNavpoints } from "./search";

/**
 * The app's single data boundary ("dummy backend"). Procedures mirror the planned tRPC
 * routers; today they resolve locally. Components use `api.x.y.queryOptions(input)`, so swapping
 * in a tRPC client later does not touch them.
 */
function query<TInput, TOutput>(
  path: string,
  resolve: (input: TInput) => Promise<TOutput>,
  options: { staleTime?: number } = {},
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

/** Bundled reference data only changes with an app release. */
const reference = { staleTime: Infinity };

type Search = { query: string; limit?: number };

export const api = {
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
  },
  navpoints: {
    search: query(
      "navpoints.search",
      async ({ query, limit }: Search) =>
        searchNavpoints(await loadDataset("navpoints"), query, limit),
      reference,
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
};
