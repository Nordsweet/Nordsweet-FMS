import { expect, test } from "vitest";
import { newFlight, flightSchema } from "~/data/flight";
import { toNordFile, parseNordFile } from "~/data/nord";
import {
  fuelUnit,
  formatFuel,
  parseFuel,
  fuelToLitres,
  fuelFromLitres,
} from "./fuel-units";

test("C172S uses US gallons, other aircraft use litres, and manual choices win", () => {
  expect(fuelUnit("C172S")).toBe("US gal");
  expect(fuelUnit("FR172H")).toBe("L");
  expect(fuelUnit("C172S", "L")).toBe("L");
  expect(formatFuel(73, "L")).toBe("73");
  expect(formatFuel(50, "US gal")).toBe("13");
  expect(parseFuel("13", "US gal")).toBeCloseTo(49.210353192, 9);
  expect(parseFuel("-1", "US gal")).toBeNull();
  expect(parseFuel("", "L")).toBeNull();
  expect(parseFuel("abc", "L")).toBeNull();
  expect(fuelToLitres(fuelFromLitres(73.42, "US gal"), "US gal")).toBeCloseTo(
    73.42,
    12,
  );
});

test("old flights default automatically; .nord retains presentation units without altering litres", () => {
  const old = { ...newFlight(), fuelDisplayUnit: undefined };
  expect(flightSchema.parse(old).fuelDisplayUnit).toBeNull();
  const flight = {
    ...newFlight(),
    aircraftId: "C172S",
    fuelDisplayUnit: "US gal" as const,
    fuel: { blockL: 73.42 },
  };
  const loaded = parseNordFile(toNordFile(flight, "C172S"), ["C172S"]).flight;
  expect(loaded.fuelDisplayUnit).toBe("US gal");
  expect(loaded.fuel.blockL).toBe(73.42);
});
