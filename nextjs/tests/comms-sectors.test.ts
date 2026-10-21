import { describe, expect, it } from "vitest";
import {
  airspaceFeatureSchema,
  type AirspaceFeature,
} from "~/api/aviation/schemas";
import {
  commsZones,
  rowsAt,
  zoneRows,
  estimateComms,
  type AirportRows,
} from "~/domain/comms";
import { observeRadioCrossing, type RadioCrossing } from "~/domain/comms-alert";
import recorded from "./fixtures/comms-sectors.json";
import frequencies from "../public/data/frequencies.json";

const airport: AirportRows = (icao, services) =>
  frequencies
    .filter((r) => r.airport === icao && services.includes(r.service))
    .map((r) => ({ ...r, serviceId: r.service }));
const zones = recorded.features.map((z) => airspaceFeatureSchema.parse(z));
const zone = (
  name: string,
  freq: string,
  overrides: Partial<AirspaceFeature["properties"]> = {},
) =>
  airspaceFeatureSchema.parse({
    type: "Feature",
    bbox: [19, 49, 22, 51],
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [19, 49],
          [22, 49],
          [22, 51],
          [19, 51],
          [19, 49],
        ],
      ],
    },
    properties: {
      name,
      class: "G",
      lower: "GND",
      upper: "6000 FT AMSL",
      active_now: true,
      activations: [],
      frequencies: [
        {
          frequencyMhz: freq,
          callsign: name,
          sector: null,
          serviceId: "radio",
        },
      ],
      ...overrides,
    },
  });
const at = (lat: number, lon: number, altitudeFt = 5000) =>
  rowsAt({ lat, lon, altitudeFt }, commsZones(zones), airport).map(
    (r) => r.frequencyMhz,
  );

describe("radio sectors and nested local services", () => {
  it("selects the screenshot route's real geographical sectors without waypoint-specific overrides", () => {
    expect(at(49.46283, 20.05067, 2100)).toEqual(["122.305"]);
    expect(at(49.4, 20.15, 6000)).toEqual(["119.275"]);
    expect(at(49.3, 20.18)).toEqual(["131.325"]);
    expect(at(49.465, 19.646667)).toEqual(["119.275"]);
    expect(at(49.46, 19.97)).toEqual(["122.305"]);
    expect(at(49.45, 20.23)).toEqual(["119.275"]);
    expect(at(49.565, 20.635)).toEqual(["119.950"]);
    expect(at(49.71, 20.64, 3200)).toEqual(["127.940"]);
  });
  it("gives TR, CTR, TMA and ATZ precedence over the enclosing FIS", () => {
    const list = [
      zone("FIS KRAKOW W", "119.275"),
      zone("ATZ EPNT", "122.305"),
      zone("TMA EPKK A", "126.530"),
      zone("CTR EPKK", "123.255"),
      zone("TR 153", "122.900"),
    ];
    const p = { lat: 50, lon: 20, altitudeFt: 5000 };
    for (const expected of [
      "122.900",
      "123.255",
      "126.530",
      "122.305",
      "119.275",
    ]) {
      expect(
        rowsAt(p, commsZones(list), airport).map((r) => r.frequencyMhz),
      ).toEqual([expected]);
      list.pop();
    }
    expect(
      rowsAt(
        p,
        commsZones([
          zone("FIS KRAKOW W", "119.275"),
          zone("TR 153", "122.900", { active_now: false }),
        ]),
        airport,
      )[0]?.frequencyMhz,
    ).toBe("119.275");
  });
  it("uses the selected APP/FIS sector's channel instead of all airport channels", () => {
    expect(
      zoneRows(zone("TMA EPKK A", "126.530"), airport).map(
        (r) => r.frequencyMhz,
      ),
    ).toEqual(["126.530"]);
    expect(
      zoneRows(zone("FIS KRAKOW E", "119.950"), airport).map(
        (r) => r.frequencyMhz,
      ),
    ).toEqual(["119.950"]);
    expect(
      zoneRows(zone("FIR WARSZAWA", "", { frequencies: [] }), airport),
    ).toEqual([]);
  });
  it("looks along the sequenced returning leg and detects altitude-driven exits", () => {
    const route = [
      { lat: 50, lon: 19.2, altitudeFt: 2000 },
      { lat: 50, lon: 20, altitudeFt: 2000 },
      { lat: 50, lon: 19.2, altitudeFt: 6000 },
    ];
    const result = estimateComms(
      {
        phase: "climb",
        position: { lat: 50, lon: 19.9, altitudeFt: 2500 },
        gpsSpeedKt: 100,
        plannedSpeedKt: 100,
        route,
        activeLeg: 1,
      },
      {
        dep: () => [],
        arr: () => [],
        at: (p) => [
          {
            frequencyMhz: (p.altitudeFt ?? 0) < 3500 ? "122.305" : "119.275",
            callsign: "Radio",
            sector: null,
          },
        ],
      },
    );
    expect(result.current[0]?.frequencyMhz).toBe("122.305");
    expect(result.next[0]?.frequencyMhz).toBe("119.275");
    expect(result.distanceNm).toBeGreaterThan(5);
  });
});

it("records the initial channel and every repeat visit, but ignores transient data gaps and label-only changes", () => {
  let state: RadioCrossing = {
    session: null,
    current: "",
    sequence: 0,
    change: null,
  };
  const a = [
    { frequencyMhz: "122.305", callsign: "Nowy Targ Radio", sector: null },
  ];
  const b = [
    { frequencyMhz: "119.275", callsign: "Kraków Information", sector: null },
  ];
  const keys: string[] = [];
  for (const rows of [a, b, a, b]) {
    state = observeRadioCrossing(state, "flight", rows, 1000 + keys.length);
    keys.push(state.change!.key);
  }
  expect(new Set(keys).size).toBe(4);
  expect(observeRadioCrossing(state, "flight", [], 2000)).toBe(state);
  expect(
    observeRadioCrossing(state, "flight", [{ ...b[0]!, sector: "West" }], 2000),
  ).toBe(state);
  expect(observeRadioCrossing(state, "new-flight", a, 3000).sequence).toBe(1);
});
