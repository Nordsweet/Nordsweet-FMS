import { type TrafficAircraft } from "~/api/aviation/schemas";

/** Airframe identity and type explicitly confirmed by the owner. */
export const confirmedTrafficAircraft = [
  { hex: "48e9fa", registration: "SP-TDI", type: "C172" },
] as const;

/** Apply owner-confirmed airframe corrections to collector metadata. */
export function correctTrafficMetadata(
  aircraft: TrafficAircraft,
): TrafficAircraft {
  // SP-TDI's Mode S address is stable even when the reported callsign changes.
  const confirmed = confirmedTrafficAircraft.find(
    (record) => record.hex === aircraft.hex.toLowerCase(),
  );
  return confirmed ? { ...aircraft, type: confirmed.type } : aircraft;
}
