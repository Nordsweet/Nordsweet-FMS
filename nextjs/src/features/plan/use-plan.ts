import { useQuery } from "@tanstack/react-query";

import { api } from "~/api";
import { routeKey } from "~/data/flight";
import { isaTemperatureC } from "~/domain/atmosphere";
import { computeClimb } from "~/domain/climb";
import {
  DEFAULT_TAXI_L,
  type FuelPlanningInput,
  computeFuelPlanning,
} from "~/domain/fuel-planning";
import { distanceNm } from "~/domain/geo";
import { parseMetar } from "~/domain/metar";
import { type Segment, computeNavLog } from "~/domain/navlog";
import { computeLoading } from "~/domain/weight-balance";
import { windComponents } from "~/domain/wind";
import { useFlight } from "~/stores/flight";

import { useBriefing } from "./weather";

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
  const alternateAirport = useQuery({
    ...api.airports.get.queryOptions({ code: flight.alternate?.ident ?? "" }),
    enabled: !!flight.alternate,
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
  const taxiL = flight.fuelOverrides.startTaxi?.fuelL ?? DEFAULT_TAXI_L;
  const takeoffFuelL = Math.max(0, flight.fuel.blockL - taxiL);
  const takeoffLoading = wb
    ? computeLoading(wb, { stationsKg: flight.stationsKg, fuelL: takeoffFuelL })
    : null;

  const departureElevationFt = departureAirport.data?.elevationFt ?? null;
  const destinationElevationFt = destinationAirport.data?.elevationFt ?? null;
  const metar = departureMetar ? parseMetar(departureMetar.raw) : null;
  const metarTemperature = metar?.temperatureC ?? null;
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

  // Legacy fuel table: legs at their point altitudes (airports at elevation, TOC/TOD and waypoints at cruise).
  const fuelInput: Omit<FuelPlanningInput, "landingWeightKg"> | null =
    aircraft &&
    navLog &&
    flight.departure &&
    flight.destination &&
    departureElevationFt !== null &&
    destinationElevationFt !== null
      ? {
          aircraft,
          departure: {
            ident: flight.departure.ident,
            elevationFt: departureElevationFt,
          },
          destination: {
            ident: flight.destination.ident,
            elevationFt: destinationElevationFt,
          },
          alternate:
            flight.alternate && alternateAirport.data
              ? {
                  ident: flight.alternate.ident,
                  elevationFt: alternateAirport.data.elevationFt,
                  distanceNm: distanceNm(flight.destination, flight.alternate),
                }
              : null,
          legs: navLog.legs.map((leg, i) => {
            const pointFt = (index: number) =>
              index === 0
                ? departureElevationFt
                : index === navLog.legs.length
                  ? destinationElevationFt
                  : flight.cruiseAltitudeFt;
            return {
              distanceNm: leg.distanceNm,
              altitudeFt: Math.round((pointFt(i) + pointFt(i + 1)) / 2),
              windComponentKt: -windComponents(leg.trueCourseDeg, leg.wind)
                .headwindKt,
            };
          }),
          directDistanceNm: distanceNm(flight.departure, flight.destination),
          cruiseAltitudeFt: flight.cruiseAltitudeFt,
          plannerSpeedKt: flight.cruiseTasKt,
          cruiseOatC: flight.cruiseOatC,
          surfaceTempC: metarTemperature ?? 15,
          qnhHpa: metar?.qnhHpa ?? 1013,
          // Legacy default weight when the aircraft has no W&B data.
          takeoffWeightKg: takeoffLoading?.totalKg ?? 1100,
          overrides: flight.fuelOverrides,
          blockFuelL: flight.fuel.blockL,
        }
      : null;
  const firstPass = fuelInput
    ? computeFuelPlanning({
        ...fuelInput,
        landingWeightKg: fuelInput.takeoffWeightKg,
      })
    : null;
  const tripFuelL = firstPass?.rows.plannedTrip.fuelL ?? 0;
  const landingFuelL = Math.max(0, takeoffFuelL - tripFuelL);
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

  // The alternate's climb uses the landing weight, known only once trip fuel is.
  const fuelPlanning =
    fuelInput && loading
      ? computeFuelPlanning({
          ...fuelInput,
          landingWeightKg: loading.landing.totalKg,
        })
      : firstPass;

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
    climbSegment: climb,
    descentSegment: descent,
    climbIsaDeviationC: metarTemperature !== null ? isaDeviationC : null,
    alternateLog,
    fuelPlanning,
    /** Station whose METAR gave the surface temperature/QNH for fuel planning; null = standard. */
    fuelConditionsSource:
      metarTemperature !== null ? (flight.departure?.ident ?? null) : null,
    loading,
  };
}
