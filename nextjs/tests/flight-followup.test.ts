import { expect, test } from "vitest";
import { guidanceTimeline } from "~/domain/guidance-timeline";
import {
  observeGuidance,
  type GuidanceNotices,
} from "~/domain/guidance-notices";
import { mapProfilePoints } from "~/domain/map-profile";
import { flyByRoute } from "~/domain/fly-by";
import { routeSpeedProfile } from "~/domain/route-speed-profile";
import { aircraftSchema } from "~/data/aircraft";
import aircraft from "../public/data/aircraft.json";
import { commsZones, rowsAt, estimateComms } from "~/domain/comms";
import { airspaceFeatureSchema } from "~/api/aviation/schemas";
import { commsChangeSuggestion } from "~/domain/comms-alert";

const now = Date.parse("2026-10-20T12:00:00Z");
const route = [
  { ident: "A", lat: 50, lon: 20 },
  { ident: "B", lat: 50, lon: 21 },
];
const input = {
  now,
  phase: "climb" as const,
  fix: {
    ...route[0]!,
    time: new Date(now).toISOString(),
    groundSpeedKt: 100,
    trackDeg: 90,
    altitudeFt: 4000,
    verticalSpeedFpm: 600,
  },
  courseTrueDeg: 90,
  targetAltitudeFt: 5000,
  variationDeg: 0,
  tasKt: 100,
  wind: { directionDeg: 0, speedKt: 0 },
  route,
  activeLeg: 0,
  performance: { tasKt: 100 },
  plan: null,
  cruiseAltitudeFt: 5000,
};
test("climb callout fires once around 1000 ft remaining, never for descending, stale or near-capture samples", () => {
  const event = guidanceTimeline(input).find(
    (e) =>
      e.command.category === "altitude" && e.command.direction === "levelOff",
  )!;
  expect(event.command).toMatchObject({ altitudeFt: 5000 });
  for (const patch of [
    { altitudeFt: 4500 },
    { altitudeFt: 3900 },
    { verticalSpeedFpm: -600 },
    { time: new Date(now - 21000).toISOString() },
  ])
    expect(
      guidanceTimeline({ ...input, fix: { ...input.fix, ...patch } }).some(
        (e) => e.key.startsWith("level-off"),
      ),
    ).toBe(false);
  const state: GuidanceNotices = {
    session: null,
    notices: [],
    seen: new Set(),
  };
  const first = observeGuidance(state, "f", "r", [event], now);
  expect(
    observeGuidance(
      first,
      "f",
      "r",
      [{ ...event, dueAt: now + 1000 }],
      now + 1000,
    ).notices,
  ).toHaveLength(1);
});

test("circuit countdown never increases when telemetry predicts a later tangent", () => {
  const state: GuidanceNotices = {
    session: null,
    notices: [],
    seen: new Set(),
  };
  const event = {
    key: "turn",
    dueAt: now + 20000,
    command: {
      category: "heading" as const,
      direction: "right" as const,
      headingDeg: 90,
    },
  };
  const first = observeGuidance(
    state,
    "f",
    "circuit",
    [event],
    now,
    true,
    true,
  );
  const later = observeGuidance(
    first,
    "f",
    "circuit",
    [{ ...event, dueAt: now + 40000 }],
    now + 5000,
    true,
    true,
  );
  expect(later.notices[0]?.dueAt).toBe(now + 20000);
  expect(
    observeGuidance(
      later,
      "f",
      "circuit",
      [{ ...event, dueAt: now + 40000 }],
      now + 20000,
      true,
      true,
    ).notices[0]?.announcedAt,
  ).toBe(now + 20000);
});

test("HOLD heading commands use outbound deadline and fix passage, independent of position on the drawn loop", () => {
  const holding = {
    config: {
      fix: route[1]!,
      levelFt: 5000,
      inboundTrueDeg: 242,
      direction: "left" as const,
      legSeconds: 60,
      tasKt: 100,
      approachTrueDeg: 62,
    },
    phase: "outbound" as const,
    timerStartedAt: now - 40000,
    entry: "parallel" as const,
    previous: null,
    departedFix: true,
    circuits: 0,
  };
  const events = guidanceTimeline({
    ...input,
    holdingActive: true,
    holding,
    fix: { ...input.fix, ...{ lat: 49, lon: 19 } },
  });
  const turn = events.find((e) => e.key.startsWith("hold-outbound"))!;
  expect(turn.dueAt).toBe(now + 20000);
  expect(turn.command).toMatchObject({ direction: "right", headingDeg: 242 });
  const afterFix = guidanceTimeline({
    ...input,
    holdingActive: true,
    holding: {
      ...holding,
      phase: "turn",
      timerStartedAt: null,
      circuits: 1,
      entry: "direct",
    },
  });
  expect(
    afterFix.find((e) => e.key.startsWith("hold-fix"))?.command,
  ).toMatchObject({ direction: "left", headingDeg: 62 });
  expect(
    guidanceTimeline({
      ...input,
      holdingActive: true,
      holding: { ...holding, timerStartedAt: now - 10000 },
    }).some((e) => e.command.category === "heading"),
  ).toBe(false);
});

test("TOC/TOD snap onto rendered Mercator segments, retaining abandoned-leg filtering", () => {
  const points = [
    { id: "TOC", lat: 50.2, lon: 20.5, isProfilePoint: true },
    { id: "TOD", lat: 50.8, lon: 20.5, isProfilePoint: true },
  ];
  const markers = mapProfilePoints(points, undefined, [
    { lat: 50, lon: 20 },
    { lat: 51, lon: 20 },
  ]);
  expect(markers).toHaveLength(2);
  for (const marker of markers) expect(marker.lon).toBeCloseTo(20, 10);
  expect(
    mapProfilePoints(
      points,
      [
        { ident: "DCT", lat: 52, lon: 22 },
        { ident: "END", lat: 53, lon: 22 },
      ],
      route,
    ),
  ).toEqual([]);
});

test("C172S speed schedule uses 72 KIAS climb and overrides old departure circuit turn speeds", () => {
  const c172 = aircraftSchema.parse(aircraft.find((a) => a.type === "C172S"));
  const profile = routeSpeedProfile(null, c172, 110, 0);
  expect(profile.climbIas).toBe(72);
  expect(profile.phases.climb).toBeCloseTo(72, 1);
  expect(profile.phases.cruise).toBe(110);
  expect(routeSpeedProfile(null, c172, 110, 5000).phases.climb).toBeGreaterThan(
    72,
  );
  const path = flyByRoute(
    [
      { lat: 50, lon: 20 },
      {
        lat: 50,
        lon: 20.2,
        patternOperation: "leave",
        turnPerformance: { tasKt: 100 },
      },
      { lat: 50.2, lon: 20.2 },
    ],
    { tasKt: 110, departureTasKt: 72 },
  );
  expect(path.turns.get(1)?.radiusNm).toBeCloseTo(72 / (60 * Math.PI), 2);
});

test("ATZ wins over FIS, departure hands to FIS in climb, and TMA approach only applies at its altitude", () => {
  const zone = (
    name: string,
    lower: string,
    upper: string,
    west: number,
    east: number,
    freq: string,
  ) =>
    airspaceFeatureSchema.parse({
      type: "Feature",
      bbox: [west, 49, east, 51],
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [west, 49],
            [east, 49],
            [east, 51],
            [west, 51],
            [west, 49],
          ],
        ],
      },
      properties: {
        name,
        class: name.split(" ")[0],
        lower,
        upper,
        active_now: true,
        activations: [],
        frequencies: [
          {
            frequencyMhz: freq,
            callsign: name,
            sector: null,
            serviceId: name.startsWith("TMA") ? "zblizanie" : "fiss",
          },
        ],
      },
    });
  const zones = commsZones([
    zone("ATZ EPNT", "GND", "5000 FT AMSL", 19.8, 20.1, "122.305"),
    zone("FIS KRAKOW", "GND", "UNL", 19, 22, "119.275"),
    zone("TMA EPKK", "4000 FT AMSL", "FL095", 20.5, 21, "121.075"),
  ]);
  const airport = () => [];
  const aglAtz = zone("ATZ HILL", "GND", "2500 FT AGL", 19.8, 20.1, "122.305");
  const aglZones = commsZones([
    aglAtz,
    zones.find((z) => z.properties.name === "FIS KRAKOW")!,
  ]);
  expect(
    rowsAt(
      { lat: 50, lon: 20, altitudeFt: 6000, altitudeAglFt: 1000 },
      aglZones,
      airport,
    ).map((r) => r.frequencyMhz),
  ).toEqual(["122.305"]);
  expect(
    rowsAt(
      { lat: 50, lon: 20, altitudeFt: 6000, altitudeAglFt: 3000 },
      aglZones,
      airport,
    ).map((r) => r.frequencyMhz),
  ).toEqual(["119.275"]);
  expect(
    rowsAt({ lat: 50, lon: 20, altitudeFt: 3000 }, zones, airport).map(
      (r) => r.frequencyMhz,
    ),
  ).toEqual(["122.305"]);
  expect(
    rowsAt({ lat: 50, lon: 20.2, altitudeFt: 3000 }, zones, airport).map(
      (r) => r.frequencyMhz,
    ),
  ).toEqual(["119.275"]);
  expect(
    rowsAt({ lat: 50, lon: 20.6, altitudeFt: 3000 }, zones, airport).map(
      (r) => r.frequencyMhz,
    ),
  ).toEqual(["119.275"]);
  expect(
    rowsAt({ lat: 50, lon: 20.6, altitudeFt: 5000 }, zones, airport).map(
      (r) => r.frequencyMhz,
    ),
  ).toEqual(["121.075"]);
  const estimate = estimateComms(
    {
      phase: "climb",
      position: { lat: 50, lon: 20.09, altitudeFt: 3000 },
      gpsSpeedKt: 100,
      plannedSpeedKt: 100,
      route: [
        { lat: 50, lon: 20 },
        { lat: 50, lon: 21 },
      ],
    },
    { dep: airport, arr: airport, at: (p) => rowsAt(p, zones, airport) },
  );
  expect(
    commsChangeSuggestion("climb", estimate, new Set())?.rows.map(
      (r) => r.frequencyMhz,
    ),
  ).toEqual(["119.275"]);
});
