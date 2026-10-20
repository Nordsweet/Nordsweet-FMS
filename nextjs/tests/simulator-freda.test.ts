import { afterEach, expect, test, vi } from "vitest";
import { stepTimers, newTimers } from "~/domain/flight-timers";
import { useInFlight, FREDA_INTERVAL_MS } from "~/stores/inflight";

afterEach(() => vi.useRealTimers());
const context = {
  departureElevationFt: 800,
  groundElevationFt: 800,
  cruiseAltitudeFt: 3000,
};
const sample = {
  at: 1000,
  lat: 50,
  lon: 20,
  altitudeFt: 800,
  speedKt: 0,
  headingDeg: 90,
};

test("sparse simulator samples start Air Time, reach Cruise and schedule automatic FREDA", () => {
  vi.useFakeTimers();
  vi.setSystemTime(1000);
  const flight = useInFlight.getState();
  flight.start([]);
  flight.observe({ ...sample, onGround: true }, context);
  expect(useInFlight.getState().timers.airTime.startedAt).toBeNull();
  // No ten-second accelerating roll or +50 ft crossing reaches this device.
  flight.observe(
    { ...sample, at: 5000, altitudeFt: 1200, speedKt: 70, onGround: false },
    context,
  );
  expect(useInFlight.getState().timers.airTime.startedAt).toBe(5000);
  expect(useInFlight.getState().fredaDueAt).toBe(5000 + FREDA_INTERVAL_MS);
  flight.observe(
    { ...sample, at: 20000, altitudeFt: 3000, speedKt: 90, onGround: false },
    context,
  );
  expect(useInFlight.getState().phase).toBe("cruise");
  flight.tick(4999 + FREDA_INTERVAL_MS);
  expect(useInFlight.getState().fredaOpen).toBe(false);
  flight.tick(5000 + FREDA_INTERVAL_MS);
  expect(useInFlight.getState().fredaOpen).toBe(true);
});

test("an explicit simulator ground flag prevents a GPS heuristic take-off on the ground", () => {
  let timers = newTimers();
  for (let i = 0; i <= 12; i++) {
    timers = stepTimers(
      timers,
      {
        ...sample,
        at: i * 1000,
        speedKt: i * 5,
        altitudeFt: i === 12 ? 900 : 800,
        onGround: true,
      },
      { ...context, phase: "takeoff" },
    ).timers;
  }
  expect(timers.airTime.startedAt).toBeNull();
  const airborne = stepTimers(
    timers,
    { ...sample, at: 13000, speedKt: 65, altitudeFt: 900, onGround: false },
    { ...context, phase: "takeoff" },
  );
  expect(airborne.timers.airTime.startedAt).toBe(13000);
  expect(
    stepTimers(
      airborne.timers,
      { ...sample, at: 14000, speedKt: 70, altitudeFt: 1000, onGround: false },
      { ...context, phase: "climb" },
    ).timers.airTime.startedAt,
  ).toBe(13000);
});

test("native GPS take-off retains its verified roll and height crossing", () => {
  let timers = newTimers();
  for (let i = 0; i <= 12; i++) {
    timers = stepTimers(
      timers,
      {
        ...sample,
        at: i * 1000,
        speedKt: i * 5,
        altitudeFt: i === 12 ? 900 : 800,
      },
      { ...context, phase: "takeoff" },
    ).timers;
  }
  expect(timers.airTime.startedAt).toBe(12000);
});

test("manually disarmed Air Time is not restarted by simulator data", () => {
  const timers = newTimers();
  timers.airTime.autoArmed = false;
  expect(
    stepTimers(
      timers,
      { ...sample, onGround: false },
      { ...context, phase: "climb" },
    ).timers.airTime.startedAt,
  ).toBeNull();
});
