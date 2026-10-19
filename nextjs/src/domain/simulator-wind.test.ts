import { afterEach, expect, test } from "vitest";
import { normalizeDeg, toDeg, toRad, angleDiffDeg } from "./angles";
import {
  emptyWind,
  simulatorWind,
  windReadout,
  windStatus,
  type SimulatorWindSample,
} from "./wind-estimation";
import { useWind } from "~/stores/wind";
const at = Date.parse("2026-10-20T00:00:00Z");
const sample = (
  from = 270,
  speed = 12,
  heading = 0,
  tas = 100,
): SimulatorWindSample => {
  const east = tas * Math.sin(toRad(heading)) - speed * Math.sin(toRad(from));
  const north = tas * Math.cos(toRad(heading)) - speed * Math.cos(toRad(from));
  return {
    at,
    altitudeFt: 5000,
    onGround: false,
    trueAirspeedKt: tas,
    headingTrueDeg: heading,
    groundSpeedKt: Math.hypot(east, north),
    trackTrueDeg: normalizeDeg(toDeg(Math.atan2(east, north))),
  };
};
afterEach(() =>
  useWind.setState({ session: null, mode: "gps", state: emptyWind() }),
);
test("actual TAS/true heading and GS/true track recover wind immediately for straight or turning flight", () => {
  for (const heading of [0, 65, 180, 359])
    for (const from of [0, 90, 180, 270])
      for (const tas of [100, 120]) {
        const wind = simulatorWind(sample(from, 12, heading, tas), at)!;
        expect(Math.abs(angleDiffDeg(from, wind.fromDeg!))).toBeLessThan(
          0.000001,
        );
        expect((wind.speedMps * 3600) / 1852).toBeCloseTo(12, 9);
        expect(windReadout(wind)).toBe(`${String(from).padStart(3, "0")}°/012`);
      }
});
test("calm and wraparound use the same FROM convention and knots as the tile", () => {
  expect(windReadout(simulatorWind(sample(0, 0), at))).toBe("---°/000");
  expect(
    windReadout(simulatorWind({ ...sample(0, 12), headingTrueDeg: 360 }, at)),
  ).toBe("000°/012");
});
test("ground, missing, stale, future and invalid sensor data cannot become live wind", () => {
  const good = sample();
  for (const value of [
    null,
    { ...good, onGround: true },
    { ...good, trueAirspeedKt: 0 },
    { ...good, trueAirspeedKt: NaN },
    { ...good, headingTrueDeg: -1 },
    { ...good, at: at - 20001 },
    { ...good, at: at + 1001 },
  ])
    expect(simulatorWind(value, at)).toBeNull();
});
test("P3D wind needs no GPS circle or app air-time timer; interruptions and source/session changes clear live continuity", () => {
  useWind.getState().observeSimulator(null, sample(), at);
  expect(windStatus(useWind.getState().state, at)).toBe("valid");
  expect(useWind.getState().state.samples).toEqual([]);
  useWind.getState().observeSimulator(null, null, at + 1000);
  expect(windStatus(useWind.getState().state, at + 1000)).toBe("stale");
  useWind.getState().observe(null, false, null, at + 2000);
  expect(useWind.getState().state.estimate).toBeNull();
  useWind.getState().observeSimulator("new", sample(), at);
  expect(windReadout(useWind.getState().state.estimate)).toBe("270°/012");
  expect(windStatus(useWind.getState().state, at + 20001)).toBe("stale");
  useWind.getState().observeSimulator("another", null, at + 21000);
  expect(useWind.getState().state.estimate).toBeNull();
});
