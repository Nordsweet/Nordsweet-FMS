import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { routeKey } from "~/data/flight";
import { isaTemperatureC } from "~/domain/atmosphere";
import { computeClimb } from "~/domain/climb";
import { computeFuelPlan } from "~/domain/fuel";
import { parseMetar } from "~/domain/metar";
import { type Segment, computeNavLog } from "~/domain/navlog";
import { computeLoading } from "~/domain/weight-balance";
import { useFlight } from "~/stores/flight";

import { useBriefing } from "./weather";

const FINAL_RESERVE_MINUTES = 45; // piston aircraft
/** No POH descent data for any aircraft: plan a standard 500 fpm descent at cruise speed and flow. */
export const DESCENT_RATE_FPM = 500;

/** Everything the planner shows, derived from the current flight. */
export function usePlan() {
  const flight = useFlight((s) => s.flight);
  const aircraftList = useQuery(api.aircraft.list.queryOptions(undefined));
  const aircraft =
    aircraftList.data?.find((a) => a.id === flight.aircraftId) ?? null;
  const departureAirport = useQuery({
    ...api.airports.get.queryOptions({ code: flight.departure?.ident ?? "" }),
    enabled: !!flight.departure,
  });
  const destinationAirport = useQuery({
    ...api.airports.get.queryOptions({ code: flight.destination?.ident ?? "" }),
    enabled: !!flight.destination,
  });
  const departureMetar =
    useBriefing(flight.departure).briefing.data?.metar ?? null;

  const departureProcedures = useQuery({
    ...api.procedures.byAirport.queryOptions({
      airport: flight.departure?.ident ?? "",
    }),
    enabled: !!flight.departure,
  });
  const destinationProcedures = useQuery({
    ...api.procedures.byAirport.queryOptions({
      airport: flight.destination?.ident ?? "",
    }),
    enabled: !!flight.destination,
  });
  const sid =
    departureProcedures.data?.find(
      (p) => p.type === "SID" && p.designator === flight.sid,
    ) ?? null;
  const star =
    destinationProcedures.data?.find(
      (p) => p.type === "STAR" && p.designator === flight.star,
    ) ?? null;
  // SID and STAR legs wrap the en-route waypoints.
  const route = [
    flight.departure,
    ...(sid?.legs ?? []),
    ...flight.waypoints,
    ...(star?.legs ?? []),
    flight.destination,
  ]
    .filter((p) => p !== null)
    .map((p) => ({ ident: p.ident, lat: p.lat, lon: p.lon }));
  // Forecast winds apply only to the route and altitude they were fetched for.
  const legWinds =
    flight.legWinds?.routeKey === routeKey(route, flight.cruiseAltitudeFt)
      ? flight.legWinds
      : null;
  const cruise = {
    tasKt: flight.cruiseTasKt,
    wind: flight.wind,
    fuelFlowLph: flight.fuelFlowLph,
  };

  // Loading first: the climb depends on the take-off weight. Trip fuel is refined below.
  const wb = aircraft?.weightBalance ?? null;
  const takeoffFuelL = Math.max(0, flight.fuel.blockL - flight.fuel.taxiL);
  const takeoffLoading = wb
    ? computeLoading(wb, { stationsKg: flight.stationsKg, fuelL: takeoffFuelL })
    : null;

  const departureElevationFt = departureAirport.data?.elevationFt ?? null;
  const destinationElevationFt = destinationAirport.data?.elevationFt ?? null;
  const metarTemperature = departureMetar
    ? parseMetar(departureMetar.raw).temperatureC
    : null;
  const isaDeviationC =
    metarTemperature !== null && departureElevationFt !== null
      ? metarTemperature - isaTemperatureC(departureElevationFt)
      : 0;
  const climbResult =
    aircraft?.climb &&
    takeoffLoading &&
    departureElevationFt !== null &&
    flight.cruiseAltitudeFt > departureElevationFt
      ? computeClimb(aircraft.climb, {
          weightKg: takeoffLoading.totalKg,
          fromFt: departureElevationFt,
          toFt: flight.cruiseAltitudeFt,
          isaDeviationC,
        })
      : null;
  const climb: Segment | undefined = climbResult
    ? {
        minutes: climbResult.minutes,
        tasKt: climbResult.averageTasKt,
        fuelFlowLph: climbResult.fuelFlowLph ?? flight.fuelFlowLph,
      }
    : undefined;
  const descent: Segment | undefined =
    destinationElevationFt !== null &&
    flight.cruiseAltitudeFt > destinationElevationFt
      ? {
          minutes:
            (flight.cruiseAltitudeFt - destinationElevationFt) /
            DESCENT_RATE_FPM,
          tasKt: flight.cruiseTasKt,
          fuelFlowLph: flight.fuelFlowLph,
        }
      : undefined;

  const navLog =
    flight.departure && flight.destination
      ? computeNavLog(route, {
          ...cruise,
          legWinds: legWinds?.winds,
          climb,
          descent,
        })
      : null;
  const alternateLog =
    flight.destination && flight.alternate
      ? computeNavLog([flight.destination, flight.alternate], cruise)
      : null;

  const fuelPlan =
    navLog?.fuelL != null
      ? computeFuelPlan({
          tripFuelL: navLog.fuelL,
          alternateMinutes: alternateLog?.minutes ?? 0,
          fuelFlowLph: flight.fuelFlowLph,
          taxiL: flight.fuel.taxiL,
          climbExtraL: flight.fuel.climbExtraL,
          departureArrivalMinutes: 0,
          finalReserveMinutes: FINAL_RESERVE_MINUTES,
          blockFuelL: flight.fuel.blockL,
        })
      : null;

  const landingFuelL = Math.max(0, takeoffFuelL - (fuelPlan?.tripL ?? 0));
  const loading =
    wb && takeoffLoading
      ? {
          takeoff: takeoffLoading,
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
    route,
    sid,
    star,
    departureProcedures: departureProcedures.data ?? [],
    destinationProcedures: destinationProcedures.data ?? [],
    legWinds,
    aircraft,
    aircraftList: aircraftList.data ?? [],
    navLog,
    climb: climbResult,
    climbIsaDeviationC: metarTemperature !== null ? isaDeviationC : null,
    alternateLog,
    fuelPlan,
    loading,
  };
}
