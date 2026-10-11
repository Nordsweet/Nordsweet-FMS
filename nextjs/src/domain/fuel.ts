/** VFR fuel plan, same components as the legacy planner. All values in litres. */
export type FuelPlanInput = {
  /** Trip fuel from the nav log (climb, cruise and descent flows). */
  tripFuelL: number;
  alternateMinutes: number;
  fuelFlowLph: number;
  taxiL: number;
  climbExtraL: number;
  /** Departure and arrival procedures; at least 10 minutes are planned. */
  departureArrivalMinutes: number;
  /** Final reserve: 45 min for piston aircraft. */
  finalReserveMinutes: number;
  blockFuelL: number;
};

export type FuelPlan = {
  tripL: number;
  /** Larger of 5% of trip fuel and 5 minutes' holding. */
  contingencyL: number;
  taxiL: number;
  climbExtraL: number;
  departureArrivalL: number;
  alternateL: number;
  finalReserveL: number;
  minimumL: number;
  blockFuelL: number;
  /** Block fuel minus minimum; negative = not enough fuel. */
  extraL: number;
};

const litres = (minutes: number, flowLph: number) =>
  Math.ceil((minutes / 60) * flowLph);

export function computeFuelPlan(input: FuelPlanInput): FuelPlan {
  const flow = input.fuelFlowLph;
  const tripL = Math.ceil(input.tripFuelL);
  const contingencyL = Math.max(Math.ceil(tripL * 0.05), litres(5, flow));
  const departureArrivalL = litres(
    Math.max(10, input.departureArrivalMinutes),
    flow,
  );
  const alternateL = litres(input.alternateMinutes, flow);
  // shortcut: reserve and holding use the cruise fuel flow (overestimates), until cruise/holding tables are migrated.
  const finalReserveL = litres(input.finalReserveMinutes, flow);
  const minimumL =
    tripL +
    contingencyL +
    input.taxiL +
    input.climbExtraL +
    departureArrivalL +
    alternateL +
    finalReserveL;
  return {
    tripL,
    contingencyL,
    taxiL: input.taxiL,
    climbExtraL: input.climbExtraL,
    departureArrivalL,
    alternateL,
    finalReserveL,
    minimumL,
    blockFuelL: input.blockFuelL,
    extraL: input.blockFuelL - minimumL,
  };
}
