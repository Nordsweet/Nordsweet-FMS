import { expect, test } from "vitest";
import { sameReading, type GpsFix } from "./use-gps";

const fix: GpsFix = {
  lat: 52,
  lon: 21,
  altitudeFt: 100,
  groundSpeedKt: 0,
  trackDeg: 90,
  accuracyM: 0,
  time: "2026-01-01T00:00:00Z",
  receivedAt: 1,
};
test("a reading is the same when only its arrival time differs", () => {
  expect(sameReading(fix, { ...fix, time: "later", receivedAt: 2 })).toBe(true);
  expect(sameReading(fix, { ...fix, lat: 52.0001 })).toBe(false);
  expect(sameReading(fix, { ...fix, paused: true })).toBe(false);
});
