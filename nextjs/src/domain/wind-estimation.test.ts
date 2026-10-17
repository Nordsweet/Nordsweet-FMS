import { afterEach, expect, test } from "vitest";
import { angleDiffDeg, normalizeDeg, toDeg, toRad } from "./angles";
import {
  emptyWind,
  observeWind,
  windReadout,
  windStatus,
  windArrowRotation,
  type WindSample,
} from "./wind-estimation";
import { useWind } from "~/stores/wind";

const origin = Date.parse("2026-10-17T12:00:00Z");
const knot = 1852 / 3600;
function sample(
  second: number,
  heading: number,
  from = 270,
  speed = 12,
  tas = 100,
): WindSample {
  const x =
    tas * knot * Math.sin(toRad(heading)) -
    speed * knot * Math.sin(toRad(from));
  const y =
    tas * knot * Math.cos(toRad(heading)) -
    speed * knot * Math.cos(toRad(from));
  return {
    at: origin + second * 1000,
    speedMps: Math.hypot(x, y),
    trackDeg: normalizeDeg(toDeg(Math.atan2(x, y))),
    altitudeM: 1500,
    accuracyM: 5,
  };
}
function circle(
  sign = 1,
  from = 270,
  speed = 12,
  tas = 100,
  step = 1,
  jitter = false,
) {
  let state = emptyWind();
  for (let second = 0; second <= 145; second += step) {
    const at = second + (jitter ? Math.sin(second) * 0.06 : 0);
    const p = sample(at, 355 + sign * second * 3, from, speed, tas);
    state = observeWind(state, p, p.at);
  }
  return state;
}
afterEach(() => useWind.setState({ session: null, state: emptyWind() }));

test("independent velocity-circle fit recovers cardinal winds for left/right GA turns and both speeds", () => {
  for (const sign of [-1, 1])
    for (const from of [0, 90, 180, 270, 359])
      for (const tas of [100, 120]) {
        const s = circle(sign, from, 12, tas);
        expect(s.estimate).not.toBeNull();
        expect(s.estimate!.speedMps / knot).toBeCloseTo(12, 6);
        expect(Math.abs(angleDiffDeg(from, s.estimate!.fromDeg!))).toBeLessThan(
          0.0001,
        );
        expect(windStatus(s, origin + 145000)).toBe("valid");
      }
});

test("calm has no invented direction; readout is FROM true degrees / padded knots", () => {
  const calm = circle(1, 0, 0);
  expect(calm.estimate?.fromDeg).toBeNull();
  expect(windReadout(calm.estimate)).toBe("---°/000");
  expect(windReadout(circle().estimate)).toBe("270°/012");
  expect(windReadout(null)).toBe("---°/---");
});

test("GPS-only straight flight or a partial turn never manufactures wind from planned TAS", () => {
  let straight = emptyWind(),
    partial = emptyWind();
  for (let i = 0; i < 90; i++) {
    const a = sample(i, 20),
      b = sample(i, i * 3);
    straight = observeWind(straight, a, a.at);
    partial = observeWind(partial, b, b.at);
  }
  expect(straight.estimate).toBeNull();
  expect(partial.estimate).toBeNull();
});

test("1 Hz, 3 s and jittered samples estimate the same vector; duplicate timestamps are idempotent", () => {
  for (const step of [1, 3]) {
    const state = circle(-1, 10, 20, 120, step, true);
    expect(state.estimate!.speedMps / knot).toBeCloseTo(20, 6);
    expect(Math.abs(angleDiffDeg(10, state.estimate!.fromDeg!))).toBeLessThan(
      0.001,
    );
    const last = state.samples.at(-1)!;
    expect(observeWind(state, last, last.at)).toBe(state);
  }
});

test("reject malformed, stale, poor-accuracy and excessive-wind samples without NaN/Infinity", () => {
  const valid = circle();
  for (const patch of [
    { speedMps: NaN },
    { speedMps: -1 },
    { speedMps: Infinity },
    { trackDeg: 360 },
    { accuracyM: 101 },
    { altitudeM: NaN },
    { at: origin - 100000 },
  ]) {
    const invalid = { ...sample(146, 100), ...patch };
    const state = observeWind(valid, invalid, origin + 146000);
    expect(windStatus(state, origin + 146000)).toBe("stale");
    expect(state.samples).toHaveLength(0);
  }
  expect(circle(1, 90, 65, 120).estimate).toBeNull();
});

test("a gap, clock rollback, altitude change or expiry cannot keep an estimate live", () => {
  const valid = circle();
  const late = sample(160, 100);
  expect(windStatus(observeWind(valid, late, late.at), late.at)).toBe("stale");
  const back = sample(100, 100);
  expect(observeWind(valid, back, back.at).estimate).toBeNull();
  expect(windStatus(valid, origin + 166000)).toBe("stale");
  expect(windStatus({ ...valid, altitudeM: 1900 }, origin + 145000)).toBe(
    "stale",
  );
  expect(
    windStatus({ ...valid, lastAcceptedAt: origin + 800000 }, origin + 800000),
  ).toBe("stale");
});

test("unstable altitude and non-circular velocity histories are rejected", () => {
  let climbing = emptyWind(),
    accelerating = emptyWind();
  for (let i = 0; i <= 145; i++) {
    const climb = { ...sample(i, i * 3), altitudeM: 1500 + i * 2 };
    const accel = sample(i, i * 3, 270, 12, 100 + 25 * Math.sin(toRad(i * 9)));
    climbing = observeWind(climbing, climb, climb.at);
    accelerating = observeWind(accelerating, accel, accel.at);
  }
  expect(climbing.estimate).toBeNull();
  expect(accelerating.estimate).toBeNull();
});

test("new flight, ground state and reload cannot reuse a previous live estimate", () => {
  useWind.setState({ session: "first", state: circle() });
  const p = sample(146, 30);
  useWind.getState().observe("second", true, p, p.at);
  expect(useWind.getState().state.estimate).toBeNull();
  useWind.setState({ session: "second", state: circle() });
  useWind.getState().observe("second", false, p, p.at);
  expect(useWind.getState().state.estimate).toBeNull();
  useWind.getState().observe(null, false, null, p.at);
  expect(useWind.getState().session).toBeNull();
  expect(windStatus(emptyWind(), p.at)).toBe("collecting");
});

test("derived/replayed GPS is not a live wind observation and map rotation keeps FROM/TO separate", () => {
  for (const source of ["derived", "replay"] as const) {
    let state = emptyWind();
    for (let second = 0; second < 145; second++) {
      const p = { ...sample(second, second * 3), source };
      state = observeWind(state, p, p.at);
    }
    expect(state.estimate).toBeNull();
  }
  expect(windArrowRotation(270, 0)).toBe(90);
  expect(windArrowRotation(270, 90)).toBe(0);
  expect(windArrowRotation(0, 180)).toBe(0);
});
