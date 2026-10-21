import type { Aircraft } from "~/data/aircraft";
import type { FlightPhase } from "./flight-phase";
import { climbTableRead } from "./flight-phase";
import { isaTemperatureC } from "./atmosphere";
import { patternPlanningPerformance } from "./pattern-performance";
import { pointKey, speedRestrictionKt, type RoutePlan } from "./route-plan";

/** Planned IAS for climb; C172S uses the owner's 72-KIAS Vy, other types use their stored climb table. */
export function climbSpeedKias(
  aircraft: Aircraft | null | undefined,
  altitudeFt = 0,
) {
  if (aircraft?.type.toUpperCase() === "C172S") return 72;
  const table =
    aircraft?.climbTables.find(
      (t) => t.profile === "vy" && t.flaps === "up" && t.engines === "both",
    ) ?? aircraft?.climb;
  return table && aircraft
    ? (climbTableRead(
        table,
        aircraft.weightBalance?.mtowKg ?? 1000,
        altitudeFt,
        isaTemperatureC(altitudeFt),
      ).interpolated?.iasKt ?? null)
    : null;
}

/** Internal phase/leg speed schedule; IAS limits are converted to TAS, never displayed as new pilot inputs. */
export function routeSpeedProfile(
  plan: RoutePlan | null,
  aircraft: Aircraft | null | undefined,
  cruiseTasKt: number,
  altitudeFt: number,
) {
  const climbIas = climbSpeedKias(aircraft, altitudeFt);
  const climbTas = climbIas
    ? patternPlanningPerformance(climbIas, altitudeFt, 0, null).tasKt
    : cruiseTasKt;
  const circuitIas = aircraft?.patternSpeedKt ?? null;
  const circuitTas = circuitIas
    ? patternPlanningPerformance(circuitIas, altitudeFt, 0, null).tasKt
    : cruiseTasKt;
  const phases: Record<FlightPhase, number> = {
    taxiout: 0,
    takeoff: climbTas,
    climb: climbTas,
    cruise: cruiseTasKt,
    descent: cruiseTasKt,
    landing: circuitTas,
    taxiin: 0,
  };
  const legs =
    plan?.legs.map((leg) => {
      const from =
        plan.pointAltitudeByKey[pointKey(leg.from)] ?? plan.altitudeFt;
      const to = plan.pointAltitudeByKey[pointKey(leg.to)] ?? plan.altitudeFt;
      const phase: FlightPhase =
        leg.to.patternOperation === "leave" || to - from > 150
          ? "climb"
          : leg.to.patternOperation === "join"
            ? "landing"
            : from - to > 150
              ? "descent"
              : "cruise";
      const limit = speedRestrictionKt(leg.to);
      const tasKt = Math.min(
        phases[phase],
        limit
          ? patternPlanningPerformance(limit, (from + to) / 2, 0, null).tasKt
          : Infinity,
      );
      return {
        from: leg.from.id,
        to: leg.to.id,
        phase,
        tasKt,
        limitKias: limit,
      };
    }) ?? [];
  return { phases, legs, climbIas };
}
