import { describe, expect, it } from "vitest";
import {
  flightGuidance,
  plannedGuidanceAltitude,
} from "../src/domain/flight-guidance";

const now = Date.parse("2026-10-18T12:00:00Z");
const input = {
  now,
  phase: "cruise" as const,
  fix: {
    time: new Date(now).toISOString(),
    groundSpeedKt: 100,
    trackDeg: 350,
    altitudeFt: 2000,
  },
  courseTrueDeg: 20,
  targetAltitudeFt: 3000,
  variationDeg: 5,
  tasKt: 100,
  wind: { directionDeg: 0, speedKt: 0 },
};
describe("automatic flight guidance", () => {
  it("holds cruise until TOD, then uses the next planned altitude; explicit circuit levels take precedence", () => {
    const next = { ident: "DEST", lat: 50, lon: 20 };
    const plan = {
      points: [
        {
          id: "TOD",
          lat: 50,
          lon: 19.8,
          isProfilePoint: true,
          routeDistanceNm: 80,
        },
        { id: "DEST", lat: 50, lon: 20, routeDistanceNm: 100 },
      ],
      pointAltitudeByKey: { TOD: 5000, DEST: 2000 },
    };
    expect(plannedGuidanceAltitude(next, 30, plan, 5000)).toBe(5000);
    expect(plannedGuidanceAltitude(next, 19, plan, 5000)).toBe(2000);
    expect(
      plannedGuidanceAltitude({ ...next, altitudeFt: 3000 }, 30, plan, 5000),
    ).toBe(3000);
    expect(plannedGuidanceAltitude({ ...next, lon: 21 }, 30, plan, 5000)).toBe(
      5000,
    );
  });
  it("turns across north by the shortest direction and displays magnetic heading", () => {
    expect(flightGuidance(input)).toEqual([
      { category: "heading", direction: "right", headingDeg: 15 },
      { category: "altitude", direction: "climb", altitudeFt: 3000 },
    ]);
    expect(flightGuidance({ ...input, courseTrueDeg: 320 })[0]).toMatchObject({
      direction: "left",
      headingDeg: 315,
    });
  });
  it("uses wind-corrected heading and actual connector heading when available", () => {
    const commands = flightGuidance({
      ...input,
      courseTrueDeg: 0,
      variationDeg: 0,
      wind: { directionDeg: 90, speedKt: 20 },
      fix: { ...input.fix, trackDeg: 280, headingTrueDeg: 0 },
    });
    expect(commands[0]).toEqual({
      category: "heading",
      direction: "right",
      headingDeg: 12,
    });
  });
  it("uses 360 for north, descends and suppresses achieved targets", () => {
    expect(
      flightGuidance({
        ...input,
        courseTrueDeg: 0,
        variationDeg: 0,
        targetAltitudeFt: 1000,
      }),
    ).toEqual([
      { category: "heading", direction: "right", headingDeg: 360 },
      { category: "altitude", direction: "descend", altitudeFt: 1000 },
    ]);
    expect(
      flightGuidance({ ...input, courseTrueDeg: 355, targetAltitudeFt: 2100 }),
    ).toEqual([]);
  });
  it("never fabricates commands without reliable moving-aircraft samples", () => {
    for (const patch of [
      { fix: null },
      { phase: "taxiout" as const },
      { phase: "taxiin" as const },
      { fix: { ...input.fix, groundSpeedKt: null } },
      { fix: { ...input.fix, groundSpeedKt: 20 } },
      { fix: { ...input.fix, paused: true } },
      { fix: { ...input.fix, time: new Date(now - 21000).toISOString() } },
      { fix: { ...input.fix, time: "invalid" } },
    ])
      expect(flightGuidance({ ...input, ...patch })).toEqual([]);
    expect(
      flightGuidance({
        ...input,
        fix: { ...input.fix, altitudeFt: null, trackDeg: null },
      }),
    ).toEqual([]);
  });
});
