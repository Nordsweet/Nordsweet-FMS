import { afterEach, expect, it, vi } from "vitest";

import { api } from "~/api";
import { mapPreferencesSchema } from "~/stores/map";
import { aviationApi } from "./client";

const empty = { count: 0, aircraft: [], sources: { "adsb.lol": "ok" } };
function stubFetch() {
  const fetch = vi.fn((_url: URL) =>
    Promise.resolve(new Response(JSON.stringify(empty))),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
afterEach(() => vi.unstubAllGlobals());

const here = { lat: 50, lon: 19, radiusNm: 100 };

it("sends the chosen networks comma-joined, and omits sources when unset", async () => {
  const fetch = stubFetch();
  await aviationApi.traffic({ ...here, sources: ["adsb.lol", "ogn"] });
  await aviationApi.traffic(here);
  const [selected, unset] = fetch.mock.calls.map(([url]) => url.searchParams);
  expect(selected?.get("sources")).toBe("adsb.lol,ogn");
  expect(unset?.has("sources")).toBe(false);
});

it("makes no request for an empty selection (omitting sources would mean every network)", async () => {
  const fetch = stubFetch();
  expect(await aviationApi.traffic({ ...here, sources: [] })).toMatchObject({
    count: 0,
    aircraft: [],
  });
  expect(fetch).not.toHaveBeenCalled();
});

it("refetches when the layers change: the query key carries the sources", () => {
  const key = (sources: string[]) =>
    api.traffic.around.queryOptions({ ...here, sources }).queryKey;
  expect(key(["ogn"])).not.toEqual(key(["adsb.lol", "ogn"]));
  expect(key(["ogn"])).toEqual(key(["ogn"]));
});

it("shows every network by default, and old stored preferences gain that default", () => {
  expect(mapPreferencesSchema.parse({}).trafficSources).toEqual([
    "adsb.lol",
    "adsb.fi",
    "opensky",
    "ogn",
  ]);
  expect(
    mapPreferencesSchema.safeParse({ trafficSources: ["radar"] }).success,
  ).toBe(false);
});
