import { type TrafficAircraft } from "~/api/aviation/schemas";

/** Apply owner-confirmed airframe corrections to collector metadata. */
export function correctTrafficMetadata(
  aircraft: TrafficAircraft,
): TrafficAircraft {
  // SP-TDI's Mode S address is stable even when the reported callsign changes.
  return aircraft.hex.toLowerCase() === "48e9fa"
    ? { ...aircraft, type: "C172" }
    : aircraft;
}
