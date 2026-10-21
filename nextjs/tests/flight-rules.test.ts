import { expect, it } from "vitest";
import { airportFlightRules } from "../src/domain/flight-rules";
import { flightSchema, newFlight } from "../src/data/flight";
import { toNordFile, parseNordFile } from "../src/data/nord";
import { procedureRoute } from "../src/domain/procedure-route";

it.each([
  ["V", "VFR", "VFR"],
  ["I", "IFR", "IFR"],
  ["Y", "IFR", "VFR"],
  ["Z", "VFR", "IFR"],
] as const)(
  "uses ICAO %s for departure %s and arrival %s",
  (rules, departure, arrival) => {
    expect(airportFlightRules(rules, true)).toBe(departure);
    expect(airportFlightRules(rules, false)).toBe(arrival);
  },
);
it("defaults old flights to VFR and preserves mixed rules through nord export", () => {
  const flight = newFlight();
  const { flightRules: _old, ...old } = flight;
  expect(flightSchema.parse(old).flightRules).toBe("V");
  expect(
    parseNordFile(toNordFile({ ...flight, flightRules: "Z" }, null), []).flight
      .flightRules,
  ).toBe("Z");
});
const point = (ident: string, lon: number) => ({ ident, lon, lat: 50 });
const a = point("DEP", 19),
  b = point("FIX", 20),
  c = point("ENTRY", 21),
  end = point("DEST", 22);
it("inserts a new STAR before an existing destination without erasing flown fixes", () => {
  const result = procedureRoute([a, b, end], 1, [a, b, c, end], false, {
    lat: 50,
    lon: 20.5,
  })!;
  expect(result.route.map((p) => p.ident)).toEqual([
    "DEP",
    "FIX",
    "DCT",
    "ENTRY",
    "DEST",
  ]);
  expect(result.activeLeg).toBe(2);
});
it("preserves the active enroute leg when the STAR is still ahead", () => {
  const result = procedureRoute([a, b, end], 0, [a, b, c, end], false, null)!;
  expect(result.route).toEqual([a, b, c, end]);
  expect(result.activeLeg).toBe(0);
});
