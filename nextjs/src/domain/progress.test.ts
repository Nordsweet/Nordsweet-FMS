import { describe, expect, it } from "vitest";

import { destinationPoint } from "./geo";
import { computeProgress, directTo } from "./progress";

const A = { ident: "A", lat: 50, lon: 19 };
const B = { ident: "B", lat: 50, lon: 20 };
const C = { ident: "C", lat: 51, lon: 20 };
const route = [A, B, C];

describe("computeProgress", () => {
  it("tracks the first leg with cross-track and distances", () => {
    const p = computeProgress(route, { lat: 50.05, lon: 19.5 }, 0)!;
    expect(p.activeLeg).toBe(0);
    expect(p.next.ident).toBe("B");
    expect(p.crossTrackNm).toBeLessThan(0); // north of an eastbound track = left
    expect(p.crossTrackNm).toBeCloseTo(-3, 0);
    expect(p.distanceToDestinationNm).toBeCloseTo(
      p.distanceToNextNm + 60.04,
      1,
    );
  });

  it("sequences once abeam the waypoint and never goes back", () => {
    const pastB = { lat: 50.02, lon: 20.01 };
    expect(computeProgress(route, pastB, 0)!.activeLeg).toBe(1);
    expect(computeProgress(route, { lat: 50, lon: 19.2 }, 1)!.activeLeg).toBe(
      1,
    );
  });

  it("counts a waypoint within 0.3 NM as passed", () => {
    const nearB = destinationPoint(B, 270, 0.2);
    expect(computeProgress(route, nearB, 0)!.activeLeg).toBe(1);
  });

  it("stays on the last leg at and beyond the destination", () => {
    expect(computeProgress(route, C, 1)!.activeLeg).toBe(1);
    expect(computeProgress(route, { lat: 51.2, lon: 20 }, 1)!.activeLeg).toBe(
      1,
    );
  });

  it("does not skip a waypoint that was never passed", () => {
    // Flying from A straight to C never passes B: stay on A→B (direct-to is the pilot's choice).
    expect(computeProgress(route, { lat: 50.6, lon: 19.6 }, 0)!.activeLeg).toBe(
      0,
    );
  });
});

describe("directTo", () => {
  it("starts at the present position and continues the route", () => {
    const r = directTo(route, { lat: 50.3, lon: 19.3 }, 2);
    expect(r.map((p) => p.ident)).toEqual(["DCT", "C"]);
    expect(computeProgress(r, { lat: 50.3, lon: 19.3 }, 0)!.next.ident).toBe(
      "C",
    );
  });
});
