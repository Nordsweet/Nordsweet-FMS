import { afterEach, expect, test } from "vitest";
import { airportSchema } from "~/data/schemas";
import {
  emergencyReferences,
  fr172hEmergencyReference,
  operationalProcedure,
} from "~/data/emergency";
import { useEmergency, emergencyScope } from "~/stores/emergency";
import { newTimers } from "./flight-timers";
import { destinationPoint, distanceNm, initialBearingDeg } from "./geo";
import { angleDiffDeg } from "./angles";
import {
  emergencyApproach,
  emergencyCandidates,
  emergencyContext,
  emergencyRange,
  emergencyTarget,
  type EmergencyMeasurement,
} from "./emergency";

const threshold = { lat: 50, lon: 20, elevationFt: 1000 };
const airport = airportSchema.parse({
  ident: "TEST",
  aliases: [],
  isIcao: false,
  name: "Test",
  country: "PL",
  type: "aerodrome",
  ...threshold,
  runways: [
    {
      designator: "25",
      trueHeadingDeg: 247,
      threshold,
      surface: "asphalt",
      lengthM: 2000,
      widthM: 30,
      slopePct: 0,
      toraM: null,
      todaM: null,
      asdaM: null,
      ldaM: null,
    },
  ],
  weatherStation: null,
  contact: null,
  links: [],
  remarks: null,
  source: "test",
});
const target = emergencyTarget(airport, airport.runways[0]!)!;
const at = 1_000_000;
const measurement: EmergencyMeasurement = {
  at,
  altitudeAmslFt: 3000,
  altitudeDatum: "AMSL",
  groundSpeedKt: 90,
  verticalSpeedFpm: -500,
};
afterEach(() =>
  useEmergency.setState({ session: null, history: [], measurements: [] }),
);

test("range uses height above threshold: 2000 ft, 500 fpm, 90 kt => 4 min / 6 NM", () => {
  expect(emergencyRange([measurement], 1000, at)).toMatchObject({
    minutes: 4,
    radiusNm: 6,
    referenceFt: 1000,
  });
  expect(emergencyRange([measurement], 2000, at)?.radiusNm).toBe(3);
  expect(
    emergencyRange([{ ...measurement, groundSpeedKt: 0 }], 1000, at)?.radiusNm,
  ).toBe(0);
  expect(emergencyRange([measurement], 4000, at)?.radiusNm).toBe(0);
});

test("no stale, invalid, non-descending, missing or ellipsoid-based range", () => {
  for (const patch of [
    { altitudeDatum: "ellipsoid" as const },
    { altitudeAmslFt: null },
    { groundSpeedKt: null },
    { groundSpeedKt: -1 },
    { verticalSpeedFpm: 0 },
    { verticalSpeedFpm: -20 },
    { verticalSpeedFpm: 500 },
    { altitudeAmslFt: NaN },
  ])
    expect(emergencyRange([{ ...measurement, ...patch }], 1000, at)).toBeNull();
  expect(emergencyRange([measurement], 1000, at + 20_001)).toBeNull();
  expect(emergencyRange([measurement], null, at)).toBeNull();
  expect(emergencyRange([measurement], 0, at - 1)).toBeNull();
});

test("short documented smoothing window excludes older samples", () => {
  expect(
    emergencyRange(
      [
        { ...measurement, at: at - 11_000, verticalSpeedFpm: -5000 },
        measurement,
      ],
      1000,
      at,
    )?.radiusNm,
  ).toBe(6);
  expect(
    emergencyRange(
      [{ ...measurement, at: at - 5000, verticalSpeedFpm: -1500 }, measurement],
      1000,
      at,
    )?.radiusNm,
  ).toBe(3);
});

test("final uses actual geographic threshold and true heading, not runway number or ARP", () => {
  expect(distanceNm(target.final, threshold)).toBeCloseTo(0.5, 7);
  expect(
    Math.abs(angleDiffDeg(initialBearingDeg(target.final, threshold), 247)),
  ).toBeLessThan(0.02);
  expect(
    emergencyTarget(airport, { ...airport.runways[0]!, threshold: null }),
  ).toBeNull();
  expect(
    emergencyTarget(airport, {
      ...airport.runways[0]!,
      threshold: { ...threshold, lat: NaN },
    }),
  ).toBeNull();
});

test("closure notes disqualify ambiguous availability and registrations isolate sessions", () => {
  expect(
    emergencyTarget(
      { ...airport, remarks: "Pas 04/22 zamkniety" },
      airport.runways[0]!,
    ),
  ).toBeNull();
  expect(
    emergencyTarget(
      { ...airport, remarks: "Runway closed" },
      airport.runways[0]!,
    ),
  ).toBeNull();
  expect(emergencyScope("f", "FR172H", "today", "SP-ANT")).not.toBe(
    emergencyScope("f", "FR172H", "today", "SP-XYZ"),
  );
  const store = useEmergency.getState();
  store.open("f", "failure", "flight", [], false, null);
  store.open("f", "failure", "flight", [], true, target);
  expect(useEmergency.getState().session?.target).toEqual(target);
  expect(useEmergency.getState().session?.routeRequested).toBe(true);
});

test.each([0, 30, 90, 170, 242, 270, 330])(
  "approach completes rate-one turn before the full final (position bearing %s)",
  (bearing) => {
    const position = destinationPoint(threshold, bearing, 8);
    const approach = emergencyApproach(position, target, 100);
    expect(approach).not.toBeNull();
    const points = approach!.points;
    expect(distanceNm(points[0]!, position)).toBeLessThan(0.001);
    expect(distanceNm(points.at(-2)!, target.final)).toBeLessThan(0.001);
    expect(distanceNm(points.at(-1)!, threshold)).toBeLessThan(0.001);
    expect(distanceNm(points.at(-2)!, points.at(-1)!)).toBeCloseTo(0.5, 5);
    const before = points.at(-3)!;
    expect(
      Math.abs(angleDiffDeg(initialBearingDeg(before, target.final), 247)),
    ).toBeLessThan(4);
    expect(approach!.distanceNm).toBeGreaterThanOrEqual(
      distanceNm(position, threshold),
    );
  },
);

test("established aircraft inside final does not backtrack; no missing-speed sharp join", () => {
  const position = destinationPoint(threshold, 67, 0.2);
  expect(emergencyApproach(position, target, 100)?.points).toEqual([
    position,
    threshold,
  ]);
  expect(
    emergencyApproach(destinationPoint(threshold, 0, 3), target, null),
  ).toBeNull();
});

test("nearest airport uses threshold distance rather than ARP; stable deterministic ordering", () => {
  const near = { ...airport, ident: "NEAR", lat: 0, lon: 0 };
  const far = {
    ...airport,
    ident: "FAR",
    runways: [
      {
        ...airport.runways[0]!,
        threshold: { ...destinationPoint(threshold, 0, 20), elevationFt: 1000 },
      },
    ],
  };
  const position = destinationPoint(threshold, 90, 5);
  expect(
    emergencyCandidates([far, near], position, 100)[0]?.target.airport,
  ).toBe("NEAR");
});

test("phase requires fresh position plus running air time and phase; climb is not a generic after-takeoff cutoff", () => {
  const timers = newTimers();
  expect(emergencyContext("cruise", timers, at, at).phase).toBeNull();
  const airborne = {
    ...timers,
    airTime: { ...timers.airTime, startedAt: at - 60_000 },
  };
  expect(emergencyContext("cruise", airborne, at, at)).toEqual({
    airborne: true,
    phase: "flight",
  });
  expect(emergencyContext("climb", airborne, at, at)).toEqual({
    airborne: true,
    phase: null,
  });
  expect(emergencyContext("takeoff", airborne, at, at)).toEqual({
    airborne: false,
    phase: null,
  });
  expect(emergencyContext("cruise", airborne, at - 30_000, at).airborne).toBe(
    false,
  );
});

test("FR172H reference is not reused for C172/twins; all 22 source actions and switch distinctions retained", () => {
  expect(emergencyReferences("C172")).toEqual([]);
  expect(emergencyReferences("P2006T")).toEqual([]);
  expect(emergencyReferences("FR172H")).toHaveLength(4);
  expect(
    fr172hEmergencyReference.reduce((sum, p) => sum + p.items.length, 0),
  ).toBe(22);
  expect(
    fr172hEmergencyReference.every(
      (p) => !operationalProcedure(p) && p.speed === null,
    ),
  ).toBe(true);
  expect(fr172hEmergencyReference[1]!.warnings[0]).toContain(
    "Never attempt to turn back",
  );
  expect(fr172hEmergencyReference[2]!.items[4]!.text).toContain(
    "HIGH for 3-5 seconds",
  );
  expect(fr172hEmergencyReference[2]!.branchKey).toBe(
    fr172hEmergencyReference[3]!.key,
  );
});

test("shared revision snapshots retain variant-specific checks; completion never sets outcome", () => {
  const store = useEmergency.getState();
  store.open("scope", "failure", "flight", [], true, target);
  const p = fr172hEmergencyReference[2]!;
  store.select(p);
  expect(useEmergency.getState().session?.procedure).toBeNull();
  store.select(p, true);
  store.toggle(p.items[0]!.id);
  store.select(fr172hEmergencyReference[1]!, true);
  expect(
    useEmergency.getState().session?.variants[
      `${fr172hEmergencyReference[1]!.key}@${p.revision}`
    ]?.checked,
  ).toEqual({});
  store.select(p, true);
  expect(
    useEmergency.getState().session?.variants[`${p.key}@${p.revision}`]
      ?.checked[p.items[0]!.id],
  ).toBe(true);
  expect(useEmergency.getState().session?.outcome).toBe("unresolved");
  expect(useEmergency.getState().session?.previewOnly).toBe(true);
});

test("new flight/aircraft/family archives rather than reuses old session; target stable until explicit choice", () => {
  const store = useEmergency.getState();
  const scope = emergencyScope("flight", "FR172H", "today");
  const route = [{ ...threshold, ident: "ORIGINAL" }];
  store.open(scope, "failure", "flight", route, true, target);
  store.open(scope, "failure", "flight", [], true, null);
  expect(useEmergency.getState().session?.target).toEqual(target);
  expect(useEmergency.getState().session?.originalRoute).toEqual(route);
  store.open(scope, "fire", "flight", route, false, null);
  expect(useEmergency.getState().history).toHaveLength(1);
  expect(useEmergency.getState().session?.routeRequested).toBe(false);
  store.end();
  expect(useEmergency.getState().session).toBeNull();
  expect(useEmergency.getState().history).toHaveLength(2);
});
