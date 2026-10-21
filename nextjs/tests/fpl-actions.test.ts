import { expect, test } from "vitest";
import { editFplPoint } from "~/domain/fpl-actions";
import { useInFlight } from "~/stores/inflight";

const route = ["A", "B", "C", "D", "E"].map((ident, i) => ({
  ident,
  lat: 50 + i * 0.1,
  lon: 20,
  altitudeFt: 5000,
}));
const position = { lat: 50.05, lon: 20.01 };

test("Skip a future fix joins its predecessor to its successor without moving the active leg", () => {
  const edit = editFplPoint(route, 0, 2, "skip", null)!;
  expect(edit.route.map((p) => p.ident)).toEqual(["A", "B", "D", "E"]);
  expect(edit.activeLeg).toBe(0);
  expect(edit.redirected).toBe(false);
});
test("Skip the active target flies from the present position to the following fix", () => {
  const edit = editFplPoint(route, 0, 1, "skip", position)!;
  expect(edit.route.map((p) => p.ident)).toEqual(["DCT", "C", "D", "E"]);
  expect(edit.route[0]).toMatchObject(position);
  expect(edit.activeLeg).toBe(0);
  expect(edit.redirected).toBe(true);
});
test("Set Next D keeps A to B active and replaces B to C to D with B to D", () => {
  const edit = editFplPoint(route, 0, 3, "set-next", null)!;
  expect(edit.route).toEqual([route[0], route[1], route[3], route[4]]);
  expect(edit.activeLeg).toBe(0);
  expect(edit.redirected).toBe(false);
});
test("Set Next on the active target reanchors it at the present position", () => {
  const edit = editFplPoint(route, 1, 2, "set-next", position)!;
  expect(edit.route.map((p) => p.ident)).toEqual(["DCT", "C", "D", "E"]);
  expect(edit.route[0]).toMatchObject(position);
  expect(edit.redirected).toBe(true);
});
test("invalid skips and active redirects without a live position leave the route untouched", () => {
  for (const index of [-1, 0, 4, 7, 1.5])
    expect(editFplPoint(route, 0, index, "skip", position)).toBeNull();
  for (const action of ["skip", "set-next"] as const)
    expect(editFplPoint(route, 0, 1, action, null)).toBeNull();
  expect(editFplPoint(route, 0, 1, "skip", { lat: NaN, lon: 20 })).toBeNull();
  expect(route.map((p) => p.ident)).toEqual(["A", "B", "C", "D", "E"]);
});
test("Set Next can revisit an earlier fix after reaching the current target", () => {
  const edit = editFplPoint(route, 1, 0, "set-next", null)!;
  expect(edit.route.map((p) => p.ident)).toEqual([
    "A",
    "B",
    "C",
    "A",
    "B",
    "C",
    "D",
    "E",
  ]);
  expect(edit.activeLeg).toBe(1);
});
test("active Skip retains flown geometry, timers and track across repeated route commands", () => {
  const state = useInFlight.getState();
  state.start(route);
  useInFlight.setState({ activeLeg: 1 });
  const timers = useInFlight.getState().timers;
  const track = useInFlight.getState().track;
  state.editFplPoint(2, "skip", position, { tasKt: 100 });
  expect(useInFlight.getState().route.map((p) => p.ident)).toEqual([
    "DCT",
    "D",
    "E",
  ]);
  expect(useInFlight.getState().routeHistory?.lastPassed.ident).toBe("B");
  const history = useInFlight.getState().routeHistory;
  state.editFplPoint(1, "set-next", { lat: 50.1, lon: 20.01 });
  expect(useInFlight.getState().routeHistory).toBe(history);
  expect(useInFlight.getState().timers).toBe(timers);
  expect(useInFlight.getState().track).toBe(track);
});
