import type { ArrivalLeg } from "./airport-arrival";
import type { flightPlanProfile } from "./flight-plan-profile";
import { initialBearingDeg, type LatLon } from "./geo";
import { nearestLeg } from "./progress";
import { windTriangle } from "./wind";

/** Fuel remaining at each displayed FPL row, along the same curved path as navigation. */
export function fplFuel(input: {
  profile: ReturnType<typeof flightPlanProfile>;
  position: LatLon | null;
  activeLeg: number;
  currentFuelL: number | null;
  legs: ArrivalLeg[];
  fallback: ArrivalLeg;
}): (number | null)[] {
  const { profile, position, activeLeg, currentFuelL, legs, fallback } = input;
  const unavailable = () => profile.rows.map(() => null);
  if (
    !position ||
    currentFuelL === null ||
    !Number.isFinite(currentFuelL) ||
    currentFuelL < 0
  )
    return unavailable();
  const projection = nearestLeg(profile.path, position, activeLeg);
  if (!projection) return unavailable();
  const startNm =
    profile.distances[projection.index + 1]! - projection.remaining;
  let burnedL = 0;
  const segments = profile.path.legs
    .slice(projection.index)
    .map((leg, offset) => {
      const i = projection.index + offset;
      const model = legs[leg] ?? fallback;
      const speed = windTriangle(
        initialBearingDeg(profile.path.points[i]!, profile.path.points[i + 1]!),
        model.tasKt,
        model.wind,
      );
      const rate =
        speed &&
        Number.isFinite(model.tasKt) &&
        model.tasKt > 0 &&
        Number.isFinite(model.fuelFlowLph) &&
        model.fuelFlowLph >= 0 &&
        Number.isFinite(speed.groundSpeedKt)
          ? model.fuelFlowLph / speed.groundSpeedKt
          : NaN;
      const fromNm = offset === 0 ? startNm : profile.distances[i]!;
      const toNm = profile.distances[i + 1]!;
      if (offset === 0) burnedL += projection.distance * rate;
      const beforeL = burnedL;
      burnedL += (toNm - fromNm) * rate;
      return { fromNm, toNm, beforeL, rate };
    });
  return profile.rows.map((row) => {
    // Past occurrences have no historical fuel reading; never fabricate one by extrapolating backwards.
    if (
      (row.routeIndex !== null && row.routeIndex <= activeLeg) ||
      row.distanceNm < startNm - 1e-6
    )
      return null;
    const segment = segments.find((s) => row.distanceNm <= s.toNm + 1e-6);
    if (!segment) return null;
    const fuel =
      currentFuelL -
      segment.beforeL -
      Math.max(0, row.distanceNm - segment.fromNm) * segment.rate;
    return Number.isFinite(fuel) ? Math.max(0, fuel) : null;
  });
}
