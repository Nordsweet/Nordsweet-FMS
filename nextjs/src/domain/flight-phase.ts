import { type ClimbTable } from "~/data/aircraft";
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

export type ClimbConfig = Pick<ClimbTable, "flaps" | "profile" | "engines">;
/** Legacy climb CONFIG defaults: flaps take-off, Vy, both engines. */
export const DEFAULT_CLIMB_CONFIG: ClimbConfig = {
  flaps: "takeoff",
  profile: "vy",
  engines: "both",
};

/**
 * The table for a climb configuration. With one engine inoperative legacy only has flaps-up
 * tables, so flaps take-off gives none.
 */
export const climbTableFor = (tables: ClimbTable[], config: ClimbConfig) =>
  tables.find(
    (t) =>
      t.flaps === config.flaps &&
      t.profile === config.profile &&
      t.engines === config.engines,
  ) ?? null;

/** Legacy climb read: interpolated, the next conservative table entry, and its basis. */
export function climbTableRead(
  table: Pick<ClimbTable, "grid">,
  weightKg: number,
  altitudeFt: number,
  temperatureC: number,
) {
  const values: Record<string, number> = {
    weightKg,
    pressureAltitudeFt: altitudeFt,
    temperatureC,
  };
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

const checklistId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Legacy getChecklistExpectedDisplayValue: flap lines show the CONFIG flaps — take-off flaps in
 * take-off (and Before Taxi / Before Take-off on taxi-out), landing flaps in Before Landing / Final
 * Check. null: keep the checklist's own value.
 */
export function checklistFlaps(
  phase: FlightPhase,
  checklistName: string,
  action: string,
  flaps: { takeoffFlaps: "takeoff" | "up"; landingFlaps: string },
) {
  if (!action.toUpperCase().includes("FLAP")) return null;
  const id = checklistId(checklistName);
  if (
    phase === "landing" &&
    (id.includes("before-landing") || id.includes("final-check"))
  )
    return flaps.landingFlaps;
  if (
    phase === "takeoff" ||
    (phase === "taxiout" &&
      (id.includes("before-taxi") || id.includes("before-take-off")))
  )
    return flaps.takeoffFlaps === "up" ? "UP" : "T/O";
  return null;
}
