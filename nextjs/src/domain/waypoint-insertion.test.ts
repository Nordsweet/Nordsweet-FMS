import { afterEach, expect, test, vi } from "vitest";
import {
  anchoredWaypoint,
  fallbackFlightRoute,
  optimalWaypointIndex,
  waypointInsertionIndex,
} from "./waypoint-insertion";
import { useInFlight } from "~/stores/inflight";
import { flightSchema, type FlightPoint } from "~/data/flight";

const a = { ident: "A", lat: 50, lon: 19 },
  b = { ident: "B", lat: 51, lon: 19 },
  c = { ident: "C", lat: 52, lon: 19 };
const point = { ident: "NEW", lat: 51.6, lon: 19.1 };
test("suggests the least additional distance without changing endpoints", () => {
  expect(optimalWaypointIndex([a, b, c], point)).toBe(2);
  expect(optimalWaypointIndex([], point)).toBe(0);
  expect(optimalWaypointIndex([a], point)).toBe(1);
});
test("explicit choice overrides nearest-leg routing and survives the flight schema", () => {
  const selected = anchoredWaypoint([a, b, c], point, 1);
  expect(waypointInsertionIndex([a, b, c], selected)).toBe(1);
  const anchorSchema = flightSchema.shape.waypoints;
  const saved = anchorSchema.parse([selected]);
  expect(
    fallbackFlightRoute({
      departure: a,
      destination: c,
      waypoints: [b, ...saved],
    }).map((p) => p.ident),
  ).toEqual(["A", "NEW", "B", "C"]);
});
test("before-first and after-last slots preserve the requested visual order", () => {
  for (const [index, expected] of [
    [0, ["NEW", "A", "B", "C"]],
    [3, ["A", "B", "C", "NEW"]],
  ] as const) {
    const inserted = anchoredWaypoint([a, b, c], point, index);
    expect(
      fallbackFlightRoute({
        departure: a,
        destination: c,
        waypoints: [b, inserted],
      }).map((p) => p.ident),
    ).toEqual(expected);
  }
});
test("repeated fixes use the clicked occurrence rather than the first matching name", () => {
  const route = [a, b, a, c];
  const inserted = anchoredWaypoint(route, point, 2);
  expect(waypointInsertionIndex(route, inserted)).toBe(2);
});
test("a later insertion can target an already inserted waypoint", () => {
  const first = anchoredWaypoint([a, b, c], point, 1);
  const next = anchoredWaypoint(
    [a, first, b, c],
    { ...point, ident: "NEXT" },
    1,
  );
  expect(
    fallbackFlightRoute({
      departure: a,
      destination: c,
      waypoints: [b, first, next],
    }).map((p) => p.ident),
  ).toEqual(["A", "NEXT", "NEW", "B", "C"]);
});
test("legacy GPX waypoint order and adjacent leg anchors stay compatible", () => {
  const legacy: FlightPoint = { ...point, anchor: { from: "A", to: "B" } };
  expect(waypointInsertionIndex([a, b, c], legacy)).toBe(1);
  expect(
    fallbackFlightRoute({ departure: a, destination: c, waypoints: [b] }),
  ).toEqual([a, b, c]);
});
const original = useInFlight.getState();
afterEach(() => {
  useInFlight.setState(original, true);
  vi.unstubAllGlobals();
});
test("inserting into an active flight updates its route while preserving timers and flown leg", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  const store = useInFlight.getState();
  store.start([a, b, c]);
  const timers = useInFlight.getState().timers;
  useInFlight.setState({ activeLeg: 1 });
  store.insertWaypoint(1, point);
  expect(useInFlight.getState().route.map((p) => p.ident)).toEqual([
    "A",
    "NEW",
    "B",
    "C",
  ]);
  expect(useInFlight.getState().activeLeg).toBe(2);
  expect(useInFlight.getState().timers).toBe(timers);
});

test.each([
  { index: 0, activeLeg: 2, expectedLeg: 1 },
  { index: 2, activeLeg: 2, expectedLeg: 1 },
  { index: 3, activeLeg: 2, expectedLeg: 2 },
  { index: 4, activeLeg: 2, expectedLeg: 2 },
  { index: 4, activeLeg: 3, expectedLeg: 2 },
])(
  "removing fix $index keeps the active leg valid ($activeLeg → $expectedLeg) and preserves flight state",
  ({ index, activeLeg, expectedLeg }) => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const route = [a, b, point, c, { ident: "END", lat: 53, lon: 19 }];
    const store = useInFlight.getState();
    store.start(route);
    useInFlight.setState({ activeLeg, phase: "cruise", divertAirport: "EPNT" });
    const before = useInFlight.getState();
    store.removeWaypoint(index);
    const after = useInFlight.getState();
    expect(after.route).toEqual(route.filter((_, i) => i !== index));
    expect(after.activeLeg).toBe(expectedLeg);
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.timers).toBe(before.timers);
    expect(after.track).toBe(before.track);
    expect(after.phase).toBe("cruise");
    expect(after.divertAirport).toBe("EPNT");
  },
);
