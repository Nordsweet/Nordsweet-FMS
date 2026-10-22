import type { Aircraft } from "~/data/aircraft";
import type { Flight } from "~/data/flight";
import type { ArrivalLeg } from "./airport-arrival";
import { cruisePerformance } from "./cruise-performance";
import type { computeFuelPlanning } from "./fuel-planning";
import type { TurnPerformance } from "./fly-by";
import type { NavPoint } from "./progress";
import type { RoutePlan } from "./route-plan";
import { routeSpeedProfile } from "./route-speed-profile";

/** Shared speed, wind and fuel-flow assumptions for airport arrival and FPL fuel estimates. */
export function arrivalFuelModel({
  aircraft,
  flight,
  plan,
  route,
  cruiseSpeedKt,
  fuelPlanning,
  turns,
}: {
  aircraft: Aircraft | null;
  flight: Flight;
  plan: RoutePlan | null;
  route: NavPoint[];
  cruiseSpeedKt: number;
  fuelPlanning: ReturnType<typeof computeFuelPlanning> | null;
  turns?: TurnPerformance;
}) {
  const trip = fuelPlanning?.rows.plannedTrip;
  const flow =
    fuelPlanning?.cruise.fuelFlowLph ??
    (aircraft?.cruise
      ? cruisePerformance(
          aircraft?.cruise,
          flight.cruiseAltitudeFt,
          flight.cruiseOatC,
          0,
          "eco-time",
        )?.fuelFlowLph
      : null) ??
    (trip?.fuelL && trip.minutes ? trip.fuelL / (trip.minutes / 60) : null);
  const performance = turns ?? { tasKt: cruiseSpeedKt };
  const direct: ArrivalLeg = {
    tasKt: cruiseSpeedKt,
    fuelFlowLph: flow ?? NaN,
    wind: {
      directionDeg: performance.windDirectionDeg ?? 0,
      speedKt: performance.windSpeedKt ?? 0,
    },
  };
  const speeds = routeSpeedProfile(
    plan,
    aircraft,
    cruiseSpeedKt,
    flight.cruiseAltitudeFt,
  );
  const legs = route.slice(1).map((point): ArrivalLeg => {
    const plannedIndex =
      plan?.legs.findIndex((leg) => leg.to.id === point.ident) ?? -1;
    const planned = speeds.legs[plannedIndex];
    const plannedWind = plan?.legWinds[plannedIndex]?.wind;
    const climbing =
      point.patternOperation === "leave" || planned?.phase === "climb";
    return {
      tasKt:
        point.turnPerformance?.tasKt ??
        planned?.tasKt ??
        (climbing
          ? speeds.phases.climb
          : point.patternOperation === "join"
            ? speeds.phases.landing
            : cruiseSpeedKt),
      fuelFlowLph: climbing
        ? (aircraft?.climb?.fuelFlowLph ?? direct.fuelFlowLph)
        : direct.fuelFlowLph,
      wind: plannedWind
        ? {
            directionDeg: plannedWind.windDirection,
            speedKt: plannedWind.windSpeed,
          }
        : direct.wind,
    };
  });
  return { flow, performance, direct, legs };
}
