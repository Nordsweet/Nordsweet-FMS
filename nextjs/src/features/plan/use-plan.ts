import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { computeFuelPlan } from "~/domain/fuel";
import { computeNavLog } from "~/domain/navlog";
import { computeLoading } from "~/domain/weight-balance";
import { useFlight } from "~/stores/flight";

const FINAL_RESERVE_MINUTES = 45; // piston aircraft

/** Everything the planner shows, derived from the current flight. */
export function usePlan() {
  const flight = useFlight((s) => s.flight);
  const aircraftList = useQuery(api.aircraft.list.queryOptions(undefined));
  const aircraft =
    aircraftList.data?.find((a) => a.id === flight.aircraftId) ?? null;

  const route = [
    flight.departure,
    ...flight.waypoints,
    flight.destination,
  ].filter((p) => p !== null);
  const performance = {
    tasKt: flight.cruiseTasKt,
    wind: flight.wind,
    fuelFlowLph: flight.fuelFlowLph,
  };
  const navLog =
    flight.departure && flight.destination
      ? computeNavLog(route, performance)
      : null;
  const alternateLog =
    flight.destination && flight.alternate
      ? computeNavLog([flight.destination, flight.alternate], performance)
      : null;

  const fuelPlan =
    navLog && navLog.minutes !== null
      ? computeFuelPlan({
          tripMinutes: navLog.minutes,
          alternateMinutes: alternateLog?.minutes ?? 0,
          fuelFlowLph: flight.fuelFlowLph,
          taxiL: flight.fuel.taxiL,
          climbExtraL: flight.fuel.climbExtraL,
          departureArrivalMinutes: 0,
          finalReserveMinutes: FINAL_RESERVE_MINUTES,
          blockFuelL: flight.fuel.blockL,
        })
      : null;

  const wb = aircraft?.weightBalance ?? null;
  const takeoffFuelL = Math.max(0, flight.fuel.blockL - flight.fuel.taxiL);
  const landingFuelL = Math.max(0, takeoffFuelL - (fuelPlan?.tripL ?? 0));
  const loading = wb
    ? {
        takeoff: computeLoading(wb, {
          stationsKg: flight.stationsKg,
          fuelL: takeoffFuelL,
        }),
        landing: computeLoading(wb, {
          stationsKg: flight.stationsKg,
          fuelL: landingFuelL,
        }),
        takeoffFuelL,
        landingFuelL,
      }
    : null;

  return {
    flight,
    aircraft,
    aircraftList: aircraftList.data ?? [],
    navLog,
    alternateLog,
    fuelPlan,
    loading,
  };
}
