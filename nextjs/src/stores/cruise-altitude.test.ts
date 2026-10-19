import { beforeEach, expect, it, vi, afterEach } from "vitest";
import { useCruiseAltitude } from "./cruise-altitude";
import { useFlight } from "./flight";
import { useInFlight } from "./inflight";
import { newFlight } from "~/data/flight";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(120000);
  useCruiseAltitude.setState(useCruiseAltitude.getInitialState(), true);
  useFlight
    .getState()
    .load({
      ...newFlight(),
      cruiseAltitudeFt: 5000,
      waypointAltitudes: { FREE: 5000 },
    });
  useInFlight.setState({
    startedAt: "session",
    activeLeg: 0,
    route: [
      { ident: "PAST", lat: 50, lon: 19, altitudeFt: 5000 },
      { ident: "FREE", lat: 51, lon: 20, altitudeFt: 5000 },
    ],
  });
  for (let at = 0; at <= 120000; at += 5000)
    useCruiseAltitude
      .getState()
      .observe(
        {
          session: "session",
          plannedFt: 5000,
          source: "gps",
          phase: "cruise",
          sample: { at, altitudeFt: 6000 },
        },
        at,
      );
});
afterEach(() => vi.useRealTimers());
it("YES updates the saved plan and active navigation levels without resetting the leg", () => {
  useCruiseAltitude.getState().respond(true);
  expect(useFlight.getState().flight.cruiseAltitudeFt).toBe(6000);
  expect(useFlight.getState().flight.waypointAltitudes.FREE).toBe(6000);
  expect(useInFlight.getState().route.map((p) => p.altitudeFt)).toEqual([
    5000, 6000,
  ]);
  expect(useInFlight.getState().activeLeg).toBe(0);
});
it("NO, a stale suggestion or an edited plan never changes cruise altitude", () => {
  useCruiseAltitude.getState().respond(false);
  expect(useFlight.getState().flight.cruiseAltitudeFt).toBe(5000);
  expect(useCruiseAltitude.getState().state.declined).toEqual([6000]);
});
it("an expired prompt cannot accept a no-longer-current altitude", () => {
  vi.setSystemTime(150000);
  useCruiseAltitude.getState().respond(true);
  expect(useFlight.getState().flight.cruiseAltitudeFt).toBe(5000);
});
