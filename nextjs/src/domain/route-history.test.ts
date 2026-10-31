import { afterEach, expect, test, vi } from "vitest";
import { retainPassedRoute, routeHistoryPaths } from "./route-history";
import { flyByRoute } from "./fly-by";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const route = [
  { ident: "A", lat: 50, lon: 19 },
  { ident: "B", lat: 50, lon: 20 },
  { ident: "C", lat: 51, lon: 20 },
  { ident: "D", lat: 51, lon: 21 },
];
const position = { lat: 50.4, lon: 20 };
test("retains only passed geometry, joins last fix to DCT position and replaces the connector on repeated Direct", () => {
  const history = retainPassedRoute(null, route, 1, { tasKt: 120 });
  expect(history?.lastPassed).toEqual(route[1]);
  expect(history?.paths).toEqual([
    flyByRoute(route.slice(0, 2), { tasKt: 120 }).points,
  ]);
  const direct = [{ ident: "DCT", ...position }, route[3]!];
  expect(routeHistoryPaths(history, direct).at(-1)).toEqual([
    route[1],
    direct[0],
  ]);
  expect(retainPassedRoute(history, direct, 0)).toBe(history);
  const next = [{ ident: "DCT", lat: 50.5, lon: 20.3 }, route[2]!];
  expect(routeHistoryPaths(history, next).at(-1)).toEqual([route[1], next[0]]);
});
test("after passing another real fix, freezes the previous DCT portion without restoring skipped points", () => {
  const history = retainPassedRoute(null, route, 1);
  const direct = [
    { ident: "DCT", ...position },
    route[3]!,
    { ident: "E", lat: 52, lon: 21 },
  ];
  const updated = retainPassedRoute(history, direct, 1);
  expect(updated?.lastPassed).toEqual(route[3]);
  expect(updated?.paths).toHaveLength(3);
  expect(updated?.paths.flat()).not.toContainEqual(route[2]);
});
test("Direct and Divert retain history through persistence and a new flight clears it", async () => {
  vi.useFakeTimers();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.resetModules();
  const { useInFlight } = await import("~/stores/inflight");
  const store = useInFlight.getState();
  store.start(route);
  store.setActiveLeg(1);
  store.goDirect(3, position);
  expect(useInFlight.getState().routeHistory?.lastPassed).toEqual(route[1]);
  store.divertTo({ ident: "OTHER", lat: 52, lon: 19 }, { lat: 50.6, lon: 20 });
  expect(useInFlight.getState().routeHistory?.lastPassed).toEqual(route[1]);
  // The flight in progress is written at most every 2 s.
  vi.advanceTimersByTime(2000);
  const saved = JSON.parse(storage.get("nordsweet.inflight.v1")!) as {
    state: { routeHistory: unknown };
  };
  expect(saved.state.routeHistory).toEqual(useInFlight.getState().routeHistory);
  vi.resetModules();
  const { useInFlight: reloaded } = await import("~/stores/inflight");
  expect(reloaded.getState().routeHistory).toEqual(saved.state.routeHistory);
  reloaded.getState().start(route);
  expect(reloaded.getState().routeHistory).toBeNull();
});
