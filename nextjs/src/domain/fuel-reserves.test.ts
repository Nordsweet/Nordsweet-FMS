import { describe, expect, it } from "vitest";
import { fuelReserveStatus } from "./fuel-reserves";
import { fredaFuelRemaining } from "./freda";
import { newTimers } from "./flight-timers";
import { fuelToLitres } from "./fuel-units";

describe("reserve fuel thresholds", () => {
  it("protects alternate plus final reserve, without rounding threshold crossings", () => {
    expect(fuelReserveStatus(50, 30, 20)).toEqual({ level: null });
    expect(fuelReserveStatus(49.99, 30, 20)).toEqual({ level: "alternate" });
    expect(fuelReserveStatus(20, 30, 20)).toEqual({ level: "alternate" });
    expect(fuelReserveStatus(19.99, 30, 20)).toEqual({ level: "final" });
    expect(fuelReserveStatus(0, 30, 20)).toEqual({ level: "final" });
  });
  it("does not invent an alternate allocation or zero final reserve", () => {
    expect(fuelReserveStatus(20, 0, 20)).toEqual({ level: null });
    expect(fuelReserveStatus(19, 0, 20)).toEqual({ level: "final" });
    expect(fuelReserveStatus(0, 0, 0)).toEqual({ level: null });
    expect(fuelReserveStatus(5, 10, 0)).toEqual({ level: "alternate" });
  });
  it("keeps missing data distinct from sufficient fuel and still warns on known final reserve", () => {
    for (const bad of [null, NaN, Infinity, -1]) {
      expect(fuelReserveStatus(bad, 30, 20)).toBeNull();
      expect(fuelReserveStatus(40, 30, bad)).toBeNull();
      expect(fuelReserveStatus(40, bad, 20)).toBeNull();
    }
    expect(fuelReserveStatus(10, null, 20)).toEqual({ level: "final" });
  });
  it("responds to fuel burned since the latest FREDA reading", () => {
    const air = { ...newTimers().airTime, startedAt: 0 };
    const remaining = (now: number) =>
      fredaFuelRemaining(100, 24, air, now, {
        fuelL: 60,
        airElapsedMs: 1800000,
      });
    expect(fuelReserveStatus(remaining(1800000), 30, 20)).toEqual({
      level: null,
    });
    expect(fuelReserveStatus(remaining(3600000), 30, 20)).toEqual({
      level: "alternate",
    });
    expect(fuelReserveStatus(remaining(9000000), 30, 20)).toEqual({
      level: "final",
    });
  });
  it("compares internal litres identically for gallon inputs and respects changed alternate allocations", () => {
    const remaining = fuelToLitres(10, "US gal");
    expect(fuelReserveStatus(remaining, 10, 20)).toEqual({ level: null });
    expect(fuelReserveStatus(remaining, 30, 20)).toEqual({
      level: "alternate",
    });
  });
});
