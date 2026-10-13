import { type Cruise } from "~/data/aircraft";

import {
  type CruisePerformance,
  cruisePerformance,
  rpmMap,
} from "./cruise-performance";
import {
  type RoutePlan,
  type WindContext,
  legWind,
  pointKey,
  windContext,
} from "./route-plan";

/** Legacy Route › Economy: the altitude at every point that minimises trip fuel. */
const ALTITUDE_STEP_FT = 500;
const MAX_ALTITUDE_FT = 12000;
const MIN_GROUND_SPEED_KT = 30;
const EN_ROUTE_CLEARANCE_FT = 1000;

export type EconomyLeg = {
  altitudeFt: number;
  distanceNm: number;
  fuelL: number;
  fuelPerNm: number;
  groundSpeedKt: number;
  hours: number;
  performance: CruisePerformance;
  windComponentKt: number;
};

/** Candidate altitudes: the cruise table's altitude span in 500 ft steps, capped at 12,000 ft. */
export function economyAltitudes(cruise: Cruise) {
  const table = [...new Set(cruise.rows.map((r) => r.pressureAltitudeFt))];
  if (!table.length) return [];
  const min = Math.max(0, Math.min(...table));
  const max = Math.min(MAX_ALTITUDE_FT, Math.max(...table));
  const out: number[] = [];
  for (let a = min; a <= max; a += ALTITUDE_STEP_FT) out.push(Math.round(a));
  if (!out.includes(Math.round(max))) out.push(Math.round(max));
  return out.sort((a, b) => a - b);
}

function evaluateLeg(
  plan: RoutePlan,
  index: number,
  fromFt: number,
  toFt: number,
  cruise: Cruise,
  oatC: number,
  winds: WindContext,
): EconomyLeg | null {
  const leg = plan.legs[index]!;
  if (!(leg.distanceNm > 0)) return null;
  const altitudeFt = Math.round((fromFt + toFt) / 2);
  const windComponentKt =
    legWind(winds, leg, fromFt, toFt)?.windComponentKt ?? 0;
  const performance = cruisePerformance(
    cruise,
    altitudeFt,
    oatC,
    windComponentKt,
    "eco-distance",
  );
  if (!performance) return null;
  const groundSpeedKt = Math.max(
    MIN_GROUND_SPEED_KT,
    performance.ktas + windComponentKt,
  );
  const hours = leg.distanceNm / groundSpeedKt;
  const fuelL = performance.fuelFlowLph * hours;
  return {
    altitudeFt,
    distanceNm: leg.distanceNm,
    fuelL,
    fuelPerNm: fuelL / leg.distanceNm,
    groundSpeedKt,
    hours,
    performance,
    windComponentKt,
  };
}

type Cell = {
  fuelL: number;
  hours: number;
  leg: EconomyLeg | null;
  previous: number;
};
const better = (fuel: number, hours: number, cell: Cell) =>
  fuel < cell.fuelL - 0.001 ||
  (Math.abs(fuel - cell.fuelL) <= 0.001 && hours < cell.hours);

export function economySuggestions(
  plan: RoutePlan,
  cruise: Cruise,
  oatC: number,
  input: Parameters<typeof windContext>[0],
) {
  if (plan.points.length < 2 || !plan.legs.length)
    return { error: "no-legs" as const };
  const candidates = economyAltitudes(cruise);
  if (!candidates.length) return { error: "no-altitudes" as const };
  const winds = windContext(input, plan.points);
  // Legacy let every point go anywhere from sea level up, so it suggested "S.L." en route or
  // airports at 10,000 ft. Airports sit on their elevation (the lowest candidate at or above it),
  // en-route points stay 1000 ft above the higher airport.
  const lastPoint = plan.points.length - 1;
  const lowestFrom = (ft: number) =>
    candidates.find((c) => c >= ft) ?? candidates.at(-1)!;
  const highestAirportFt = Math.max(
    plan.departure.elevationFt,
    plan.destination.elevationFt,
  );
  const allowed = (point: number, altitudeFt: number) =>
    point === 0
      ? altitudeFt === lowestFrom(plan.departure.elevationFt)
      : point === lastPoint
        ? altitudeFt === lowestFrom(plan.destination.elevationFt)
        : altitudeFt >= lowestFrom(highestAirportFt + EN_ROUTE_CLEARANCE_FT);
  // Dynamic programme over (point, altitude): least fuel, then least time.
  const layers: Cell[][] = [
    candidates.map((ft) => ({
      fuelL: allowed(0, ft) ? 0 : Infinity,
      hours: 0,
      leg: null,
      previous: -1,
    })),
  ];
  plan.legs.forEach((_, index) => {
    const prev = layers[index]!;
    const next: Cell[] = candidates.map(() => ({
      fuelL: Infinity,
      hours: Infinity,
      leg: null,
      previous: -1,
    }));
    prev.forEach((cell, from) => {
      if (!Number.isFinite(cell.fuelL)) return;
      candidates.forEach((toFt, to) => {
        if (!allowed(index + 1, toFt)) return;
        const leg = evaluateLeg(
          plan,
          index,
          candidates[from]!,
          toFt,
          cruise,
          oatC,
          winds,
        );
        if (!leg) return;
        const fuel = cell.fuelL + leg.fuelL;
        const hours = cell.hours + leg.hours;
        if (better(fuel, hours, next[to]!))
          next[to] = { fuelL: fuel, hours, leg, previous: from };
      });
    });
    layers.push(next);
  });

  let best = -1;
  layers.at(-1)!.forEach((cell, i) => {
    if (
      Number.isFinite(cell.fuelL) &&
      (best < 0 || better(cell.fuelL, cell.hours, layers.at(-1)![best]!))
    )
      best = i;
  });
  if (best < 0) return { error: "no-solution" as const };

  const altitudes: number[] = new Array<number>(plan.points.length);
  const legs: (EconomyLeg | null)[] = new Array<EconomyLeg | null>(
    plan.legs.length,
  );
  for (let p = plan.points.length - 1, c = best; p >= 0; p--) {
    altitudes[p] = candidates[c]!;
    if (p > 0) {
      const cell = layers[p]![c]!;
      legs[p - 1] = cell.leg;
      c = cell.previous;
    }
  }
  const totals = {
    distanceNm: 0,
    fuelL: 0,
    hours: 0,
    power: 0,
    powerNm: 0,
    rpm: 0,
    map: 0,
    settingNm: 0,
  };
  for (const leg of legs) {
    if (!leg) continue;
    totals.distanceNm += leg.distanceNm;
    totals.fuelL += leg.fuelL;
    totals.hours += leg.hours;
    if (leg.performance.powerPct !== null) {
      totals.power += leg.performance.powerPct * leg.distanceNm;
      totals.powerNm += leg.distanceNm;
    }
    // shortcut: RPM/MAP come from the chosen table row's label, not interpolated between altitudes.
    const setting = rpmMap(leg.performance.setting);
    if (setting) {
      totals.rpm += setting.rpm * leg.distanceNm;
      totals.map += setting.mapInHg * leg.distanceNm;
      totals.settingNm += leg.distanceNm;
    }
  }
  return {
    points: plan.points.map((point, i) => ({
      key: pointKey(point),
      point,
      altitudeFt: altitudes[i]!,
    })),
    legs,
    totalFuelL: totals.fuelL,
    hours: totals.hours,
    averageGroundSpeedKt:
      totals.hours > 0 ? totals.distanceNm / totals.hours : null,
    averagePowerPct: totals.powerNm > 0 ? totals.power / totals.powerNm : null,
    averageSetting:
      totals.settingNm > 0
        ? {
            rpm: totals.rpm / totals.settingNm,
            mapInHg: totals.map / totals.settingNm,
          }
        : null,
    routeWeatherAvailable: winds.samples.length > 0,
    oatC,
  };
}
