import { type Climb, type GridAxis } from "~/data/aircraft";

import {
  densityAltitudeFt,
  isaTemperatureC,
  trueAirspeedKt,
} from "./atmosphere";
import { axisMaxima, conservativeRead, interpolateGrid } from "./grid";

/** Legacy planning margin: plan with 80% of the POH best rate of climb. */
export const PLANNING_RATE_FACTOR = 0.8;
const STEP_FT = 100;
/** Below this the aircraft is treated as unable to climb further (practical ceiling). */
const MIN_RATE_FPM = 100;

export type ClimbInput = {
  weightKg: number;
  fromFt: number;
  toFt: number;
  isaDeviationC: number;
};

export type ClimbWarning =
  | { code: "above-table"; axis: GridAxis; value: number; max: number }
  | { code: "ceiling"; altitudeFt: number }
  | { code: "no-fuel-flow" }
  | { code: "draft-data" };

export type ClimbResult = {
  minutes: number;
  /** Time-weighted true airspeed during the climb. */
  averageTasKt: number;
  /** Altitude actually reached (below `toFt` when the ceiling stops the climb). */
  reachedFt: number;
  fuelFlowLph: number | null;
  warnings: ClimbWarning[];
};

/** Time to climb from POH rate-of-climb tables, integrated in 100 ft steps at the given ISA deviation. */
export function computeClimb(climb: Climb, input: ClimbInput): ClimbResult {
  const warnings: ClimbWarning[] = [];
  if (climb.draft) warnings.push({ code: "draft-data" });
  if (climb.fuelFlowLph === null) warnings.push({ code: "no-fuel-flow" });
  const maxima = axisMaxima(climb.grid);
  const highest = new Map<GridAxis, number>();

  let minutes = 0;
  let distanceNmTimesMinutes = 0;
  let altitude = input.fromFt;
  while (altitude < input.toFt - 1e-6) {
    const step = Math.min(STEP_FT, input.toFt - altitude);
    const mid = altitude + step / 2;
    const temperatureC = isaTemperatureC(mid) + input.isaDeviationC;
    const values: Record<GridAxis, number> = {
      weightKg: input.weightKg,
      headwindKt: 0,
      pressureAltitudeFt: mid,
      temperatureC,
      densityAltitudeFt: densityAltitudeFt(mid, temperatureC),
    };
    for (const [axis, v] of Object.entries(values) as [GridAxis, number][]) {
      highest.set(axis, Math.max(highest.get(axis) ?? -Infinity, v));
    }
    // No data above the table's top altitude: stop there rather than extrapolate the last row.
    const topAltitude =
      maxima.get("pressureAltitudeFt") ?? maxima.get("densityAltitudeFt");
    const altitudeAxis = maxima.has("pressureAltitudeFt")
      ? "pressureAltitudeFt"
      : "densityAltitudeFt";
    if (topAltitude !== undefined && values[altitudeAxis] > topAltitude) {
      warnings.push({ code: "ceiling", altitudeFt: Math.round(altitude) });
      break;
    }
    const value = (axis: GridAxis) => values[axis];
    const interpolated = interpolateGrid(climb.grid, value);
    const read = conservativeRead(climb.grid, value);
    const rate =
      Math.min(interpolated.rateFpm, read.rateFpm) * PLANNING_RATE_FACTOR;
    if (rate < MIN_RATE_FPM) {
      warnings.push({ code: "ceiling", altitudeFt: Math.round(altitude) });
      break;
    }
    const stepMinutes = step / rate;
    minutes += stepMinutes;
    distanceNmTimesMinutes +=
      trueAirspeedKt(interpolated.iasKt, values.densityAltitudeFt) *
      stepMinutes;
    altitude += step;
  }

  for (const [axis, max] of maxima) {
    const value = highest.get(axis);
    if (value !== undefined && axis !== "headwindKt" && value > max + 1e-9) {
      warnings.push({ code: "above-table", axis, value, max });
    }
  }
  return {
    minutes,
    averageTasKt: minutes > 0 ? distanceNmTimesMinutes / minutes : 0,
    reachedFt: altitude,
    fuelFlowLph: climb.fuelFlowLph,
    warnings,
  };
}
