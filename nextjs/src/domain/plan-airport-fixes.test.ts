import { afterAll, afterEach, expect, test, vi } from "vitest";
import { type Navpoint, type Procedure } from "~/data/schemas";
import { useInFlight } from "~/stores/inflight";
import { planAirportFixes } from "./plan-airport-fixes";
vi.hoisted(() => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});
afterAll(() => vi.unstubAllGlobals());
const point = (ident: string, patch: Partial<Navpoint> = {}): Navpoint => ({
  ident,
  name: ident,
  kind: "ifr-waypoint",
  aliases: [],
  lat: 50,
  lon: 19,
  airport: null,
  description: null,
  airways: [],
  navaid: null,
  source: "test",
  ...patch,
});
const procedure = (airport: string, ident: string): Procedure => ({
  airport,
  type: "STAR",
  id: ident,
  designator: ident,
  runways: ["28"],
  source: "test",
  legs: [
    {
      ident,
      lat: 50,
      lon: 19,
      altitude: null,
      speedKt: null,
      trackMagDeg: null,
      distanceNm: null,
    },
  ],
});
const airports = ["EPNT", "EPNL", "EPKK", "EPPO"];
const points = [
  point("RW12", {
    name: "RW12/EPNT",
    kind: "runway-threshold",
    airport: "EPNT",
  }),
  point("RW04", {
    name: "RW04/EPNL",
    kind: "runway-threshold",
    airport: "EPNL",
  }),
  point("KK531"),
  point("PO732"),
  point("ENROUTE"),
  point("EPNT ALFA", {
    kind: "vfr-reporting-point",
    airport: "EPNT",
    aliases: ["EPNTA"],
  }),
];
const procedures = [procedure("EPPO", "PO732")];
const ids = (active: string[]) =>
  planAirportFixes(points, procedures, airports, active).map((p) => p.ident);
test("hides foreign runway and terminal fixes with no selected airports", () => {
  expect(ids([])).toEqual(["ENROUTE", "EPNT ALFA"]);
});
test("shows only departure and arrival runway/procedure fixes", () => {
  expect(ids(["EPNT", "EPKK"])).toEqual([
    "RW12",
    "KK531",
    "ENROUTE",
    "EPNT ALFA",
  ]);
  expect(ids(["EPNL", "EPPO"])).toEqual([
    "RW04",
    "PO732",
    "ENROUTE",
    "EPNT ALFA",
  ]);
});
test("makes diversion fixes visible in addition to the planned endpoints", () => {
  expect(ids(["EPNT", "EPKK", "EPPO"])).toContain("PO732");
  expect(ids(["EPNT", "EPKK", "EPPO"])).not.toContain("RW04");
});
test("shared procedure fixes appear if any owning airport is selected", () => {
  const shared = [procedure("EPPO", "SHARED"), procedure("EPKK", "SHARED")];
  expect(
    planAirportFixes([point("SHARED")], shared, airports, ["EPKK"]).map(
      (p) => p.ident,
    ),
  ).toEqual(["SHARED"]);
  expect(
    planAirportFixes([point("SHARED")], shared, airports, ["EPNT"]),
  ).toEqual([]);
});
test("adds published coordinates only for procedures of selected airports", () => {
  expect(planAirportFixes([], procedures, airports, [])).toEqual([]);
  expect(planAirportFixes([], procedures, airports, ["EPPO"])[0]).toMatchObject(
    { ident: "PO732", airport: "EPPO", lat: 50, lon: 19 },
  );
  expect(
    planAirportFixes(
      [],
      [
        {
          ...procedures[0]!,
          legs: [{ ...procedures[0]!.legs[0]!, lat: null }],
        },
      ],
      airports,
      ["EPPO"],
    ),
  ).toEqual([]);
});
const original = useInFlight.getState();
afterEach(() => useInFlight.setState(original));
test("Divert replaces the remaining route and retains track and timers", () => {
  const departure = { ident: "EPNT", lat: 49.46, lon: 20.05 },
    arrival = { ident: "EPKK", lat: 50.07, lon: 19.78 };
  const before = useInFlight.getState();
  useInFlight.setState({
    route: [departure, arrival],
    activeLeg: 1,
    startedAt: "2026-10-14T06:00:00Z",
  });
  before.divertTo(departure, { lat: 49.8, lon: 20 });
  const state = useInFlight.getState();
  expect(state.route).toEqual([
    { ident: "DCT", lat: 49.8, lon: 20 },
    departure,
  ]);
  expect(state.activeLeg).toBe(0);
  expect(state.timers).toBe(before.timers);
  expect(state.track).toBe(before.track);
});

test("keeps shared airway fixes visible even when they occur in a foreign procedure", () => {
  expect(
    planAirportFixes(
      [point("SHARED", { airways: ["L999"] })],
      [procedure("EPPO", "SHARED")],
      airports,
      [],
    ).map((p) => p.ident),
  ).toEqual(["SHARED"]);
});

test("retains the diversion airport through direct-to and clears it on route resume", () => {
  const route = [
    { ident: "EPNT", lat: 49.46, lon: 20.05 },
    { ident: "EPKK", lat: 50.07, lon: 19.78 },
  ];
  const gps = { lat: 50, lon: 19 };
  useInFlight
    .getState()
    .divertTo({ ident: "EPPO", lat: 52.42, lon: 16.82 }, gps);
  expect(useInFlight.getState().divertAirport).toBe("EPPO");
  useInFlight
    .getState()
    .goToPoint({ ident: "PO732", lat: 52.3, lon: 16.8 }, gps);
  expect(useInFlight.getState().divertAirport).toBe("EPPO");
  const persisted = useInFlight.persist.getOptions().partialize!(
    useInFlight.getState(),
  );
  expect(persisted).toHaveProperty("divertAirport", "EPPO");
  useInFlight.getState().resumeRoute(route, gps);
  expect(useInFlight.getState().divertAirport).toBeNull();
});

test("supports airport terminal prefixes outside Poland", () => {
  expect(
    planAirportFixes([point("PR732")], [], ["LKPR"], ["LKPR"]).map(
      (p) => p.ident,
    ),
  ).toEqual(["PR732"]);
  expect(planAirportFixes([point("PR732")], [], ["LKPR"], ["EPKK"])).toEqual(
    [],
  );
});
