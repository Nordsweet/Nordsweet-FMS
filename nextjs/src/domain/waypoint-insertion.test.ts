import { afterEach, expect, test, vi } from "vitest";
import {
  anchoredWaypoint,
  fallbackFlightRoute,
  optimalWaypointIndex,
  waypointInsertionIndex,
  waypointInsertionSlots,
  waypointsAfterRouteRemoval,
  safeWaypointIndex,
} from "./waypoint-insertion";
import { useInFlight } from "~/stores/inflight";
import { flightSchema, type FlightPoint } from "~/data/flight";

const a = { ident: "A", lat: 50, lon: 19 },
  b = { ident: "B", lat: 51, lon: 19 },
  c = { ident: "C", lat: 52, lon: 19 };
const point = { ident: "NEW", lat: 51.6, lon: 19.1 };

test("removing a target fix from a round trip keeps the other fixes between the two airport occurrences", () => {
  const home = { ident: "EPNT", lat: 49.46, lon: 20.05 };
  const firstInserted = anchoredWaypoint([home, home], b, 1);
  const secondInserted = anchoredWaypoint([home, b, home], c, 1);
  const remaining = waypointsAfterRouteRemoval(
    [home, c, b, home],
    [firstInserted, secondInserted],
    2,
    0,
  );
  expect(
    fallbackFlightRoute({
      departure: home,
      destination: home,
      waypoints: remaining,
    }).map((p) => p.ident),
  ).toEqual(["EPNT", "C", "EPNT"]);
  expect(remaining[0]!.anchor?.occurrence).toBe(1);
});

test("removing a route fix preserves the visible order of multiple manually inserted fixes", () => {
  const home = { ident: "EPNT", lat: 49.46, lon: 20.05 };
  const route = [home, a, b, c, home];
  const saved = [
    anchoredWaypoint([home, b, home], c, 1),
    anchoredWaypoint([home, home], b, 1),
    anchoredWaypoint([home, c, b, home], a, 1),
  ];
  const remaining = waypointsAfterRouteRemoval(route, saved, 2, 1);
  expect(
    fallbackFlightRoute({
      departure: home,
      destination: home,
      waypoints: remaining,
    }).map((p) => p.ident),
  ).toEqual(["EPNT", "A", "C", "EPNT"]);
});

test.each([1, 2, 3])(
  "a closed route retains both endpoints and the remaining order after removing fix %i",
  (index) => {
    const home = { ident: "EPNT", lat: 49.46, lon: 20.05 };
    const visible = [home, a, b, c, home];
    const waypoints = [
      anchoredWaypoint([home, home], c, 1),
      anchoredWaypoint([home, c, home], b, 1),
      anchoredWaypoint([home, b, c, home], a, 1),
    ];
    const removed = waypoints.findIndex(
      (p) => p.ident === visible[index]!.ident,
    );
    const remaining = waypointsAfterRouteRemoval(
      visible,
      waypoints,
      index,
      removed,
    );
    expect(
      fallbackFlightRoute({
        departure: home,
        destination: home,
        waypoints: remaining,
      }).map((p) => p.ident),
    ).toEqual(visible.filter((_, i) => i !== index).map((p) => p.ident));
  },
);

const departureCircuit = ["EPNT THR12", "TPD1/EPNT", "TPX1/EPNT"].map(
  (ident, i) => ({
    ident,
    lat: 49 + i / 100,
    lon: 20,
    patternId: "departure",
    patternOperation: "leave" as const,
  }),
);
const arrivalCircuit = [
  "TP1/EPNL",
  "TP2/EPNL",
  "TP3/EPNL",
  "EPNL THR22",
  "EPNL",
].map((ident, i) => ({
  ident,
  lat: 50 + i / 100,
  lon: 20,
  patternId: "arrival",
  patternOperation: "join" as const,
}));

test("removing a fix preserves the remaining order between two traffic patterns", () => {
  const displayed = [...departureCircuit, a, b, c, ...arrivalCircuit];
  const saved = [
    anchoredWaypoint([...departureCircuit, ...arrivalCircuit], c, 3),
    anchoredWaypoint([...departureCircuit, c, ...arrivalCircuit], b, 3),
    anchoredWaypoint([...departureCircuit, b, c, ...arrivalCircuit], a, 3),
  ];
  const remaining = waypointsAfterRouteRemoval(displayed, saved, 4, 1);
  const placeholders = [departureCircuit[0]!, arrivalCircuit.at(-1)!];
  const result: (FlightPoint & {
    patternId?: string;
    patternOperation?: "join" | "leave";
  })[] = [...placeholders];
  for (const waypoint of remaining)
    result.splice(waypointInsertionIndex(result, waypoint), 0, waypoint);
  expect(result.map((p) => p.ident)).toEqual([
    placeholders[0]!.ident,
    "A",
    "C",
    placeholders[1]!.ident,
  ]);
});

test("a circuit departure and arrival at the same airport retain the second endpoint occurrence", () => {
  const home = { ident: "EPNT", lat: 49.46, lon: 20.05 };
  const leave = departureCircuit;
  const join = arrivalCircuit.map((p, i) =>
    i === arrivalCircuit.length - 1 ? { ...p, ...home } : p,
  );
  const shown = [...leave, a, b, c, ...join];
  const saved = [
    anchoredWaypoint([...leave, ...join], c, 3),
    anchoredWaypoint([...leave, c, ...join], b, 3),
    anchoredWaypoint([...leave, b, c, ...join], a, 3),
  ];
  const remaining = waypointsAfterRouteRemoval(shown, saved, 4, 1);
  expect(remaining.map((p) => p.anchor?.occurrence)).toEqual([1, 1]);
  expect(
    fallbackFlightRoute({
      departure: home,
      destination: home,
      waypoints: remaining,
    }).map((p) => p.ident),
  ).toEqual(["EPNT", "A", "C", "EPNT"]);
});

test("the first departure exit to arrival entry slot is the only choice for adjacent circuits", () => {
  const route = [...departureCircuit, ...arrivalCircuit];
  expect(waypointInsertionSlots(route)).toEqual([3]);
  expect(optimalWaypointIndex(route, point)).toBe(3);
  for (let index = 0; index <= route.length; index++) {
    expect(safeWaypointIndex(route, index)).toBe(3);
    const saved = flightSchema.shape.waypoints.parse([
      anchoredWaypoint(route, point, index),
    ])[0]!;
    expect(waypointInsertionIndex(route, saved)).toBe(3);
  }
});

test("only en-route slots are available, without changing ordinary route editing", () => {
  const route = [...departureCircuit, a, b, ...arrivalCircuit];
  expect(waypointInsertionSlots(route)).toEqual([3, 4, 5]);
  expect(waypointInsertionSlots([...departureCircuit, a])).toEqual([3, 4]);
  expect(waypointInsertionSlots([a, ...arrivalCircuit])).toEqual([0, 1]);
  expect(waypointInsertionSlots([a, b, c])).toEqual([0, 1, 2, 3]);
  // NEW is much closer to the arrival circuit, but cannot split it.
  expect(optimalWaypointIndex(route, arrivalCircuit[2]!)).toBe(5);
});

test("legacy anchors inside a circuit are moved to its legal boundary", () => {
  const route = [...departureCircuit, a, ...arrivalCircuit];
  const legacyDeparture = anchoredWaypoint(
    departureCircuit.map(({ ident, lat, lon }) => ({ ident, lat, lon })),
    point,
    1,
  );
  expect(waypointInsertionIndex(route, legacyDeparture)).toBe(3);
  const legacyArrival = anchoredWaypoint(
    arrivalCircuit.map(({ ident, lat, lon }) => ({ ident, lat, lon })),
    point,
    2,
  );
  expect(waypointInsertionIndex(route, legacyArrival)).toBe(4);
});

test("the active flight store cannot split either circuit even when called outside the dialog", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  const route = [...departureCircuit, ...arrivalCircuit];
  for (const index of [0, 1, 2, 4, 6, 8]) {
    useInFlight.getState().start(route);
    useInFlight.getState().insertWaypoint(index, point);
    expect(useInFlight.getState().route).toEqual([
      ...departureCircuit,
      point,
      ...arrivalCircuit,
    ]);
  }
});

test("a regenerated circuit target retains insertion after the previous en-route point", () => {
  const saved = anchoredWaypoint([a, b, ...arrivalCircuit], point, 2);
  expect(waypointInsertionIndex([a, b, c], saved)).toBe(2);
});

test.each([0, 1])(
  "editing current leg at index %i starts at the aircraft and preserves flight state",
  (index) => {
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    const store = useInFlight.getState();
    store.start([a, b, c]);
    useInFlight.setState({ phase: "cruise" });
    const before = useInFlight.getState();
    const position = { lat: 50.4, lon: 19.2 };
    store.removeWaypoint(index, position);
    const after = useInFlight.getState();
    expect(after.route).toEqual([
      { ident: "DCT", ...position },
      ...(index === 0 ? [b, c] : [c]),
    ]);
    expect(after.activeLeg).toBe(0);
    expect(after.startedAt).toBe(before.startedAt);
    expect(after.timers).toBe(before.timers);
    expect(after.track).toBe(before.track);
    expect(after.phase).toBe("cruise");
  },
);

test("insertion on the current leg starts at the aircraft; later edits do not change that leg", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  const store = useInFlight.getState();
  const position = { lat: 50.4, lon: 19.2 };
  store.start([a, b, c]);
  store.insertWaypoint(1, point, position);
  expect(useInFlight.getState().route).toEqual([
    { ident: "DCT", ...position },
    point,
    b,
    c,
  ]);
  store.removeWaypoint(3, { lat: 50.5, lon: 19.3 });
  expect(useInFlight.getState().route).toEqual([
    { ident: "DCT", ...position },
    point,
    b,
  ]);
});

test("removing the final active target leaves no leg back to an already passed fix", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  const store = useInFlight.getState();
  const position = { lat: 51.5, lon: 19.2 };
  store.start([a, b, c]);
  useInFlight.setState({ activeLeg: 1 });
  store.removeWaypoint(2, position);
  expect(useInFlight.getState().route).toEqual([{ ident: "DCT", ...position }]);
});
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
