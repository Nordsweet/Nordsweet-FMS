import { type WeightBalance } from "~/data/aircraft";

export type StationId = WeightBalance["stations"][number]["id"];

export type Loading = {
  stationsKg: Partial<Record<StationId, number>>;
  fuelL: number;
};

export type LoadingResult = {
  totalKg: number;
  momentKgm: number;
  /** Centre of gravity, metres from the aircraft datum. */
  cgM: number;
  overMtow: boolean;
  /** Inside the certified CG envelope (weight and moment). */
  withinEnvelope: boolean;
};

/** Ray casting in (moment, weight) space; points on the edge count as inside. */
function insidePolygon(
  points: WeightBalance["envelope"],
  momentKgm: number,
  weightKg: number,
) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!;
    const b = points[j]!;
    const cross =
      (b.momentKgm - a.momentKgm) * (weightKg - a.weightKg) -
      (momentKgm - a.momentKgm) * (b.weightKg - a.weightKg);
    const onSegment =
      Math.abs(cross) < 1e-6 &&
      momentKgm >= Math.min(a.momentKgm, b.momentKgm) - 1e-9 &&
      momentKgm <= Math.max(a.momentKgm, b.momentKgm) + 1e-9 &&
      weightKg >= Math.min(a.weightKg, b.weightKg) - 1e-9 &&
      weightKg <= Math.max(a.weightKg, b.weightKg) + 1e-9;
    if (onSegment) return true;
    if (a.weightKg > weightKg !== b.weightKg > weightKg) {
      const atWeight =
        ((b.momentKgm - a.momentKgm) * (weightKg - a.weightKg)) /
          (b.weightKg - a.weightKg) +
        a.momentKgm;
      if (momentKgm < atWeight) inside = !inside;
    }
  }
  return inside;
}

export function computeLoading(
  wb: WeightBalance,
  loading: Loading,
): LoadingResult {
  let totalKg = wb.emptyWeightKg;
  let momentKgm = wb.emptyWeightKg * wb.emptyArmM;
  for (const station of wb.stations) {
    const kg = loading.stationsKg[station.id] ?? 0;
    totalKg += kg;
    momentKgm += kg * station.armM;
  }
  const fuelKg = loading.fuelL * wb.fuel.densityKgPerL;
  totalKg += fuelKg;
  momentKgm += fuelKg * wb.fuel.armM;
  return {
    totalKg,
    momentKgm,
    cgM: momentKgm / totalKg,
    overMtow: totalKg > wb.mtowKg + 1e-9,
    withinEnvelope: insidePolygon(wb.envelope, momentKgm, totalKg),
  };
}
