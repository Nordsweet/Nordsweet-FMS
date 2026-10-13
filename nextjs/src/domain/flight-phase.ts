import { type Aircraft } from "~/data/aircraft";
import { type Airport } from "~/data/schemas";

import { pressureAltitudeFt } from "./atmosphere";
import { conservativeRead, interpolateGrid } from "./grid";

/** Legacy flight phases, in order (PERFORMANCE_PHASES). */
export const FLIGHT_PHASES = [
  "taxiout",
  "takeoff",
  "climb",
  "cruise",
  "descent",
  "landing",
  "taxiin",
] as const;
export type FlightPhase = (typeof FLIGHT_PHASES)[number];

const DESTINATION_PHASES: FlightPhase[] = ["descent", "landing", "taxiin"];

/** The airport a phase's performance is read for (legacy getPerformanceAirportForPhase). */
export const phaseAirport = (
  phase: FlightPhase,
  departure: Airport | null,
  destination: Airport | null,
) => (DESTINATION_PHASES.includes(phase) ? destination : departure);

/**
 * Legacy getEmergencyAltitudeContext: ground phases use the airport elevation, cruise the cruise
 * altitude and OAT, climb/descent the airport's pressure altitude.
 */
export function emergencyAltitude(
  phase: FlightPhase,
  airport: Airport | null,
  conditions: {
    qnhHpa: number;
    surfaceTempC: number;
    cruiseAltitudeFt: number;
    cruiseOatC: number;
  },
) {
  if (phase === "cruise")
    return {
      kind: "cruise" as const,
      altitudeFt: conditions.cruiseAltitudeFt,
      temperatureC: conditions.cruiseOatC,
    };
  const elevationFt = airport?.elevationFt ?? 0;
  return phase === "climb" || phase === "descent"
    ? {
        kind: "pressure" as const,
        altitudeFt: pressureAltitudeFt(elevationFt, conditions.qnhHpa),
        temperatureC: conditions.surfaceTempC,
      }
    : {
        kind: "elevation" as const,
        altitudeFt: elevationFt,
        temperatureC: conditions.surfaceTempC,
      };
}

type EmergencyTable = NonNullable<Aircraft["emergencyClimb"]>["vyse"];

/** Legacy one-engine-inop climb: interpolated, the next conservative table entry, and its basis. */
export function emergencyClimb(
  table: EmergencyTable,
  weightKg: number,
  altitudeFt: number,
  temperatureC: number,
) {
  const values = {
    weightKg,
    pressureAltitudeFt: altitudeFt,
    temperatureC,
  } as Record<string, number>;
  const value = (axis: string) => values[axis] ?? 0;
  const at: Partial<Record<string, number>> = {};
  return {
    interpolated: interpolateGrid(table.grid, value),
    conservative: conservativeRead(table.grid, value, at),
    basis: {
      weightKg: at.weightKg!,
      pressureAltitudeFt: at.pressureAltitudeFt!,
      temperatureC: at.temperatureC!,
    },
  };
}
