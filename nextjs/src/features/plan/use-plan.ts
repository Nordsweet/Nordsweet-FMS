import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { navigationRoute } from "~/domain/navigation-route";

import { api } from "~/api";
import { type Airport, type Navpoint, type Procedure } from "~/data/schemas";
import { type Flight, type FlightPoint } from "~/data/flight";
import { findAirport } from "~/api/search";
import { pressureAltitudeFt } from "~/domain/atmosphere";
import { cruisePerformance } from "~/domain/cruise-performance";
import {
  type FuelPlanningInput,
  PLANNING_RATE_FACTOR,
  bestRateClimb,
  computeFuelPlanning,
  routeEconomy,
} from "~/domain/fuel-planning";
import { distanceNm } from "~/domain/geo";
import { type NavPoint } from "~/domain/progress";
import { routeWithTrafficPattern } from "~/domain/traffic-pattern";
import { resolvedDeparturePattern } from "~/domain/departure-pattern";
import { fallbackFlightRoute } from "~/domain/waypoint-insertion";
import { type MetarValues, parseMetar } from "~/domain/metar";
import {
  FALLBACK_CLIMB_GRADIENT_FT_PER_NM,
  type ProcedureType,
  type RouteData,
  type RoutePlanInput,
  type SurfaceWind,
  buildRoutePlan,
  createRouteContext,
  requestedProcedures,
  formatRoutePoint,
  pointKey,
} from "~/domain/route-plan";
import { computeLoading, weightBalanceSheet } from "~/domain/weight-balance";
import { useFlight } from "~/stores/flight";

import { useBriefing } from "./weather";

const SPEED_BOUNDS_KT = { min: 30, max: 400 };

const surfaceWind = (metar: MetarValues | null): SurfaceWind | null =>
  metar
    ? { directionDeg: metar.windDirectionDeg, speedKt: metar.windSpeedKt }
    : null;

/** Lookups over the bundled reference data the route planner needs (built once per dataset). */
function useRouteData(): RouteData | null {
  const airports = useQuery(api.airports.list.queryOptions(undefined));
  const navpoints = useQuery(api.navpoints.list.queryOptions(undefined));
  const procedures = useQuery(api.procedures.all.queryOptions(undefined));
  const airways = useQuery(api.airways.list.queryOptions(undefined));
  return useMemo(() => {
    if (!airports.data || !navpoints.data || !procedures.data || !airways.data)
      return null;
    const points = new Map<string, Navpoint>();
    for (const p of navpoints.data)
      for (const key of [p.ident, ...p.aliases])
        if (!points.has(key)) points.set(key, p);
    const byAirport = new Map<string, Procedure[]>();
    for (const p of procedures.data)
      byAirport.set(`${p.airport}|${p.type}`, [
        ...(byAirport.get(`${p.airport}|${p.type}`) ?? []),
        p,
      ]);
    const airportList = airports.data;
    return {
      airport: (code) => findAirport(airportList, code) ?? null,
      point: (key) => points.get(key) ?? null,
      procedures: (airport, type) => byAirport.get(`${airport}|${type}`) ?? [],
      airways: airways.data,
    };
  }, [airports.data, navpoints.data, procedures.data, airways.data]);
}

/** Departure/landing times: the one the pilot did not set follows the ETE. */
function scheduleTimes(
  schedule: { departure: string; destination: string },
  eteMinutes: number,
) {
  const shift = (value: string, minutes: number) => {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()) || !Number.isFinite(minutes))
      return "";
    const d = new Date(
      Math.round((date.getTime() + minutes * 60000) / 60000) * 60000,
    );
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const { departure, destination } = schedule;
  if (departure && !destination)
    return { departure, destination: shift(departure, eteMinutes) };
  if (destination && !departure)
    return { departure: shift(destination, -eteMinutes), destination };
  return { departure, destination };
}

/** Legacy: both times set by the pilot → the cruise speed that flies the route in that time. */
function speedForDuration(
  minutesAt: (speedKt: number) => number,
  durationMinutes: number,
) {
  if (!(durationMinutes > 0)) return null;
  const { min, max } = SPEED_BOUNDS_KT;
  if (durationMinutes <= minutesAt(max)) return max;
  if (durationMinutes >= minutesAt(min)) return min;
  let low = min;
  let high = max;
  for (let i = 0; i < 32; i++) {
    const mid = (low + high) / 2;
    if (minutesAt(mid) > durationMinutes) low = mid;
    else high = mid;
  }
  return Math.max(min, Math.min(max, Math.round((low + high) / 2)));
}

/** Everything the planner shows, derived from the current flight. */
export function usePlan(snapshot?: Flight) {
  const draft = useFlight((s) => s.flight);
  const flight = snapshot ?? draft;
  const aircraftList = useQuery(api.aircraft.list.queryOptions(undefined));
  const aircraft =
    aircraftList.data?.find((a) => a.id === flight.aircraftId) ?? null;
  const routeData = useRouteData();
  const airportOf = (point: FlightPoint | null): Airport | null =>
    point && routeData ? routeData.airport(point.ident) : null;
  const departureAirport = airportOf(flight.departure);
  const destinationAirport = airportOf(flight.destination);
  const alternateAirport = airportOf(flight.alternate);
  const departureMetarRaw =
    useBriefing(flight.departure).briefing.data?.metar ?? null;
  const destinationMetarRaw =
    useBriefing(flight.destination).briefing.data?.metar ?? null;
  const metar = departureMetarRaw ? parseMetar(departureMetarRaw.raw) : null;
  const destinationMetar = destinationMetarRaw
    ? parseMetar(destinationMetarRaw.raw)
    : null;
  const metarTemperature = metar?.temperatureC ?? null;
  const surfaceTempC = metarTemperature ?? 15;
  const qnhHpa = metar?.qnhHpa ?? 1013;

  // Legacy W&B: the usable fuel is the block fuel (taxi fuel is not deducted).
  const wb = aircraft?.weightBalance ?? null;
  const takeoffFuelL = flight.fuel.blockL;
  const takeoffLoading = wb
    ? computeLoading(wb, { stationsKg: flight.stationsKg, fuelL: takeoffFuelL })
    : null;
  // Legacy default weight when the aircraft has no W&B data.
  const takeoffWeightKg = takeoffLoading?.totalKg ?? 1100;

  // Route climb gradient: 80% of the POH best rate at the departure, over the climb speed.
  const climbAtDeparture =
    aircraft && departureAirport
      ? bestRateClimb(
          aircraft.climb,
          takeoffWeightKg,
          pressureAltitudeFt(departureAirport.elevationFt, qnhHpa),
          surfaceTempC,
        )
      : null;
  const climbGradientFtPerNm = climbAtDeparture
    ? Math.max(
        100,
        (climbAtDeparture.rateFpm * PLANNING_RATE_FACTOR) /
          (Math.max(60, climbAtDeparture.iasKt) / 60),
      )
    : FALLBACK_CLIMB_GRADIENT_FT_PER_NM;

  const departureGround = useQuery({
    ...api.ground.byAirport.queryOptions({
      airport: flight.departure?.ident ?? "",
    }),
    enabled: !!flight.departurePattern,
  }).data;
  const departurePattern = resolvedDeparturePattern(
    flight,
    departureAirport,
    departureGround,
  );
  const routeInput: RoutePlanInput | null =
    departureAirport && destinationAirport
      ? {
          departure: departureAirport,
          destination: destinationAirport,
          alternate: alternateAirport,
          altitudeFt: flight.cruiseAltitudeFt,
          routeText: flight.routeText,
          selections: {
            SID: flight.sid,
            STAR: flight.star,
            APPROACH: flight.approach,
          },
          inlineSelections: flight.inlineProcedureSelections,
          insertedWaypoints: flight.waypoints,
          trafficPattern: flight.trafficPattern,
          arrivalToArp: flight.arrivalToArp,
          departurePattern,
          pointRestrictions: flight.pointRestrictions,
          waypointAltitudes: flight.waypointAltitudes,
          waypointWx: flight.waypointWx,
          conditionsWind: surfaceWind(metar),
          runwayWind: (airport) =>
            surfaceWind(
              airport.ident === departureAirport.ident
                ? metar
                : airport.ident === destinationAirport.ident
                  ? destinationMetar
                  : null,
            ),
          climbGradientFtPerNm,
        }
      : null;
  const plan =
    routeData && routeInput ? buildRoutePlan(routeData, routeInput) : null;
  const routeContext =
    routeData && routeInput ? createRouteContext(routeData, routeInput) : null;
  const requested =
    routeData && routeInput ? requestedProcedures(routeData, routeInput) : null;
  /** Per select: its airport's procedures, the AUTO pick, and the one named in the route text. */
  const procedureOptions = (type: ProcedureType) => {
    const airport = type === "SID" ? departureAirport : destinationAirport;
    return {
      procedures: routeContext?.proceduresAt(airport, type) ?? [],
      suggested: routeContext?.suggested(airport, type) ?? null,
      requested: requested?.[type] ?? null,
    };
  };

  // Legs at their average point altitude and wind, as the legacy fuel table and economy use them.
  const routeLegs =
    plan?.legs.map((leg, i) => ({
      distanceNm: leg.distanceNm,
      altitudeFt: Math.round(
        ((plan.pointAltitudeByKey[pointKey(leg.from)] ?? plan.altitudeFt) +
          (plan.pointAltitudeByKey[pointKey(leg.to)] ?? plan.altitudeFt)) /
          2,
      ),
      windComponentKt: plan.legWinds[i]?.windComponentKt ?? 0,
    })) ?? [];

  // Cruise speed: both times set → the speed they need; ECO → route best-range speed; else typed.
  const ecoSpeedKt = (() => {
    if (!flight.cruiseSpeedEco || !aircraft?.cruise) return null;
    const economy = routeEconomy(
      { aircraft, legs: routeLegs, cruiseOatC: flight.cruiseOatC },
      "eco-distance",
    );
    const ktas =
      economy?.averageKtas ??
      cruisePerformance(
        aircraft.cruise,
        flight.cruiseAltitudeFt,
        flight.cruiseOatC,
        0,
        "eco-distance",
      )?.ktas;
    return ktas === undefined ? null : Math.max(30, Math.round(ktas));
  })();
  const { departure: scheduledDeparture, destination: scheduledLanding } =
    flight.schedule;
  const scheduleSpeedKt =
    plan && scheduledDeparture && scheduledLanding
      ? speedForDuration(
          plan.minutesAt,
          (new Date(scheduledLanding).getTime() -
            new Date(scheduledDeparture).getTime()) /
            60000,
        )
      : null;
  const cruiseSpeedKt = scheduleSpeedKt ?? ecoSpeedKt ?? flight.cruiseTasKt;
  const eteMinutes =
    plan && cruiseSpeedKt > 0 ? plan.minutesAt(cruiseSpeedKt) : NaN;
  const schedule = scheduleTimes(flight.schedule, eteMinutes);

  // Map, fly mode and export: the route's fixes (TOC/TOD are profile events, not points to fly to).
  const baseRoute: NavPoint[] = plan
    ? navigationRoute(plan)
    : fallbackFlightRoute(flight);
  const arrivalRoute =
    !plan &&
    flight.trafficPattern &&
    flight.trafficPattern.airport.ident === flight.destination?.ident
      ? routeWithTrafficPattern(baseRoute, flight.trafficPattern)
      : baseRoute;
  const route =
    !plan && departurePattern
      ? routeWithTrafficPattern(arrivalRoute, departurePattern)
      : arrivalRoute;

  const exportPoints = plan
    ? plan.points.map((p) => ({
        ident: formatRoutePoint(p),
        lat: p.lat,
        lon: p.lon,
        altitudeFt:
          plan.pointAltitudeByKey[pointKey(p)] ?? flight.cruiseAltitudeFt,
      }))
    : route.map((p) => ({
        ...p,
        altitudeFt: p.altitudeFt ?? flight.cruiseAltitudeFt,
      }));

  const fuelInput: Omit<FuelPlanningInput, "landingWeightKg"> | null =
    aircraft && plan && departureAirport && destinationAirport
      ? {
          aircraft,
          departure: {
            ident: departureAirport.ident,
            elevationFt: departureAirport.elevationFt,
          },
          destination: {
            ident: destinationAirport.ident,
            elevationFt: destinationAirport.elevationFt,
          },
          alternate: alternateAirport
            ? {
                ident: alternateAirport.ident,
                elevationFt: alternateAirport.elevationFt,
                distanceNm: distanceNm(destinationAirport, alternateAirport),
              }
            : null,
          legs: routeLegs,
          directDistanceNm: distanceNm(departureAirport, destinationAirport),
          cruiseAltitudeFt: flight.cruiseAltitudeFt,
          plannerSpeedKt: cruiseSpeedKt,
          cruiseOatC: flight.cruiseOatC,
          surfaceTempC,
          qnhHpa,
          takeoffWeightKg,
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
  const sheetFor = (alternateFuelL: number) =>
    wb
      ? weightBalanceSheet(wb, {
          stationsKg: flight.stationsKg,
          usableFuelL: takeoffFuelL,
          tripFuelL,
          alternateFuelL,
        })
      : null;
  // Take-off and landing weights do not depend on the alternate fuel.
  const weights = sheetFor(0);
  const loading = weights
    ? { takeoff: weights.takeoff, landing: weights.landing }
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
    aircraft,
    aircraftList: aircraftList.data ?? [],
    routeData,
    exportPoints,
    departureAirport,
    departurePattern,
    destinationAirport,
    alternateAirport,
    plan,
    routeInput,
    procedureOptions,
    route,
    routeLegs,
    cruiseSpeedKt,
    eteMinutes,
    schedule,
    fuelPlanning,
    /** Station whose METAR gave the surface temperature/QNH for fuel planning; null = standard. */
    fuelConditionsSource:
      metarTemperature !== null ? (flight.departure?.ident ?? null) : null,
    loading,
    takeoffWeightKg,
    surfaceTempC,
    qnhHpa,
    weightBalance: sheetFor(fuelPlanning?.rows.alternate.fuelL ?? 0),
  };
}
