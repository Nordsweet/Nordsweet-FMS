import { describe, expect, it } from "vitest";
import { destinationPoint } from "./geo";
import { guidanceTimeline } from "./guidance-timeline";

const now = Date.parse("2026-10-29T12:00:00Z");
const start = { lat: 50, lon: 20 };
const end = destinationPoint(start, 90, 20);
const tod = destinationPoint(start, 90, 10);
const route = [
  { ...start, ident: "A" },
  { ...end, ident: "B" },
];
const plan = {
  points: [
    { ...start, id: "A", routeDistanceNm: 0 },
    { ...tod, id: "TOD", routeDistanceNm: 10, isProfilePoint: true },
    { ...end, id: "B", routeDistanceNm: 20 },
  ],
  pointAltitudeByKey: { A: 5000, TOD: 5000, B: 2000 },
};

function forecast(sideNm: number, seconds: number, trackDeg = 90) {
  const before = destinationPoint(tod, 270, (100 * seconds) / 3600);
  const position = destinationPoint(
    before,
    sideNm < 0 ? 180 : 0,
    Math.abs(sideNm),
  );
  return guidanceTimeline({
    route,
    activeLeg: 0,
    performance: { tasKt: 100 },
    plan,
    cruiseAltitudeFt: 5000,
    now,
    phase: "cruise",
    fix: {
      ...position,
      time: new Date(now).toISOString(),
      groundSpeedKt: 100,
      trackDeg,
      altitudeFt: 5000,
    },
    courseTrueDeg: null,
    targetAltitudeFt: 5000,
    variationDeg: 0,
    tasKt: 100,
    wind: { directionDeg: 0, speedKt: 0 },
  }).find(
    (event) =>
      event.command.category === "altitude" &&
      event.command.direction === "descend",
  );
}

describe("TOD abeam countdown", () => {
  it.each([-1.5, -0.6, 0, 0.6, 1.5])(
    "ignores a %s NM lateral offset",
    (side) => {
      expect(Math.abs(forecast(side, 20)!.dueAt - now - 20000)).toBeLessThan(
        250,
      );
    },
  );
  it("accounts for actual track and does not forecast while flying away", () => {
    expect(
      Math.abs(
        forecast(0.6, 20, 60)!.dueAt - now - 20000 / Math.cos(Math.PI / 6),
      ),
    ).toBeLessThan(250);
    expect(forecast(0.6, 20, 270)).toBeUndefined();
  });
  it("announces when crossing the line, and not a stale crossing", () => {
    expect(Math.abs(forecast(0.6, 0)!.dueAt - now)).toBeLessThan(250);
    expect(forecast(0.6, -5)).toBeUndefined();
  });
});
