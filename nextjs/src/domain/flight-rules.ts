export type FlightRules = "V" | "I" | "Y" | "Z";
export type LocalFlightRules = "VFR" | "IFR";

/** ICAO mixed-flight rules describe initial then final rules. */
export function airportFlightRules(
  rules: FlightRules,
  departure: boolean,
): LocalFlightRules {
  return rules === "I" ||
    (rules === "Y" && departure) ||
    (rules === "Z" && !departure)
    ? "IFR"
    : "VFR";
}
