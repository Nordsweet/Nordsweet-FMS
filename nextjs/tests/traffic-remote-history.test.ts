import { afterEach, expect, test, vi } from "vitest";
import { trafficHistory } from "~/api/traffic-details";
import {
  currentCallsignHistory,
  trafficTrailSegments,
  trafficTrailGaps,
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

test("local observations fill sparse server history, including before its latest sample", () => {
  const sample = (sampledAt: number, lon: number, callsign = "RYR8GK") => ({
    lat: 50,
    lon,
    sampledAt,
    callsign,
  });
  const remote = [sample(0, 18), sample(600000, 19)];
  const local = [
    sample(200000, 18.3),
    sample(400000, 18.6),
    sample(600000, 19.01, ""),
    sample(615000, 19.1),
  ];
  const merged = currentCallsignHistory(remote, local, "RYR8GK");
  expect(merged.map((p) => p.sampledAt)).toEqual([
    0, 200000, 400000, 600000, 615000,
  ]);
  expect(merged[3]).toMatchObject({ lon: 19.01, callsign: "RYR8GK" });
  expect(trafficTrailGaps(merged)).toEqual([]);
  expect(trafficTrailSegments(merged)).toEqual([
    merged.map((p) => [p.lon, p.lat]),
  ]);
});

test("unknown intervals are dashed links and live fixes connect even before the session observer runs", () => {
  const sample = (sampledAt: number, lon: number) => ({
    lat: 50,
    lon,
    sampledAt,
    callsign: "RYR8GK",
  });
  const merged = currentCallsignHistory(
    [sample(0, 18), sample(1000, 18.1), sample(400000, 19)],
    [sample(415000, 19.1)],
    "RYR8GK",
  );
  expect(trafficTrailSegments(merged)).toEqual([
    [
      [18, 50],
      [18.1, 50],
    ],
    [
      [19, 50],
      [19.1, 50],
    ],
  ]);
  expect(trafficTrailGaps(merged)).toEqual([
    [
      [18.1, 50],
      [19, 50],
    ],
  ]);
  expect(trafficTrailGaps(merged).at(-1)?.at(-1)).toEqual(
    trafficTrailSegments(merged).at(-1)?.[0],
  );
});

test("gap links never connect different callsign flights", () => {
  const remote = [
    { lat: 50, lon: 18, sampledAt: 0, callsign: "OLD" },
    { lat: 50, lon: 19, sampledAt: 400000, callsign: "NEW" },
  ];
  const history = currentCallsignHistory(remote, [], "NEW");
  expect(history).toHaveLength(1);
  expect(trafficTrailGaps(history)).toEqual([]);
});

test("every edge at the coverage boundary appears once, including isolated observations", () => {
  const points = [0, 300000, 600001, 900002].map((sampledAt, i) => ({
    lat: 50,
    lon: 18 + i,
    sampledAt,
    callsign: "RYR8GK",
  }));
  expect(trafficTrailSegments(points)).toEqual([
    [
      [18, 50],
      [19, 50],
    ],
  ]);
  expect(trafficTrailGaps(points)).toEqual([
    [
      [19, 50],
      [20, 50],
    ],
    [
      [20, 50],
      [21, 50],
    ],
  ]);
  expect(trafficTrailSegments([])).toEqual([]);
  expect(trafficTrailGaps([])).toEqual([]);
});

test("missing live callsigns use the chronologically latest flight, independent of input order", () => {
  const remote = [{ lat: 50, lon: 19, sampledAt: 400000, callsign: "NEW" }];
  const local = [{ lat: 50, lon: 18, sampledAt: 0, callsign: "OLD" }];
  expect(currentCallsignHistory(remote, local, null)).toEqual(remote);
});
