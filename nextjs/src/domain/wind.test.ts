import { describe, expect, it } from "vitest";

import {
  magneticToTrueDeg,
  magneticVariationDeg,
  trueToMagneticDeg,
} from "./magnetic";
import { windComponents, windTriangle } from "./wind";

describe("windComponents", () => {
  it("splits wind into headwind and right crosswind", () => {
    const c = windComponents(300, { directionDeg: 330, speedKt: 20 });
    expect(c.headwindKt).toBeCloseTo(17.32, 2);
    expect(c.crosswindKt).toBeCloseTo(10, 6);
  });

  it("reports tailwind as negative headwind", () => {
    // Runway 120, wind from the right rear quarter.
    const c = windComponents(120, { directionDeg: 270, speedKt: 10 });
    expect(c.headwindKt).toBeCloseTo(-8.66, 2);
    expect(c.crosswindKt).toBeCloseTo(5, 6);
  });

  it("reports left crosswind as negative", () => {
    const c = windComponents(120, { directionDeg: 30, speedKt: 10 });
    expect(c.headwindKt).toBeCloseTo(0, 6);
    expect(c.crosswindKt).toBeCloseTo(-10, 6);
  });
});

describe("windTriangle", () => {
  it("corrects into the wind", () => {
    const r = windTriangle(90, 100, { directionDeg: 0, speedKt: 20 });
    expect(r?.headingDeg).toBeCloseTo(78.46, 2);
    expect(r?.windCorrectionDeg).toBeCloseTo(-11.54, 2);
    expect(r?.groundSpeedKt).toBeCloseTo(97.98, 2);
  });

  it("handles a pure headwind", () => {
    const r = windTriangle(270, 100, { directionDeg: 270, speedKt: 25 });
    expect(r?.headingDeg).toBeCloseTo(270, 6);
    expect(r?.groundSpeedKt).toBeCloseTo(75, 6);
  });

  it("returns null when the flight is impossible", () => {
    expect(windTriangle(90, 50, { directionDeg: 0, speedKt: 60 })).toBeNull();
    expect(windTriangle(90, 50, { directionDeg: 90, speedKt: 60 })).toBeNull();
  });
});

describe("magnetic", () => {
  it("uses WMM2025 easterly variation in southern Poland", () => {
    const variation = magneticVariationDeg(
      { lat: 49.4628, lon: 20.0507 },
      new Date("2026-10-11"),
    );
    expect(variation).toBeGreaterThan(5.5);
    expect(variation).toBeLessThan(7.5);
  });

  it("converts true and magnetic", () => {
    expect(trueToMagneticDeg(122, 6.3)).toBeCloseTo(115.7, 6);
    expect(magneticToTrueDeg(2, 6.3)).toBeCloseTo(8.3, 6);
    expect(trueToMagneticDeg(3, 6.3)).toBeCloseTo(356.7, 6);
  });
});
