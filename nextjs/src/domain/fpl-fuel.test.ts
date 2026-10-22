import { describe, expect, it } from "vitest";
import { fplFuel } from "./fpl-fuel";
import { flightPlanProfile } from "./flight-plan-profile";
import { fredaFuelRemaining } from "./freda";
import { destinationPoint, distanceNm } from "./geo";
import type { ArrivalLeg } from "./airport-arrival";

const a = { ident: "A", lat: 0, lon: 0, flyOver: true };
const b = { ident: "B", ...destinationPoint(a, 90, 60), flyOver: true };
const c = { ident: "C", ...destinationPoint(a, 90, 120), flyOver: true };
const calm: ArrivalLeg = {
  tasKt: 120,
  fuelFlowLph: 24,
  wind: { directionDeg: 0, speedKt: 0 },
};
const profile = flightPlanProfile([a, b, c], null, { tasKt: 120 }, 5000);
const input = {
  profile,
  position: destinationPoint(a, 90, 30),
  activeLeg: 0,
  currentFuelL: 100,
  legs: [calm, calm],
  fallback: calm,
};

describe("FPL fuel estimates", () => {
  it("burns only the remaining route and leaves passed rows empty", () => {
    const result = fplFuel(input);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeCloseTo(94, 5);
    expect(result[2]).toBeCloseTo(82, 5);
  });
  it("uses per-leg wind, speed and fuel flow", () => {
    const result = fplFuel({
      ...input,
      legs: [
        { tasKt: 80, fuelFlowLph: 30, wind: { directionDeg: 90, speedKt: 20 } },
        {
          tasKt: 100,
          fuelFlowLph: 20,
          wind: { directionDeg: 270, speedKt: 20 },
        },
      ],
    });
    expect(result[1]).toBeCloseTo(85, 5);
    expect(result[2]).toBeCloseTo(75, 5);
  });
  it("keeps repeated point occurrences distinct", () => {
    const loop = flightPlanProfile([a, b, a], null, { tasKt: 120 }, 5000);
    const result = fplFuel({ ...input, profile: loop, activeLeg: 1 });
    expect(result.slice(0, 2)).toEqual([null, null]);
    expect(result[2]).toBeCloseTo(94, 5);
  });
  it("follows the original fly-by curve and interpolates TOC/TOD rows", () => {
    const curve = flightPlanProfile(
      [a, { ...b, flyOver: false }, { ...c, lat: 1, lon: b.lon }],
      null,
      { tasKt: 120 },
      5000,
    );
    const mid = curve.totalNm / 2;
    curve.rows.push({
      point: { ...b, ident: "TOD" },
      routeIndex: null,
      event: "TOD",
      distanceNm: mid,
      altitudeFt: 5000,
    });
    const result = fplFuel({ ...input, profile: curve, position: a });
    expect(result[2]).toBeCloseTo(100 - (curve.totalNm * 24) / 120, 5);
    expect(result[3]).toBeCloseTo(100 - (mid * 24) / 120, 5);
    expect(curve.totalNm).toBeLessThan(
      distanceNm(a, b) + distanceNm(b, curve.rows[2]!.point),
    );
  });
  it("uses a FREDA correction once, then burns onward from the present position", () => {
    const currentFuelL = fredaFuelRemaining(
      100,
      24,
      {
        startedAt: 0,
        stoppedAt: null,
        source: "manual",
        autoArmed: false,
        candidateAt: null,
      },
      3600000,
      { fuelL: 70, airElapsedMs: 1800000 },
    );
    expect(fplFuel({ ...input, currentFuelL })[2]).toBeCloseTo(40, 5);
  });
  it("does not fabricate estimates without position/fuel or through unflyable wind", () => {
    expect(fplFuel({ ...input, position: null })).toEqual([null, null, null]);
    expect(fplFuel({ ...input, currentFuelL: null })).toEqual([
      null,
      null,
      null,
    ]);
    expect(
      fplFuel({
        ...input,
        legs: [calm, { ...calm, wind: { directionDeg: 90, speedKt: 130 } }],
      }),
    ).toEqual([null, expect.closeTo(94, 5), null]);
  });
  it("clamps exhausted fuel at zero and ignores missing data on already flown legs", () => {
    expect(fplFuel({ ...input, currentFuelL: 10 })[2]).toBe(0);
    const result = fplFuel({
      ...input,
      activeLeg: 1,
      position: b,
      legs: [{ ...calm, fuelFlowLph: NaN }, calm],
    });
    expect(result[2]).toBeCloseTo(88, 5);
  });
});
