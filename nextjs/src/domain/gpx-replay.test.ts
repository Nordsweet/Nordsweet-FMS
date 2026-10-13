import { describe, expect, it } from "vitest";

import { replayPoints } from "./gpx-replay";

describe("replayPoints", () => {
  it("derives speed and track from consecutive points, like legacy", () => {
    const points = replayPoints(
      [
        { lat: 50, lon: 20, elevationM: 240, time: 0 },
        // One minute of latitude north in 30 s: 1 NM / 30 s = 120 kt, track 000.
        { lat: 50 + 1 / 60, lon: 20, elevationM: null, time: 30_000 },
      ],
      800,
    );
    expect(points[0]).toMatchObject({
      speedKt: 0,
      elapsedMs: 0,
      headingDeg: null,
    });
    expect(points[0]!.altitudeFt).toBeCloseTo(787.4, 1);
    expect(points[1]!.speedKt).toBeCloseTo(120, 0);
    expect(points[1]!.headingDeg).toBeCloseTo(0, 6);
    expect(points[1]).toMatchObject({ altitudeFt: 800, elapsedMs: 30_000 });
  });

  it("rejects a single point", () => {
    expect(() =>
      replayPoints([{ lat: 50, lon: 20, elevationM: null, time: null }], 0),
    ).toThrow("gpx-too-short");
  });
});
