import { describe, expect, it } from "vitest";

import { computeFuelPlan } from "./fuel";
import { computeNavLog } from "./navlog";

const EPNT = { ident: "EPNT", lat: 49.462222, lon: 20.0525 };
const EPMLR = { ident: "EPMLR", lat: 50.195833, lon: 21.27695 };
const EPML = { ident: "EPML", lat: 50.322283, lon: 21.46175 };
const date = new Date("2026-10-11");

describe("computeNavLog", () => {
  it("computes legs and totals in still air", () => {
    const log = computeNavLog([EPNT, EPMLR, EPML], {
      tasKt: 100,
      wind: { directionDeg: 0, speedKt: 0 },
      fuelFlowLph: 30,
      date,
    });
    expect(log.legs).toHaveLength(2);
    expect(log.distanceNm).toBeCloseTo(
      log.legs[0]!.distanceNm + log.legs[1]!.distanceNm,
      9,
    );
    expect(log.legs[0]!.distanceNm).toBeGreaterThan(60);
    expect(log.legs[0]!.distanceNm).toBeLessThan(65);
    // NE-bound leg; magnetic course = true - ~6.3° easterly variation
    expect(log.legs[0]!.trueCourseDeg).toBeGreaterThan(40);
    expect(
      log.legs[0]!.trueCourseDeg - log.legs[0]!.magneticCourseDeg,
    ).toBeCloseTo(6.3, 0);
    expect(log.minutes).toBeCloseTo((log.distanceNm / 100) * 60, 6);
    expect(log.fuelL).toBeCloseTo((log.minutes! / 60) * 30, 6);
  });

  it("applies the wind", () => {
    const calm = computeNavLog([EPNT, EPML], {
      tasKt: 100,
      wind: { directionDeg: 0, speedKt: 0 },
      fuelFlowLph: 30,
      date,
    });
    const head = computeNavLog([EPNT, EPML], {
      tasKt: 100,
      wind: { directionDeg: calm.legs[0]!.trueCourseDeg, speedKt: 20 },
      fuelFlowLph: 30,
      date,
    });
    expect(head.legs[0]!.groundSpeedKt).toBeCloseTo(80, 6);
    expect(head.minutes!).toBeGreaterThan(calm.minutes!);
  });

  it("uses a wind per leg when given", () => {
    const calm = { directionDeg: 0, speedKt: 0 };
    const log = computeNavLog([EPNT, EPMLR, EPML], {
      tasKt: 100,
      wind: calm,
      legWinds: [calm, { directionDeg: 0, speedKt: 30 }],
      fuelFlowLph: 30,
      date,
    });
    expect(log.legs[0]!.groundSpeedKt).toBeCloseTo(100, 6);
    expect(log.legs[1]!.wind.speedKt).toBe(30);
    expect(log.legs[1]!.groundSpeedKt).not.toBeCloseTo(100, 0);
  });

  it("reports impossible legs as null instead of guessing", () => {
    const log = computeNavLog([EPNT, EPML], {
      tasKt: 40,
      wind: { directionDeg: 120, speedKt: 60 },
      fuelFlowLph: 30,
      date,
    });
    expect(log.minutes).toBeNull();
    expect(log.legs[0]!.groundSpeedKt).toBeNull();
  });
});

describe("computeFuelPlan", () => {
  it("sums the components", () => {
    const plan = computeFuelPlan({
      tripMinutes: 60,
      alternateMinutes: 20,
      fuelFlowLph: 36,
      taxiL: 4,
      climbExtraL: 2,
      departureArrivalMinutes: 0,
      finalReserveMinutes: 45,
      blockFuelL: 120,
    });
    expect(plan).toMatchObject({
      tripL: 36,
      contingencyL: 3, // 5 min hold (3 L) beats 5% of trip (1.8 → 2 L)
      departureArrivalL: 6, // minimum 10 min
      alternateL: 12,
      finalReserveL: 27,
      minimumL: 36 + 3 + 4 + 2 + 6 + 12 + 27,
    });
    expect(plan.extraL).toBe(120 - plan.minimumL);
  });
});
