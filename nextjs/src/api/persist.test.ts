import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { api } from "~/api";

import { shouldPersistQuery } from "./persist";

const HOUR = 3_600_000;

/** A query that finished successfully, as the persister would see it. */
async function settled(queryKey: unknown[], staleTime: number) {
  const client = new QueryClient();
  await client.fetchQuery({ queryKey, queryFn: async () => ({}), staleTime });
  return client.getQueryCache().find({ queryKey })!;
}

describe("what the offline query cache keeps", () => {
  it("leaves out bundled reference data (staleTime Infinity) the service worker already holds", async () => {
    expect(shouldPersistQuery(await settled(["airports.list"], Infinity))).toBe(
      false,
    );
    expect(
      shouldPersistQuery(await settled(["procedures.all"], Infinity)),
    ).toBe(false);
    expect(
      shouldPersistQuery(
        await settled(["frequencies.byAirport", { icao: "EPKK" }], Infinity),
      ),
    ).toBe(false);
  });

  it("leaves out data that is cheaper to read again: bundled+own aircraft, merged waypoints, tracks, terrain", async () => {
    for (const key of [
      "aircraft.list",
      "navpoints.list",
      "terrain.region",
      "flightLogs.track",
    ])
      expect(shouldPersistQuery(await settled([key], 0))).toBe(false);
  });

  it("keeps live answers the pilot may need offline", async () => {
    expect(
      shouldPersistQuery(
        await settled(["weather.briefing", { icao: "EPKK" }], 120_000),
      ),
    ).toBe(true);
    expect(
      shouldPersistQuery(await settled(["airspace.around", {}], 300_000)),
    ).toBe(true);
    expect(
      shouldPersistQuery(await settled(["flights.list", undefined], 0)),
    ).toBe(true);
  });

  it("does not keep a query that failed or is still loading", async () => {
    const client = new QueryClient();
    const pending = client.fetchQuery({
      queryKey: ["weather.briefing", { icao: "EPXX" }],
      queryFn: () => new Promise(() => undefined),
    });
    void pending;
    const query = client
      .getQueryCache()
      .find({ queryKey: ["weather.briefing", { icao: "EPXX" }] })!;
    expect(shouldPersistQuery(query)).toBe(false);
  });
});

describe("how long answers stay", () => {
  const gc = (options: { gcTime?: number }) => options.gcTime;

  it("per-airport and per-aircraft answers are kept 6 hours, not the default day", () => {
    const icao = { icao: "EPKK" };
    expect(gc(api.weather.briefing.queryOptions(icao))).toBe(6 * HOUR);
    expect(gc(api.weather.metarTaf.queryOptions(icao))).toBe(6 * HOUR);
    expect(gc(api.notams.byAirport.queryOptions(icao))).toBe(6 * HOUR);
    expect(gc(api.fuel.byAirport.queryOptions(icao))).toBe(6 * HOUR);
    expect(gc(api.airports.briefing.queryOptions(icao))).toBe(6 * HOUR);
  });

  it("never shorter than the time an answer counts as fresh", () => {
    expect(
      gc(api.traffic.aircraftIdentity.queryOptions({ hex: "abc" } as never)),
    ).toBe(24 * HOUR);
  });

  it("the airspace layer keeps the default (a day) so the map works offline tomorrow", () => {
    expect(
      gc(api.airspace.around.queryOptions({ lat: 50, lon: 19, radiusNm: 250 })),
    ).toBeUndefined();
    expect(
      gc(api.airspace.activations.queryOptions({ plan: "current" })),
    ).toBeUndefined();
  });
});
