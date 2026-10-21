import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { atisSchema } from "~/api/aviation/schemas";
import { airportSchema } from "~/data/schemas";
import { flightSchema, newFlight } from "~/data/flight";
import { atisReducer, emptyAtisPad } from "./atis-pad";
import { applyPerformanceAtis, performanceAtis } from "./atis-performance";

const airport = airportSchema
  .array()
  .parse(JSON.parse(readFileSync("public/data/airports.json", "utf8")))
  .find((a) => a.ident === "EPKK")!;
const report = atisSchema.parse({
  kind: "combined",
  letter: "A",
  received_at: "2026-10-21T12:00:00Z",
  age_minutes: 1,
  stale: false,
  qnh_hpa: 1017,
  qnh_matches_metar: true,
  text: "EPKK ATIS A. RWY 25. WIND 240 DEG, 13 KT. T 13, DP 4. QNH 1017.",
});
const stored = {
  runwayId: "07",
  configId: "keep",
  oatC: 20,
  qnhHpa: 1020,
  windDirectionDeg: 90,
  windSpeedKt: 8,
};

test("reads actual provider D-ATIS prose, including wind, temperature, QNH and runway", () => {
  expect(performanceAtis(airport, "takeoff", [report], null)).toEqual({
    oatC: 13,
    qnhHpa: 1017,
    wind: { directionDeg: 240, speedKt: 13 },
    runwayId: "25",
  });
  const fixtures = JSON.parse(
    readFileSync("src/api/aviation/fixtures/atis.json", "utf8"),
  ) as { atis: unknown[] };
  const departure = { ...atisSchema.parse(fixtures.atis[1]), stale: false };
  expect(performanceAtis(airport, "takeoff", [departure], null)).toMatchObject({
    oatC: 15,
    qnhHpa: 1007,
    wind: { directionDeg: 30, speedKt: 3 },
    runwayId: "07",
  });
});

test("separates arrival/departure, ignores stale and single-device community reports", () => {
  const arrival = {
    ...report,
    kind: "arrival" as const,
    qnh_hpa: 1000,
    text: "T 5 QNH 1000",
  };
  expect(performanceAtis(airport, "takeoff", [arrival], null)).toEqual({});
  expect(performanceAtis(airport, "landing", [arrival], null)).toMatchObject({
    oatC: 5,
    qnhHpa: 1000,
  });
  expect(
    performanceAtis(airport, "landing", [{ ...report, stale: true }], null),
  ).toEqual({});
  const community = {
    ...report,
    source: "community",
    verified: true,
    confirmation_count: 1,
  };
  expect(performanceAtis(airport, "landing", [community], null)).toEqual({});
  expect(
    performanceAtis(
      airport,
      "landing",
      [{ ...community, confirmation_count: 2 }],
      null,
    ),
  ).toMatchObject({ qnhHpa: 1017 });
});

test("manual pad overrides only entered fields, including zero and negative temperature", () => {
  let pad = emptyAtisPad();
  pad = atisReducer(pad, {
    type: "preset",
    field: "temperature",
    value: "M05",
  });
  pad = atisReducer(pad, { type: "preset", field: "qnh", value: "QNH 1005" });
  pad = atisReducer(pad, { type: "preset", field: "wind", value: "CALM" });
  expect(performanceAtis(airport, "landing", [report], pad)).toMatchObject({
    oatC: -5,
    qnhHpa: 1005,
    wind: { directionDeg: null, speedKt: 0 },
    runwayId: "25",
  });
  pad = atisReducer(pad, { type: "preset", field: "temperature", value: "00" });
  expect(performanceAtis(airport, "landing", [], pad).oatC).toBe(0);
});

test("variable wind uses worst-case tailwind; absent fields preserve pilot settings", () => {
  const variable = {
    ...report,
    text: "VRB08G16KT M03/M05 Q1001",
    qnh_hpa: 1001,
  };
  const conditions = performanceAtis(airport, "landing", [variable], null);
  const applied = applyPerformanceAtis(stored, conditions, airport);
  expect(applied.windSpeedKt).toBe(8);
  expect(applied.windDirectionDeg).toBe(
    (airport.runways.find((r) => r.designator === "07")!.trueHeadingDeg + 180) %
      360,
  );
  expect(applied.oatC).toBe(-3);
  const partial = applyPerformanceAtis(stored, { qnhHpa: 1011 }, airport);
  expect(partial).toMatchObject({ ...stored, qnhHpa: 1011 });
  expect(applyPerformanceAtis(stored, {}, airport)).toBe(stored);
});

test("same ATIS cannot overwrite later manual corrections, a changed ATIS updates calculations", () => {
  const conditions = performanceAtis(airport, "takeoff", [report], null);
  const applied = applyPerformanceAtis(stored, conditions, airport);
  const pilot = { ...applied, oatC: 21 };
  expect(applyPerformanceAtis(pilot, conditions, airport)).toBe(pilot);
  expect(
    applyPerformanceAtis(pilot, { ...conditions, qnhHpa: 1016 }, airport)
      .qnhHpa,
  ).toBe(1016);
  expect(applied.configId).toBe("keep");
  const flight = newFlight();
  flight.performanceInputs["takeoff|EPKK|C172S"] = applied;
  expect(
    flightSchema.parse(JSON.parse(JSON.stringify(flight))).performanceInputs[
      "takeoff|EPKK|C172S"
    ]!.atisSignature,
  ).toBe(applied.atisSignature);
});

test("newest eligible report wins, and missing wind never silently means calm", () => {
  const latest = {
    ...report,
    received_at: "2026-10-21T12:10:00Z",
    qnh_hpa: 1022,
    text: "QNH 1022",
  };
  const conditions = performanceAtis(
    airport,
    "takeoff",
    [report, latest],
    null,
  );
  expect(conditions.qnhHpa).toBe(1022);
  expect(conditions.wind).toBeUndefined();
  expect(applyPerformanceAtis(stored, conditions, airport).windSpeedKt).toBe(8);
});
