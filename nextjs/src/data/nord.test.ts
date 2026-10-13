import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { flightSchema, newFlight } from "./flight";
import { parseNordFile, toNordFile } from "./nord";

const ids = ["P2006T", "R172K", "C152-SPRBB", "A-1A-HUSKY"];
const files = ["tests/fixtures/nord"].flatMap((dir) =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".nord"))
    .map((f) => path.join(dir, f)),
);

describe(".nord files", () => {
  it.each(files)("imports %s", (file) => {
    const { flight } = parseNordFile(fs.readFileSync(file, "utf8"), ids);
    expect(() => flightSchema.parse(flight)).not.toThrow();
    expect(
      flight.waypoints.some((p) => p.ident === "TOC" || p.ident === "TOD"),
    ).toBe(false);
  });

  it("maps fields of a saved flight", () => {
    const { flight } = parseNordFile(
      fs.readFileSync("tests/fixtures/nord/P2006T0508261012.nord", "utf8"),
      ids,
    );
    expect(flight).toMatchObject({
      aircraftId: "P2006T",
      departure: { ident: "EPNT" },
      destination: { ident: "EPML" },
      cruiseAltitudeFt: 5000,
      cruiseTasKt: 86,
    });
    // The legacy route is its text; the map-inserted waypoints list is empty.
    expect(flight.routeText).toBe("epnta epmlr epmls");
    expect(flight.waypoints).toEqual([]);
  });

  it("imports a local flight stored as one point", () => {
    const { flight } = parseNordFile(
      fs.readFileSync("tests/fixtures/nord/R172K2706261444.nord", "utf8"),
      ids,
    );
    expect(flight.departure).toEqual(flight.destination);
    expect(flight.waypoints).toEqual([]);
  });

  it("round-trips through export", () => {
    const { flight } = parseNordFile(
      fs.readFileSync("tests/fixtures/nord/P2006T0508261012.nord", "utf8"),
      ids,
    );
    const again = parseNordFile(toNordFile(flight, "P2006T"), ids).flight;
    expect(again).toMatchObject({
      ...flight,
      fuel: again.fuel,
      stationsKg: again.stationsKg,
    });
  });

  it("rejects files without route points", () => {
    expect(() =>
      parseNordFile(
        JSON.stringify({ format: "nordsweet.flight", version: 1, route: {} }),
        ids,
      ),
    ).toThrow();
  });
});

it("round-trips the full preparation state while retaining a legacy route", () => {
  const flight = newFlight();
  flight.aircraftId = "P2006T";
  flight.departure = { ident: "EPKK", lat: 50.07, lon: 19.78 };
  flight.destination = { ident: "EPNT", lat: 49.46, lon: 20.04 };
  flight.fuel.blockL = 80;
  flight.stationsKg = { pilot: 85 };
  flight.performanceInputs["takeoff|EPKK|P2006T"] = {
    runwayId: "07",
    configId: "takeoff",
    oatC: 25,
    qnhHpa: 1020,
    windDirectionDeg: 90,
    windSpeedKt: 10,
  };
  flight.taxiInputs["departure|EPKK"] = { from: "stand1", to: "hp07" };
  const text = toNordFile(flight, "P2006T");
  expect(parseNordFile(text, ids).flight).toEqual(flight);
  const legacy = JSON.parse(text) as {
    plannerState?: unknown;
    route: { customName?: string };
  };
  delete legacy.plannerState;
  legacy.route.customName = "Renamed legacy flight";
  expect(parseNordFile(JSON.stringify(legacy), ids).flight.name).toBe(
    "Renamed legacy flight",
  );
});
it("supplies defaults for old preparation snapshots and rejects invalid added inputs", () => {
  const { performanceInputs: _perf, taxiInputs: _taxi, ...old } = newFlight();
  expect(flightSchema.parse(old).performanceInputs).toEqual({});
  expect(
    flightSchema.safeParse({
      ...old,
      performanceInputs: { bad: { qnhHpa: -1 } },
    }).success,
  ).toBe(false);
});

it("rejects invalid legacy coordinates before they can replace the current route", () => {
  expect(() =>
    parseNordFile(
      JSON.stringify({
        format: "nordsweet.flight",
        version: 1,
        route: { plan: { points: [{ id: "INVALID", lat: 91, lon: 20 }] } },
      }),
      ids,
    ),
  ).toThrow();
});
