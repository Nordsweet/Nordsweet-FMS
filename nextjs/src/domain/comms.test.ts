import { describe, expect, it, vi } from "vitest";

import {
  type RadioRow,
  estimateComms,
  zoneRows,
  rowsAt,
  commsZones,
} from "./comms";
import { airspaceFeatureSchema } from "~/api/aviation/schemas";

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

describe("Polish FIS and Warsaw Radar", () => {
  const zone = airspaceFeatureSchema.parse({
    type: "Feature",
    bbox: [19, 49, 21, 51],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [19, 49],
          [21, 49],
          [21, 51],
          [19, 51],
          [19, 49],
        ],
      ],
    },
    properties: {
      name: "FIS KRAKOW W",
      class: "G",
      lower: "GND",
      upper: "UNL",
      active_now: true,
      activations: [],
      frequencies: [
        {
          frequencyMhz: "119.275",
          callsign: "Kraków Information",
          serviceId: "fiss",
        },
      ],
    },
  });
  const airport = () => [];
  it("does not select a high FL-bound local service at low GPS altitude", () => {
    const highCtr = {
      ...zone,
      properties: {
        ...zone.properties,
        name: "CTR TEST",
        class: "CTR",
        lower: "FL180",
        upper: "FL195",
        frequencies: [
          {
            frequencyMhz: "120.000",
            callsign: "Radar",
            serviceId: "radar",
            sector: null,
          },
        ],
      },
    };
    expect(
      rowsAt(
        { lat: 49.4628, lon: 20.0507, altitudeFt: 5000 },
        commsZones([zone, highCtr]),
        airport,
      )[0]?.frequencyMhz,
    ).toBe("119.275");
  });
  it("uses pressure altitude at FL95, not GNSS/MSL altitude", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    try {
      const zones = commsZones([zone]);
      expect(
        rowsAt(
          {
            lat: 49.4628,
            lon: 20.0507,
            altitudeFt: 10500,
            pressureAltitudeFt: 9500,
          },
          zones,
          airport,
        )[0]?.frequencyMhz,
      ).toBe("119.275");
      expect(
        rowsAt(
          {
            lat: 49.4628,
            lon: 20.0507,
            altitudeFt: 9000,
            pressureAltitudeFt: 9501,
          },
          zones,
          airport,
        )[0],
      ).toMatchObject({ frequencyMhz: "127.660", sector: "EPWW J LOW" });
      expect(
        rowsAt(
          { lat: 49.4628, lon: 20.0507, altitudeFt: 12000 },
          zones,
          airport,
        )[0]?.frequencyMhz,
      ).toBe("119.275");
    } finally {
      vi.useRealTimers();
    }
  });
  it("does not invent a radar channel when the AIRAC data are expired", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-11-26T00:00:00Z"));
      expect(
        rowsAt(
          { lat: 49.4628, lon: 20.0507, pressureAltitudeFt: 10000 },
          commsZones([zone]),
          airport,
        ),
      ).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
