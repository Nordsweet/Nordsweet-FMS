import { expect, test } from "vitest";
import { airportSchema, navpointSchema } from "~/data/schemas";
import { aircraftSchema, airspaceFeatureSchema } from "~/api/aviation/schemas";
import { findMapObjects, mapSearchKey } from "./map-search";

const data = {
  airports: [
    airportSchema.parse({
      ident: "EPKK",
      aliases: [],
      isIcao: true,
      name: "Kraków",
      country: "PL",
      type: "controlled",
      lat: 50.07,
      lon: 19.78,
      elevationFt: 791,
      runways: [],
      weatherStation: null,
      contact: null,
      links: [],
      remarks: null,
      source: "test",
    }),
  ],
  points: [
    navpointSchema.parse({
      ident: "KELEL",
      aliases: [],
      name: "KELEL",
      kind: "ifr-waypoint",
      lat: 50,
      lon: 20,
      airport: null,
      description: null,
      airways: [],
      navaid: null,
      source: "test",
    }),
    navpointSchema.parse({
      ident: "EPNT ALFA",
      aliases: ["EPNTA"],
      name: "EPNT ALFA",
      kind: "vfr-reporting-point",
      lat: 49,
      lon: 20,
      airport: "EPNT",
      description: null,
      airways: [],
      navaid: null,
      source: "test",
    }),
  ],
  zones: [
    airspaceFeatureSchema.parse({
      type: "Feature",
      bbox: [19, 49, 20, 50],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [19, 49],
            [20, 49],
            [20, 50],
            [19, 49],
          ],
        ],
      },
      properties: {
        name: "TR 165 Strefa ćwiczeń",
        class: "G",
        lower: "GND",
        upper: "FL95",
        activations: [],
        active_now: null,
      },
    }),
  ],
  aircraft: [
    aircraftSchema.parse({
      hex: "48abcd",
      callsign: "RYR6AJ",
      registration: "SP-GUN",
      type: "B738",
      lat: 50,
      lon: 19,
      altitude_ft: 30000,
      on_ground: false,
      ground_speed_kt: 400,
      track_deg: 100,
      vertical_rate_fpm: 0,
      squawk: null,
      position_time: new Date().toISOString(),
      sources: ["adsb"],
    }),
  ],
};
test("matches point/airport codes and compact VFR aliases, with exact identifiers first", () => {
  for (const query of ["KELEL", "epkk", "EPNTA"])
    expect(findMapObjects(query, data)).toHaveLength(1);
  expect(findMapObjects("krakow", data)[0]?.label).toContain("EPKK");
  expect(mapSearchKey("Łódź")).toBe("LODZ");
});
test("zone designators ignore spaces without confusing numbered subdivisions", () => {
  expect(findMapObjects("TR165", data)[0]?.kind).toBe("airspace");
  expect(findMapObjects("TR 165", data)[0]?.label).toBe(
    "TR 165 Strefa ćwiczeń",
  );
});
test("aircraft callsign, registration and hex match with or without separators", () => {
  for (const query of ["SP-GUN", "SPGUN", "ryr6aj", "48ABCD"])
    expect(findMapObjects(query, data)[0]?.kind).toBe("traffic");
});
test("published flight aliases resolve to the aircraft ICAO callsign", () => {
  expect(findMapObjects("FR1923", data)).toEqual([]);
  expect(findMapObjects("FR1923", data, ["FR1923", "RYR6AJ"])[0]?.kind).toBe(
    "traffic",
  );
  expect(findMapObjects("FR1923", data, ["FR1923", "RYR1234"])).toEqual([]);
});
test("empty input never matches everything, ambiguous names return all choices", () => {
  expect(findMapObjects(" - ", data)).toEqual([]);
  const other = { ...data.airports[0]!, ident: "EPXY" };
  expect(
    findMapObjects("Kraków", { ...data, airports: [...data.airports, other] }),
  ).toHaveLength(2);
});
