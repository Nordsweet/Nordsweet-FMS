import { type Aircraft } from "~/data/aircraft";

import { densityAltitudeFt, pressureAltitudeFt } from "./atmosphere";
import {
  cruisePerformance,
  fuelFlowAtPower,
  lapseTemperatureC,
} from "./cruise-performance";
import { conservativeRead, interpolateGrid } from "./grid";

/**
 * The legacy planner's fuel table, ported rule for rule so plans match it. Litres are rounded up
 * per row, times to whole minutes. Each editable row can be overridden (time and/or fuel).
 */
export const FUEL_ROWS = [
  "plannedTrip",
  "contingency",
  "startTaxi",
  "climb",
  "departureArrival",
  "alternate",
  "reserve",
] as const;
export type FuelRow = (typeof FUEL_ROWS)[number];
export type EditableFuelRow = Exclude<FuelRow, "contingency" | "reserve">;
export type FuelOverrides = Partial<
  Record<EditableFuelRow, { minutes?: number | null; fuelL?: number | null }>
>;

const CONTINGENCY_TRIP_FRACTION = 0.05;
export const CONTINGENCY_HOLD_MINUTES = 5;
const CONTINGENCY_HOLD_ALTITUDE_FT = 1500;
const CONTINGENCY_HOLD_BUFFER = 1.2;
const FALLBACK_HOLD_LPH = 30;
const CLIMB_TIME_FACTOR = 1.1;
const CLIMB_POWER_PCT = 95;
const DEPARTURE_ARRIVAL_MIN_MINUTES = 10;
const DEPARTURE_ARRIVAL_BUFFER = 1.1;
const FALLBACK_GS_KT = 120;
const FALLBACK_FUEL_LPH = 35;
const ALTERNATE_MISSED_APPROACH_MINUTES = 5;
const ALTERNATE_APPROACH_LANDING_MINUTES = 10;
const ALTERNATE_CLIMB_FALLBACK_FPM = 500;
const NO_ALTERNATE_RECIP_MINUTES = 45;
const NO_ALTERNATE_RECIP_CRUISE_FRACTION = 0.15;
const NO_ALTERNATE_RECIP_CRUISE_CAP_MINUTES = 120;
const NO_ALTERNATE_TURBINE_MINUTES = 120;
const FINAL_RESERVE_HEIGHT_FT = 1500;
export const DEFAULT_TAXI_L = 4;

/** Legacy "hh:mm" (minutes rounded up). */
export function formatHhMm(minutes: number) {
  const total = Math.max(0, Math.ceil(minutes));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** "1:05", "01:05" or plain minutes ("65"); null when unreadable. */
export function parseHhMm(text: string): number | null {
  const clean = text.replace(/[^\d:]/g, "");
  if (!clean) return null;
  const [h, m] = clean.split(":").map(Number);
  if (m === undefined) return Number.isFinite(h) ? h! : null;
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m : null;
}

export const ceilLitres = (value: number) =>
  Math.ceil(Math.max(0, Math.min(9999, value)));

export type FuelAirport = { ident: string; elevationFt: number };

export type FuelPlanningInput = {
  aircraft: Pick<
    Aircraft,
    "cruise" | "climb" | "powerplant" | "fuelTankCapacityL" | "usableFuelL"
  >;
  departure: FuelAirport;
  destination: FuelAirport;
  /** Distance destination → alternate. */
  alternate: (FuelAirport & { distanceNm: number }) | null;
  /** Route legs (with TOC/TOD) at their average altitude and wind component (+ tailwind). */
  legs: { distanceNm: number; altitudeFt: number; windComponentKt: number }[];
  /** Departure → destination great circle. */
  directDistanceNm: number;
  cruiseAltitudeFt: number;
  /** Route tab airspeed. */
  plannerSpeedKt: number;
  cruiseOatC: number;
  /** Surface conditions (METAR or standard) for climb and holding temperatures. */
  surfaceTempC: number;
  qnhHpa: number;
  takeoffWeightKg: number;
  landingWeightKg: number;
  overrides: FuelOverrides;
  blockFuelL: number | null;
};

export type FuelRowValue = {
  /** null: the row has no time (taxi) or no data to suggest one. */
  minutes: number | null;
  fuelL: number | null;
  /** Value is the planner's suggestion (not typed by the pilot). */
  suggested: { minutes: boolean; fuelL: boolean };
};

/** Legacy planning margin: plan with 80% of the POH best rate of climb. */
export const PLANNING_RATE_FACTOR = 0.8;

/** Legacy best-rate climb (rate never above the next conservative table entry) and its IAS. */
export function bestRateClimb(
  climb: Aircraft["climb"],
  weightKg: number,
  pa: number,
  tempC: number,
) {
  if (!climb) return null;
  const values = {
    weightKg,
    headwindKt: 0,
    pressureAltitudeFt: pa,
    temperatureC: tempC,
    densityAltitudeFt: densityAltitudeFt(pa, tempC),
  };
  const value = (axis: keyof typeof values) => values[axis];
  const interpolated = interpolateGrid(climb.grid, value);
  const rateFpm = Math.min(
    interpolated.rateFpm,
    conservativeRead(climb.grid, value).rateFpm,
  );
  return rateFpm > 0 ? { rateFpm, iasKt: interpolated.iasKt } : null;
}

const rateOfClimbFpm = (...args: Parameters<typeof bestRateClimb>) =>
  bestRateClimb(...args)?.rateFpm ?? null;

export function computeFuelPlanning(input: FuelPlanningInput) {
  const { aircraft, overrides } = input;
  const cruise = aircraft.cruise;
  const turbine = aircraft.powerplant !== "reciprocating";
  const totalDistanceNm = input.legs.reduce((s, l) => s + l.distanceNm, 0);
  const routeWindKt =
    totalDistanceNm > 0
      ? input.legs.reduce((s, l) => s + l.windComponentKt * l.distanceNm, 0) /
        totalDistanceNm
      : 0;

  // Cruise at the route's average wind, as the legacy "current cruise setting".
  const cruisePerf = cruise
    ? cruisePerformance(
        cruise,
        input.cruiseAltitudeFt,
        input.cruiseOatC,
        routeWindKt,
        "eco-time",
      )
    : null;
  const fuelFlowLph = cruisePerf?.fuelFlowLph ?? FALLBACK_FUEL_LPH;
  const groundSpeedKt =
    input.plannerSpeedKt > 0
      ? Math.max(30, input.plannerSpeedKt + routeWindKt)
      : cruisePerf
        ? Math.max(30, cruisePerf.groundSpeedKt)
        : FALLBACK_GS_KT;

  const pick = (
    row: EditableFuelRow,
    suggestion: { minutes: number | null; fuelL: number | null },
  ): FuelRowValue => {
    const o = overrides[row] ?? {};
    return {
      minutes: o.minutes ?? suggestion.minutes,
      fuelL: o.fuelL ?? suggestion.fuelL,
      suggested: {
        minutes: o.minutes == null,
        fuelL: o.fuelL == null,
      },
    };
  };

  // Trip: route economy (best range per leg) when there is a cruise table, else planner speed.
  const economy = cruise ? routeEconomy(input, "eco-distance") : null;
  const tripMinutes = economy
    ? economy.hours * 60
    : totalDistanceNm > 0
      ? (totalDistanceNm / groundSpeedKt) * 60
      : 0;
  const plannedTrip = pick("plannedTrip", {
    minutes: Math.ceil(Math.max(0, tripMinutes)),
    fuelL: ceilLitres(
      economy ? economy.fuelL : fuelFlowLph * (tripMinutes / 60),
    ),
  });

  const contingencyHold = cruise
    ? cruisePerformance(
        cruise,
        CONTINGENCY_HOLD_ALTITUDE_FT,
        input.surfaceTempC,
        0,
        "eco-time",
      )
    : null;
  const holdBaseLph = contingencyHold?.fuelFlowLph ?? FALLBACK_HOLD_LPH;
  const holdLph = holdBaseLph * CONTINGENCY_HOLD_BUFFER;
  const fivePercentL = ceilLitres(
    (plannedTrip.fuelL ?? 0) * CONTINGENCY_TRIP_FRACTION,
  );
  const fiveMinuteHoldL = ceilLitres(holdLph * (CONTINGENCY_HOLD_MINUTES / 60));
  const contingency = {
    fuelL: Math.max(fivePercentL, fiveMinuteHoldL),
    basis: fivePercentL >= fiveMinuteHoldL ? "trip" : "hold",
    fivePercentL,
    fiveMinuteHoldL,
    holdBaseLph,
    holdLph,
    fromTable: contingencyHold !== null,
  } as const;

  const startTaxi = pick("startTaxi", { minutes: null, fuelL: DEFAULT_TAXI_L });

  // Climb: departure → cruise at 80% of the POH best rate at the departure, +10% time.
  const gainFt = Math.max(
    0,
    input.cruiseAltitudeFt - input.departure.elevationFt,
  );
  const departurePa = pressureAltitudeFt(
    input.departure.elevationFt,
    input.qnhHpa,
  );
  const tableRate = rateOfClimbFpm(
    aircraft.climb,
    input.takeoffWeightKg,
    departurePa,
    input.surfaceTempC,
  );
  const climbRate =
    tableRate === null ? null : tableRate * PLANNING_RATE_FACTOR;
  const climbFlow = (fromFt: number) => {
    const averageFt = fromFt + gainFor(fromFt) / 2;
    const averagePa = pressureAltitudeFt(averageFt, input.qnhHpa);
    const averageTemp = lapseTemperatureC(
      input.surfaceTempC,
      fromFt,
      averageFt,
    );
    return (
      aircraft.climb?.fuelFlowLph ??
      (cruise
        ? fuelFlowAtPower(cruise, averagePa, averageTemp, CLIMB_POWER_PCT)
        : null)
    );
  };
  const gainFor = (fromFt: number) =>
    Math.max(0, input.cruiseAltitudeFt - fromFt);
  const climbMinutes =
    climbRate === null
      ? null
      : Math.ceil((gainFt / climbRate) * CLIMB_TIME_FACTOR);
  const departureClimbFlow = climbFlow(input.departure.elevationFt);
  const climb = pick("climb", {
    minutes: climbMinutes,
    fuelL:
      climbMinutes !== null && departureClimbFlow !== null
        ? ceilLitres(departureClimbFlow * (climbMinutes / 60))
        : null,
  });

  // Departure/arrival: procedures' extra distance over the direct route, at least 10 min.
  const extraNm = Math.max(0, totalDistanceNm - input.directDistanceNm);
  const extraMinutes = extraNm > 0 ? (extraNm / groundSpeedKt) * 60 : 0;
  const departureArrivalMinutes = Math.max(
    DEPARTURE_ARRIVAL_MIN_MINUTES,
    Math.ceil(extraMinutes),
  );
  const departureArrival = pick("departureArrival", {
    minutes: departureArrivalMinutes,
    fuelL: ceilLitres(
      fuelFlowLph * DEPARTURE_ARRIVAL_BUFFER * (departureArrivalMinutes / 60),
    ),
  });

  // Final reserve: 45 min (30 turbine) holding 1500 ft above the alternate (else destination).
  const reserveMinutes = turbine ? 30 : 45;
  const reserveAirport = input.alternate ?? input.destination;
  const holdingAltitudeFt = Math.max(
    0,
    reserveAirport.elevationFt + FINAL_RESERVE_HEIGHT_FT,
  );
  const holdingTempC = lapseTemperatureC(
    input.surfaceTempC,
    input.destination.elevationFt,
    holdingAltitudeFt,
  );
  const holding = cruise
    ? cruisePerformance(cruise, holdingAltitudeFt, holdingTempC, 0, "eco-time")
    : null;
  const reserveLph = holding?.fuelFlowLph ?? FALLBACK_HOLD_LPH;
  const reserve = {
    minutes: reserveMinutes,
    fuelL: ceilLitres(reserveLph * (reserveMinutes / 60)),
    airport: reserveAirport.ident,
    holdingTempC,
    fuelFlowLph: reserveLph,
    fromTable: holding !== null,
  };

  // Alternate: with an alternate airport, missed approach + climb + DCT + approach;
  // without one, 45 min + 15% of cruise time (piston) less the final reserve.
  let alternate: FuelRowValue;
  let alternateDetails:
    | {
        kind: "airport";
        to: string;
        distanceNm: number;
        climbFt: number;
        climbRateFpm: number;
        fallbackRate: boolean;
      }
    | {
        kind: "none";
        cruiseMinutes: number;
        additionMinutes: number;
        totalL: number;
      };
  if (input.alternate) {
    const alt = input.alternate;
    const altitudeFt = Math.max(
      input.cruiseAltitudeFt,
      input.destination.elevationFt,
      alt.elevationFt,
    );
    const cruiseMinutes =
      alt.distanceNm > 0 ? Math.ceil((alt.distanceNm / groundSpeedKt) * 60) : 0;
    const gain = Math.max(0, altitudeFt - input.destination.elevationFt);
    const destinationRate = rateOfClimbFpm(
      aircraft.climb,
      input.landingWeightKg,
      pressureAltitudeFt(input.destination.elevationFt, input.qnhHpa),
      input.surfaceTempC,
    );
    const rate =
      destinationRate === null
        ? ALTERNATE_CLIMB_FALLBACK_FPM
        : destinationRate * PLANNING_RATE_FACTOR;
    const altClimbMinutes =
      gain > 0 ? Math.ceil((gain / rate) * CLIMB_TIME_FACTOR) : 0;
    const averageFt = input.destination.elevationFt + gain / 2;
    const flow =
      aircraft.climb?.fuelFlowLph ??
      (cruise
        ? fuelFlowAtPower(
            cruise,
            pressureAltitudeFt(averageFt, input.qnhHpa),
            lapseTemperatureC(
              input.surfaceTempC,
              input.destination.elevationFt,
              averageFt,
            ),
            CLIMB_POWER_PCT,
          )
        : null) ??
      FALLBACK_FUEL_LPH;
    alternate = pick("alternate", {
      minutes:
        ALTERNATE_MISSED_APPROACH_MINUTES +
        altClimbMinutes +
        cruiseMinutes +
        ALTERNATE_APPROACH_LANDING_MINUTES,
      fuelL: ceilLitres(
        flow * (ALTERNATE_MISSED_APPROACH_MINUTES / 60) +
          flow * (altClimbMinutes / 60) +
          fuelFlowLph * (cruiseMinutes / 60) +
          fuelFlowLph *
            DEPARTURE_ARRIVAL_BUFFER *
            (ALTERNATE_APPROACH_LANDING_MINUTES / 60),
      ),
    });
    alternateDetails = {
      kind: "airport",
      to: alt.ident,
      distanceNm: alt.distanceNm,
      climbFt: gain,
      climbRateFpm: rate,
      fallbackRate: destinationRate === null,
    };
  } else {
    const plannedCruiseMinutes =
      overrides.plannedTrip?.minutes != null &&
      overrides.plannedTrip.minutes > 0
        ? overrides.plannedTrip.minutes
        : totalDistanceNm > 0
          ? (totalDistanceNm / groundSpeedKt) * 60
          : 0;
    const additionMinutes = turbine
      ? 0
      : Math.min(
          plannedCruiseMinutes * NO_ALTERNATE_RECIP_CRUISE_FRACTION,
          NO_ALTERNATE_RECIP_CRUISE_CAP_MINUTES,
        );
    const totalMinutes = turbine
      ? NO_ALTERNATE_TURBINE_MINUTES
      : NO_ALTERNATE_RECIP_MINUTES + Math.ceil(additionMinutes);
    const totalL = ceilLitres(fuelFlowLph * (totalMinutes / 60));
    alternate = pick("alternate", {
      minutes: Math.max(0, totalMinutes - reserve.minutes),
      fuelL: ceilLitres(Math.max(0, totalL - reserve.fuelL)),
    });
    alternateDetails = {
      kind: "none",
      cruiseMinutes: plannedCruiseMinutes,
      additionMinutes,
      totalL,
    };
  }

  const minimumL =
    (plannedTrip.fuelL ?? 0) +
    contingency.fuelL +
    (startTaxi.fuelL ?? 0) +
    (climb.fuelL ?? 0) +
    (departureArrival.fuelL ?? 0) +
    (alternate.fuelL ?? 0) +
    reserve.fuelL;
  const capacityL = aircraft.fuelTankCapacityL ?? aircraft.usableFuelL;
  const blockFuelL =
    input.blockFuelL === null
      ? null
      : capacityL
        ? Math.min(ceilLitres(input.blockFuelL), Math.ceil(capacityL))
        : ceilLitres(input.blockFuelL);

  return {
    rows: {
      plannedTrip,
      startTaxi,
      climb,
      departureArrival,
      alternate,
    },
    contingency,
    reserve,
    alternateDetails,
    economy,
    cruise: { fuelFlowLph, groundSpeedKt, routeWindKt, totalDistanceNm },
    minimumL,
    blockFuelL,
    /** Positive: fuel missing for the minimum requirement. */
    shortfallL: minimumL - (blockFuelL ?? 0),
  };
}


/** Legacy route economy: each leg flown at its average altitude in the given mode. */
export function routeEconomy(
  input: Pick<FuelPlanningInput, "aircraft" | "legs" | "cruiseOatC">,
  mode: "eco-distance" | "eco-time",
) {
  const cruise = input.aircraft.cruise;
  if (!cruise) return null;
  let distanceNm = 0;
  let fuelL = 0;
  let hours = 0;
  let windKt = 0;
  let ktas = 0;
  let powerPct = 0;
  let powerDistance = 0;
  const legs = [];
  for (const leg of input.legs) {
    if (!(leg.distanceNm > 0)) continue;
    const perf = cruisePerformance(
      cruise,
      leg.altitudeFt,
      input.cruiseOatC,
      leg.windComponentKt,
      mode,
    );
    if (!perf) continue;
    const groundSpeedKt = Math.max(30, perf.ktas + leg.windComponentKt);
    const legHours = leg.distanceNm / groundSpeedKt;
    const legFuel = perf.fuelFlowLph * legHours;
    distanceNm += leg.distanceNm;
    fuelL += legFuel;
    hours += legHours;
    windKt += leg.windComponentKt * leg.distanceNm;
    ktas += perf.ktas * leg.distanceNm;
    if (perf.powerPct !== null) {
      powerPct += perf.powerPct * leg.distanceNm;
      powerDistance += leg.distanceNm;
    }
    legs.push({ ...leg, perf, groundSpeedKt, hours: legHours, fuelL: legFuel });
  }
  if (!distanceNm) return null;
  return {
    legs,
    distanceNm,
    fuelL,
    hours,
    averageFuelFlowLph: hours > 0 ? fuelL / hours : null,
    averageGroundSpeedKt: hours > 0 ? distanceNm / hours : null,
    averageKtas: ktas / distanceNm,
    averagePowerPct: powerDistance ? powerPct / powerDistance : null,
    averageWindKt: windKt / distanceNm,
  };
}
