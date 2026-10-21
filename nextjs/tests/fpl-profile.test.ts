import { expect, test } from "vitest";
import {
  flightPlanProfile,
  profileAircraftDistance,
  terrainProfileSections,
} from "~/domain/flight-plan-profile";
import { buildRoutePlan, pointKey } from "~/domain/route-plan";
import { navigationRoute } from "~/domain/navigation-route";
import { airportSchema } from "~/data/schemas";
import airports from "../public/data/airports.json";
import { distanceNm } from "~/domain/geo";

const airport = (id: string) =>
  airportSchema.parse(airports.find((p) => p.ident === id));
function plan(destination = "EPRJ") {
  return buildRoutePlan(
    {
      airport: () => null,
      point: () => null,
      procedures: () => [],
      airways: {},
    },
    {
      departure: airport("EPML"),
      destination: airport(destination),
      alternate: null,
      altitudeFt: 5000,
      routeText: "",
      selections: { SID: null, STAR: null, APPROACH: null },
      inlineSelections: {},
      insertedWaypoints:
        destination === "EPML" ? [{ ident: "TURN", lat: 50.5, lon: 22.2 }] : [],
      waypointAltitudes: {},
      waypointWx: {},
      conditionsWind: null,
      runwayWind: () => null,
      climbGradientFtPerNm: 500,
    },
  )!;
}

test("FPL inserts TOC/TOD in sequence with profile levels, preserving every navigation index", () => {
  const p = plan();
  const route = navigationRoute(p),
    original = structuredClone(route);
  const profile = flightPlanProfile(route, p, { tasKt: 100 }, 5000);
  expect(profile.rows.filter((r) => r.event).map((r) => r.event)).toEqual([
    "TOC",
    "TOD",
  ]);
  expect(
    profile.rows.filter((r) => r.routeIndex !== null).map((r) => r.routeIndex),
  ).toEqual(route.map((_, i) => i));
  for (const row of profile.rows.filter((r) => r.event)) {
    const event = p.points.find((point) => point.id === row.event)!;
    expect(row.altitudeFt).toBe(p.pointAltitudeByKey[pointKey(event)]);
    expect(row.distanceNm).toBeGreaterThan(0);
    expect(row.distanceNm).toBeLessThan(profile.totalNm);
  }
  expect(route).toEqual(original);
  expect(
    profile.samples.every(
      (p, i, list) => !i || p.distanceNm >= list[i - 1]!.distanceNm,
    ),
  ).toBe(true);
  expect(Math.max(...profile.samples.map((p) => p.altitudeFt))).toBe(5000);
  expect(profile.samples.at(-1)!.altitudeFt).toBe(
    profile.rows.at(-1)!.altitudeFt,
  );
});

test("saved rounded airport coordinates retain profile events and arrival altitude when reference data arrives later", () => {
  const p = plan();
  const route = navigationRoute(p).map((point) => ({
    ...point,
    lat: point.lat + 0.0005,
  }));
  const profile = flightPlanProfile(route, p, { tasKt: 100 }, 5000);
  expect(
    profile.rows.filter((row) => row.event).map((row) => row.event),
  ).toEqual(["TOC", "TOD"]);
  expect(profile.rows.at(-1)!.altitudeFt).toBe(
    p.pointAltitudeByKey[pointKey(p.points.at(-1))],
  );
  expect(profile.rows.at(-1)!.altitudeFt).not.toBe(5000);
});

test("direct/divert removes abandoned profile events and handles a return to departure", () => {
  const p = plan("EPML"),
    route = navigationRoute(p);
  const full = flightPlanProfile(route, p, { tasKt: 100 }, 5000);
  expect(full.rows.filter((r) => r.event)).toHaveLength(2);
  const direct = [{ ident: "DCT", lat: 50.4, lon: 22 }, route.at(-1)!];
  const profile = flightPlanProfile(direct, p, { tasKt: 100 }, 5000);
  expect(profile.rows.filter((r) => r.event)).toHaveLength(0);
  expect(profile.rows.at(-1)!.altitudeFt).toBe(full.rows.at(-1)!.altitudeFt);
  expect(
    flightPlanProfile(
      [{ ident: "NEW", lat: 51, lon: 23 }],
      p,
      { tasKt: 100 },
      5000,
    ).rows.filter((r) => r.event),
  ).toHaveLength(0);
});

test("coincident profile events remain separate non-navigable rows", () => {
  const p = plan();
  const event = p.points.find((point) => point.id === "TOC")!;
  const replacement = {
    ...event,
    id: "FIX",
    kind: "waypoint" as const,
    isProfilePoint: false,
    profileLabels: ["TOC"],
  };
  p.points[p.points.indexOf(event)] = replacement;
  p.pointAltitudeByKey[pointKey(replacement)] = 5000;
  const profile = flightPlanProfile(
    navigationRoute(p),
    p,
    { tasKt: 100 },
    5000,
  );
  const fix = profile.rows.find((r) => r.point.ident === "FIX")!;
  const toc = profile.rows.find((r) => r.event === "TOC")!;
  expect(toc.distanceNm).toBe(fix.distanceNm);
  expect(toc.routeIndex).toBeNull();
  expect(fix.routeIndex).not.toBeNull();
});

test("aircraft and DEM stations follow the curved leg rather than shortcuts or a nearby later leg", () => {
  const route = [
    { ident: "A", lat: 50, lon: 20 },
    { ident: "B", lat: 50, lon: 20.2 },
    { ident: "C", lat: 50.2, lon: 20.2 },
  ];
  const profile = flightPlanProfile(route, null, { tasKt: 100 }, 5000);
  const turn = profile.path.turns.get(1)!;
  const position = turn.points[Math.floor(turn.points.length / 2)]!;
  const result = profileAircraftDistance(profile, position, 1)!;
  expect(result.crossTrackNm).toBeLessThan(0.001);
  expect(result.distanceNm).toBeGreaterThan(0);
  expect(result.distanceNm).toBeLessThan(profile.totalNm);
  for (const sample of profile.samples) {
    const a = profileAircraftDistance(profile, sample, 0)!;
    const b = profileAircraftDistance(profile, sample, 1)!;
    expect(Math.min(a.crossTrackNm, b.crossTrackNm)).toBeLessThan(0.001);
  }
  expect(distanceNm(profile.samples[0]!, route[0]!)).toBeLessThan(0.001);
  expect(flightPlanProfile([], null, { tasKt: 100 }, 5000).samples).toEqual([]);
});

test("missing and invalid terrain creates gaps, not a filled safe-looking valley", () => {
  const stations = [100, 200, null, 0, 300, NaN, 400].map((terrainFt) => ({
    terrainFt,
  }));
  expect(terrainProfileSections(stations)).toEqual([
    stations.slice(0, 2),
    stations.slice(3, 5),
    stations.slice(6),
  ]);
  expect(terrainProfileSections([{ terrainFt: null }])).toEqual([]);
});
