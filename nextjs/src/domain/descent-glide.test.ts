import { expect, test } from "vitest";
import { descentGlideAvailable } from "./descent-glide";
const now = Date.parse("2026-10-21T12:00:00Z");
const fix = {
  source: "connector",
  time: new Date(now).toISOString(),
  accuracyM: 5,
  groundSpeedKt: 90,
  trackDeg: 180,
  verticalSpeedFpm: -600,
};
test("descent must strictly exceed 500 ft/min, with valid measured MSL altitude", () => {
  expect(descentGlideAvailable(fix, 4000, now)).toBe(true);
  for (const verticalSpeedFpm of [-500, -499, 0, 600, NaN])
    expect(descentGlideAvailable({ ...fix, verticalSpeedFpm }, 4000, now)).toBe(
      false,
    );
  expect(descentGlideAvailable(fix, null, now)).toBe(false);
  expect(descentGlideAvailable(fix, NaN, now)).toBe(false);
});
test("stale, paused, replay, ground and incomplete telemetry hides rings", () => {
  for (const patch of [
    { paused: true },
    { onGround: true },
    { source: "replay" },
    { groundSpeedKt: null },
    { trackDeg: null },
    { accuracyM: 101 },
  ])
    expect(descentGlideAvailable({ ...fix, ...patch }, 4000, now)).toBe(false);
  expect(descentGlideAvailable(fix, 4000, now + 20001)).toBe(false);
  expect(descentGlideAvailable(fix, 4000, now - 1001)).toBe(false);
});
test("device descent requires reliable GNSS altitude; connector uses instrument height", () => {
  expect(descentGlideAvailable({ ...fix, source: "gps" }, 4000, now)).toBe(
    false,
  );
  expect(
    descentGlideAvailable(
      { ...fix, source: "gps", altitudeAccuracyM: 5 },
      4000,
      now,
    ),
  ).toBe(true);
  expect(
    descentGlideAvailable(
      { ...fix, source: "derived", altitudeAccuracyM: 31 },
      4000,
      now,
    ),
  ).toBe(false);
});
