import { afterEach, expect, test, vi } from "vitest";
import { trafficHistory } from "~/api/traffic-details";
import {
  currentCallsignHistory,
  trafficTrailSegments,
} from "~/domain/traffic-history";
afterEach(() => vi.unstubAllGlobals());
test("accepts Collector null callsigns and draws the remote flight before local observation", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          hex: "48c1bb",
          history: [
            { lat: 49, lon: 18, sampledAt: 1000, callsign: "OLD" },
            { lat: 50, lon: 19, sampledAt: 2000, callsign: "RYS92" },
            { lat: 50.1, lon: 19.1, sampledAt: 3000, callsign: null },
            { lat: 50.2, lon: 19.2, sampledAt: 4000 },
          ],
        }),
      ),
    ),
  );
  const remote = await trafficHistory({ hex: "48c1bb" });
  const history = currentCallsignHistory(
    remote,
    [{ lat: 50.3, lon: 19.3, sampledAt: 5000, callsign: "RYS92" }],
    "RYS92",
  );
  expect(history.map((p) => p.sampledAt)).toEqual([2000, 3000, 4000, 5000]);
  expect(trafficTrailSegments(history)).toEqual([
    [
      [19, 50],
      [19.1, 50.1],
      [19.2, 50.2],
      [19.3, 50.3],
    ],
  ]);
});
