import { describe, expect, it } from "vitest";

import {
  densityAltitudeFt,
  isaTemperatureC,
  pressureAltitudeFt,
} from "./atmosphere";

describe("atmosphere", () => {
  it("follows the ISA lapse rate", () => {
    expect(isaTemperatureC(0)).toBe(15);
    expect(isaTemperatureC(10000)).toBeCloseTo(-4.81, 2);
  });

  it("computes pressure altitude from QNH", () => {
    expect(pressureAltitudeFt(2060, 1013.25)).toBeCloseTo(2060, 6);
    expect(pressureAltitudeFt(0, 1030)).toBeCloseTo(-454.2, 1);
    expect(pressureAltitudeFt(0, 990)).toBeCloseTo(640.7, 1);
  });

  it("computes density altitude", () => {
    expect(densityAltitudeFt(2000, isaTemperatureC(2000))).toBeCloseTo(2000, 6);
    expect(densityAltitudeFt(2000, 30)).toBeCloseTo(4252.4, 0);
  });
});
