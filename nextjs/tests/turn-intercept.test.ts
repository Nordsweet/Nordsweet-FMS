import { expect, test } from "vitest";
import { rateOneIntercept } from "~/domain/turn-intercept";
import { guidanceTimeline } from "~/domain/guidance-timeline";
import { destinationPoint, trackOffset } from "~/domain/geo";
import { windTriangle } from "~/domain/wind";
import { angleDiffDeg, toRad, toDeg } from "~/domain/angles";

const from = { ident: "B", lat: 0, lon: 0 };
const to = { ident: "C", ...destinationPoint(from, 90, 10) };
const now = Date.parse("2026-10-21T12:00:00Z");

test.each([0, 180, 310])(
  "rolls onto the outbound line from measured heading %s with wind",
  (heading) => {
    const wind = { directionDeg: 210, speedKt: 20 };
    const tas = 120,
      target = windTriangle(90, tas, wind)!.headingDeg;
    const change = angleDiffDeg(heading, target);
    // Independent small-step integration of the measured heading at 3 degrees/second.
    const duration = Math.abs(change) / 3,
      steps = 10000,
      dt = duration / steps;
    let e = 0,
      n = 0;
    for (let i = 0; i < steps; i++) {
      const angle = toRad(heading + (change * (i + 0.5)) / steps);
      e +=
        ((tas * Math.sin(angle) -
          wind.speedKt * Math.sin(toRad(wind.directionDeg))) /
          3600) *
        dt;
      n +=
        ((tas * Math.cos(angle) -
          wind.speedKt * Math.cos(toRad(wind.directionDeg))) /
          3600) *
        dt;
    }
    const ve =
      (tas * Math.sin(toRad(heading)) -
        wind.speedKt * Math.sin(toRad(wind.directionDeg))) /
      3600;
    const vn =
      (tas * Math.cos(toRad(heading)) -
        wind.speedKt * Math.cos(toRad(wind.directionDeg))) /
      3600;
    const pe = 3 - e - ve * 20,
      pn = -n - vn * 20;
    const fix = {
      ...destinationPoint(from, toDeg(Math.atan2(pe, pn)), Math.hypot(pe, pn)),
      groundSpeedKt: Math.hypot(ve, vn) * 3600,
      trackDeg: (toDeg(Math.atan2(ve, vn)) + 360) % 360,
      headingTrueDeg: heading,
      trueAirspeedKt: tas,
    };
    const intercept = rateOneIntercept(fix, from, to, wind)!;
    expect(intercept).not.toBeNull();
    expect(intercept.seconds).toBeCloseTo(20, 2);
    expect(
      Math.abs(trackOffset(from, to, intercept.rollout).crossTrackNm),
    ).toBeLessThan(0.001);
    expect(trackOffset(from, to, intercept.rollout).alongTrackNm).toBeCloseTo(
      3,
      2,
    );
    const timeline = (previous: { ident: string; lat: number; lon: number }) =>
      guidanceTimeline({
        now,
        phase: "cruise",
        fix: { ...fix, time: new Date(now).toISOString(), altitudeFt: 5000 },
        courseTrueDeg: fix.trackDeg,
        targetAltitudeFt: 5000,
        tasKt: 90,
        wind,
        variationDeg: 0,
        route: [previous, from, to],
        activeLeg: 0,
        performance: { tasKt: 90 },
        plan: null,
        cruiseAltitudeFt: 5000,
      }).find((event) => event.key === "heading-leg:1");
    const event = timeline({ ident: "A", lat: -1, lon: 0 })!;
    expect((event.dueAt - now) / 1000).toBeCloseTo(20, 2);
    // Moving the previous planned leg does not move a live intercept deadline.
    expect(timeline({ ident: "A", lat: 0.5, lon: -0.5 })?.dueAt).toBe(
      event.dueAt,
    );
  },
);

test("rejects unreachable rollout, parallel motion and missing telemetry", () => {
  const fix = {
    ...destinationPoint(from, 180, 2),
    groundSpeedKt: 100,
    trackDeg: 90,
  };
  const wind = { directionDeg: 0, speedKt: 0 };
  expect(rateOneIntercept(fix, from, to, wind)).toBeNull();
  expect(
    rateOneIntercept({ ...fix, trackDeg: null }, from, to, wind),
  ).toBeNull();
  expect(
    rateOneIntercept({ ...fix, trackDeg: 0, groundSpeedKt: 0 }, from, to, wind),
  ).toBeNull();
});
