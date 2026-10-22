import fs from "node:fs";
import { expect, test } from "vitest";
import { datasetSchemas } from "~/data/schemas";
import {
  buildRoutePlan,
  altitudeRestriction,
  speedRestrictionKt,
} from "~/domain/route-plan";

const airports = datasetSchemas.airports.parse(
  JSON.parse(fs.readFileSync("public/data/airports.json", "utf8")),
);
const points = datasetSchemas.navpoints.parse(
  JSON.parse(fs.readFileSync("public/data/navpoints.json", "utf8")),
);
const procedures = datasetSchemas.procedures
  .parse(JSON.parse(fs.readFileSync("public/data/procedures.json", "utf8")))
  .filter((p) => p.airport === "LZTT");
const frequencies = datasetSchemas.frequencies
  .parse(JSON.parse(fs.readFileSync("public/data/frequencies.json", "utf8")))
  .filter((p) => p.airport === "LZTT");
const airport = airports.find((a) => a.ident === "LZTT")!;

test("Poprad uses open published runways and exact declared distances", () => {
  expect(airport.lat).toBeCloseTo(49 + 4 / 60 + 25 / 3600, 7);
  expect(airport.runways.map((r) => r.designator)).toEqual([
    "09",
    "27",
    "07R",
    "25L",
  ]);
  expect(airport.runways[0]).toMatchObject({
    trueHeadingDeg: 94.1,
    surface: "concrete",
    todaM: 2660,
    threshold: { elevationFt: 2355.2 },
  });
  expect(airport.runways[1]).toMatchObject({
    trueHeadingDeg: 274.13,
    todaM: 2700,
  });
  expect(airport.runways[2]).toMatchObject({
    trueHeadingDeg: 73.45,
    widthM: 45,
    todaM: 785,
  });
  expect(frequencies.find((f) => f.service === "atis")?.frequencyMhz).toBe(
    "133.130",
  );
  expect(
    frequencies
      .filter((f) => f.primary && f.service === "tower")
      .map((f) => f.frequencyMhz),
  ).toEqual(["121.350"]);
  expect(points.find((p) => p.ident === "PPD")?.navaid).toMatchObject({
    frequency: "112.100",
    channel: "58X",
  });
  expect(
    points.filter(
      (p) => p.airport === "LZTT" && p.kind === "vfr-reporting-point",
    ),
  ).toHaveLength(8);
});

test("every imported RNAV SID/STAR resolves to a route with published constraints", () => {
  expect(procedures.filter((p) => p.type === "SID")).toHaveLength(12);
  expect(procedures.filter((p) => p.type === "STAR")).toHaveLength(16);
  const other = airports.find((a) => a.ident === "EPKK")!;
  for (const procedure of procedures) {
    const departure = procedure.type === "SID" ? airport : other;
    const destination = procedure.type === "SID" ? other : airport;
    const plan = buildRoutePlan(
      {
        airport: (code) => airports.find((a) => a.ident === code) ?? null,
        point: (id) => points.find((p) => p.ident === id) ?? null,
        procedures: () => procedures,
        airways: {},
      },
      {
        departure,
        destination,
        alternate: null,
        altitudeFt: 11000,
        routeText: "",
        selections: {
          SID: procedure.type === "SID" ? procedure.id : null,
          STAR: procedure.type === "STAR" ? procedure.id : null,
          APPROACH: null,
        },
        inlineSelections: {},
        insertedWaypoints: [],
        waypointAltitudes: {},
        waypointWx: {},
        conditionsWind: null,
        runwayWind: () => null,
        climbGradientFtPerNm: 500,
      },
    );
    if (!plan) throw new Error(`Missing plan for ${procedure.id}`);
    expect(plan.warnings, procedure.id).toEqual([]);
    for (const leg of procedure.legs) {
      const point = plan.points.find(
        (p) => p.id === leg.ident && p.procedureLeg,
      );
      expect(point, procedure.id + ": " + leg.ident).toBeDefined();
      if (leg.altitude)
        expect(altitudeRestriction(point)?.minFt).toBe(
          Number.parseInt(leg.altitude.raw),
        );
      if (leg.speedKt) expect(speedRestrictionKt(point)).toBe(leg.speedKt);
    }
  }
});
