import { expect, test } from "vitest";
import { airportArrival, type ArrivalLeg } from "./airport-arrival";
import { destinationPoint, distanceNm } from "./geo";
import { flyByRoute } from "./fly-by";
import type { NavPoint } from "./progress";
import { fredaFuelRemaining } from "./freda";

const start = { ident: "START", lat: 50, lon: 20, flyOver: true };
const fix = { ident: "FIX", ...destinationPoint(start, 90, 30), flyOver: true };
const airport = {
  ident: "TEST",
  aliases: ["ALIAS"],
  ...destinationPoint(fix, 180, 30),
  flyOver: true,
};
const model: ArrivalLeg = {
  tasKt: 120,
  fuelFlowLph: 24,
  wind: { directionDeg: 0, speedKt: 0 },
};
const base = {
  airport,
  position: start,
  route: [start, fix, airport],
  activeLeg: 0,
  turns: { tasKt: 120 },
  legs: [model, model],
  direct: model,
  currentFuelL: 60,
};

test("an airport ahead uses remaining FPL, with burn to arrival rather than full original trip", () => {
  const result = airportArrival({
    ...base,
    position: destinationPoint(start, 90, 15),
  })!;
  expect(result.mode).toBe("route");
  expect(result.distanceNm).toBeCloseTo(45, 2);
  expect(result.minutes).toBeCloseTo(22.5, 2);
  expect(result.fuelL).toBeCloseTo(51, 2);
  const later = airportArrival({
    ...base,
    position: destinationPoint(fix, 180, 15),
    activeLeg: 1,
  })!;
  expect(later.distanceNm).toBeCloseTo(15, 2);
});

test("an off-route airport and a passed airport use current-position Direct", () => {
  const position = destinationPoint(fix, 180, 15);
  for (const route of [
    [start, fix],
    [airport, start, fix],
  ]) {
    const result = airportArrival({
      ...base,
      route,
      position,
      activeLeg: route.length - 2,
    })!;
    expect(result.mode).toBe("direct");
    expect(result.distanceNm).toBeCloseTo(distanceNm(position, airport), 6);
  }
});

test("a return to the departure airport uses the future occurrence, never the passed departure", () => {
  const result = airportArrival({
    ...base,
    airport: { ...start, aliases: [] },
    route: [start, fix, airport, start],
  })!;
  expect(result.mode).toBe("route");
  expect(result.distanceNm).toBeGreaterThan(100);
});

test("stops at an intermediate airport and recognizes its saved aliases and threshold endpoint", () => {
  const after = { ident: "AFTER", ...destinationPoint(airport, 180, 40) };
  for (const ident of ["ALIAS", "TEST THR04", "RW04/TEST"]) {
    const result = airportArrival({
      ...base,
      route: [start, fix, { ...airport, ident }],
    })!;
    expect(result.mode).toBe("route");
    expect(result.distanceNm).toBeCloseTo(60, 2);
  }
  const intermediate = airportArrival({
    ...base,
    route: [...base.route, after],
  })!;
  expect(intermediate.distanceNm).toBeCloseTo(60, 2);
});

test("FPL distance follows the fly-by curve rather than squared waypoint corners", () => {
  const route: NavPoint[] = [start, { ...fix, flyOver: false }, airport];
  const path = flyByRoute(route, base.turns);
  const expected = path.points
    .slice(1)
    .reduce((sum, point, i) => sum + distanceNm(path.points[i]!, point), 0);
  const result = airportArrival({ ...base, route })!;
  expect(result.distanceNm).toBeCloseTo(expected, 5);
  expect(result.distanceNm).toBeLessThan(60);
});

test("each leg uses its own speed, wind and fuel flow; Direct solves its own wind triangle", () => {
  const legs = [{ ...model, tasKt: 60, fuelFlowLph: 30 }, model];
  const result = airportArrival({ ...base, legs })!;
  expect(result.minutes).toBeCloseTo(45, 2);
  expect(result.fuelBurnL).toBeCloseTo(21, 2);
  const headwind = airportArrival({
    ...base,
    route: [],
    position: fix,
    direct: { ...model, wind: { directionDeg: 180, speedKt: 20 } },
  })!;
  expect(headwind.minutes).toBeCloseTo(18, 2);
});

test("fuel at arrival starts from the latest FREDA reading without double-subtracting flown time", () => {
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
    { fuelL: 60, airElapsedMs: 1800000 },
  )!;
  expect(currentFuelL).toBe(48);
  expect(airportArrival({ ...base, currentFuelL })!.fuelL).toBeCloseTo(36, 2);
});

test("unreachable winds and missing flow have no estimate; exhausted fuel is explicit and bounded", () => {
  expect(
    airportArrival({
      ...base,
      route: [],
      direct: { ...model, fuelFlowLph: NaN },
    }),
  ).toBeNull();
  expect(
    airportArrival({
      ...base,
      route: [],
      direct: { ...model, wind: { directionDeg: 0, speedKt: 1000 } },
    }),
  ).toBeNull();
  expect(airportArrival({ ...base, currentFuelL: 1 })).toMatchObject({
    enoughFuel: false,
    fuelL: 0,
  });
});
