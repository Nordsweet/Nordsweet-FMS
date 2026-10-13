import { describe, expect, it } from "vitest";

import { type RadioRow, estimateComms, zoneRows } from "./comms";

const row = (frequencyMhz: string, callsign: string): RadioRow => ({
  frequencyMhz,
  callsign,
  sector: null,
});
const gnd = row("121.980", "Kraków Ground");
const twr = row("123.255", "Kraków Tower");
const fisA = row("119.275", "Kraków Informacja");
const fisB = row("127.150", "Gdańsk Information");
const airports = {
  dep: (s: string[]) =>
    s.includes("ground") ? [gnd] : s.includes("tower") ? [twr] : [],
  arr: () => [],
};
// Sector A south of 51°N, sector B north of it.
const at = (p: { lat: number }) => (p.lat < 51 ? [fisA] : [fisB]);
const route = [
  { lat: 50, lon: 20 },
  { lat: 52, lon: 20 },
];

describe("estimateComms", () => {
  it("taxi-out: ground now, tower next", () => {
    const r = estimateComms(
      {
        phase: "taxiout",
        position: null,
        gpsSpeedKt: null,
        plannedSpeedKt: 100,
        route,
      },
      { ...airports, at },
    );
    expect(r.current).toEqual([gnd]);
    expect(r.next).toEqual([twr]);
    expect(r.notes).toEqual(["atc"]);
  });

  it("cruise: finds the sector change ahead and times it at GPS speed", () => {
    const r = estimateComms(
      {
        phase: "cruise",
        position: { lat: 50.5, lon: 20 },
        gpsSpeedKt: 120,
        plannedSpeedKt: 100,
        route,
      },
      { ...airports, at },
    );
    expect(r.current).toEqual([fisA]);
    expect(r.next).toEqual([fisB]);
    // 0.5° of latitude ≈ 30 NM, resolved to 0.25 NM.
    expect(r.distanceNm!).toBeGreaterThan(29.75);
    expect(r.distanceNm!).toBeLessThan(30.3);
    expect(r.seconds).toBeCloseTo((r.distanceNm! / 120) * 3600, 6);
    expect(r.speedSource).toBe("gps");
  });

  it("cruise without a fresh fix waits for GPS", () => {
    const r = estimateComms(
      {
        phase: "cruise",
        position: null,
        gpsSpeedKt: null,
        plannedSpeedKt: 100,
        route,
      },
      { ...airports, at },
    );
    expect(r).toMatchObject({ current: [], notes: ["waitingGps"] });
  });
});

describe("zoneRows", () => {
  it("gives a FIS sector its unit's sector frequency", () => {
    const zone = (name: string) =>
      ({
        properties: { name, class: "FIS", frequencies: [] },
      }) as unknown as Parameters<typeof zoneRows>[0];
    const airport = (icao: string) =>
      icao === "EPGD"
        ? [
            {
              frequencyMhz: "125.275",
              callsign: "Gdańsk Information",
              sector: "West",
            },
            {
              frequencyMhz: "127.150",
              callsign: "Gdańsk Information",
              sector: "East",
            },
          ]
        : [];
    expect(
      zoneRows(zone("FIS GDANSK W"), airport).map((r) => r.frequencyMhz),
    ).toEqual(["125.275"]);
    expect(zoneRows(zone("FIS GDANSK WEST"), airport)).toHaveLength(1);
    expect(zoneRows(zone("FIS GDANSK"), airport)).toHaveLength(2);
  });
});
