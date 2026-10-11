import { describe, expect, it } from "vitest";

import { angleDiffDeg, normalizeDeg } from "./angles";
import {
  destinationPoint,
  distanceNm,
  initialBearingDeg,
  trackOffset,
} from "./geo";

describe("angles", () => {
  it("normalizes and diffs", () => {
    expect(normalizeDeg(-10)).toBe(350);
    expect(normalizeDeg(720)).toBe(0);
    expect(angleDiffDeg(350, 10)).toBe(20);
    expect(angleDiffDeg(10, 350)).toBe(-20);
  });
});

describe("geo", () => {
  it("measures one degree of latitude as ~60 NM", () => {
    expect(distanceNm({ lat: 50, lon: 20 }, { lat: 51, lon: 20 })).toBeCloseTo(
      60.04,
      2,
    );
  });

  it("gives initial bearings", () => {
    expect(
      initialBearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }),
    ).toBeCloseTo(90, 6);
    expect(
      initialBearingDeg({ lat: 50, lon: 20 }, { lat: 49, lon: 20 }),
    ).toBeCloseTo(180, 6);
  });

  it("round-trips destinationPoint", () => {
    const start = { lat: 49.4628, lon: 20.0507 };
    const end = destinationPoint(start, 37, 42);
    expect(distanceNm(start, end)).toBeCloseTo(42, 6);
    expect(initialBearingDeg(start, end)).toBeCloseTo(37, 6);
  });

  it("computes cross-track (right positive) and along-track", () => {
    const from = { lat: 0, lon: 0 };
    const to = { lat: 0, lon: 10 };
    const left = trackOffset(from, to, { lat: 1, lon: 5 });
    expect(left.crossTrackNm).toBeCloseTo(-60.04, 1);
    expect(left.alongTrackNm).toBeCloseTo(300.2, 0);
    expect(trackOffset(from, to, { lat: -1, lon: 5 }).crossTrackNm).toBeCloseTo(
      60.04,
      1,
    );
    expect(trackOffset(from, to, { lat: 0, lon: -1 }).alongTrackNm).toBeCloseTo(
      -60.04,
      1,
    );
  });
});
