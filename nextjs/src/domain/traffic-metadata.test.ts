import { describe, expect, it } from "vitest";
import { type TrafficAircraft } from "~/api/aviation/schemas";
import { correctTrafficMetadata } from "./traffic-metadata";

const aircraft: TrafficAircraft = {
  hex: "48e9fa",
  callsign: "SPTDI",
  registration: "SP-TDI",
  type: null,
  lat: 50,
  lon: 20,
  altitude_ft: 2000,
  on_ground: false,
  ground_speed_kt: 100,
  track_deg: 90,
  vertical_rate_fpm: 0,
  squawk: null,
  position_time: "2026-10-14T10:00:00Z",
  sources: ["adsb.lol"],
};

describe("owner-confirmed traffic metadata", () => {
  it("corrects SP-TDI by Mode S address independently of callsign and reported type", () => {
    for (const hex of ["48e9fa", "48E9FA"]) {
      expect(
        correctTrafficMetadata({
          ...aircraft,
          hex,
          callsign: null,
          type: "C152",
        }),
      ).toEqual({ ...aircraft, hex, callsign: null, type: "C172" });
    }
    expect(aircraft.type).toBeNull();
  });

  it("preserves other airframes even if a source reports the same registration", () => {
    const other = { ...aircraft, hex: "48abcd", type: "B738" };
    expect(correctTrafficMetadata(other)).toBe(other);
  });
});
