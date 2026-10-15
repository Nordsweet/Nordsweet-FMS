import { expect, test } from "vitest";
import { angleDiffDeg } from "./angles";
import { destinationPoint, distanceNm, initialBearingDeg } from "./geo";
import { flyByRoute, turnPerformance } from "./fly-by";
import { computeProgress } from "./progress";

const corner = { ident: "B", lat: 50, lon: 20 };
const from = { ident: "A", ...destinationPoint(corner, 270, 10) };
const right = { ident: "C", ...destinationPoint(corner, 180, 10) };

test.each([80, 100, 120, 140, 160])(
  "%s kt: rate-one radius, tangent distances and duration agree with the reference equations",
  (tasKt) => {
    const path = flyByRoute([from, corner, right], { tasKt });
    const turn = path.turns.get(1)!;
    expect(path.issues).toEqual([]);
    expect(turn.radiusNm).toBeCloseTo(tasKt / (60 * Math.PI), 9);
    expect(turn.entryNm).toBeCloseTo(turn.radiusNm, 8);
    expect(turn.exitNm).toBeCloseTo(turn.radiusNm, 8);
    expect(turn.durationSeconds).toBeCloseTo(30, 8);
    expect(distanceNm(corner, turn.points[0]!)).toBeCloseTo(turn.entryNm, 8);
    expect(distanceNm(corner, turn.points.at(-1)!)).toBeCloseTo(turn.exitNm, 8);
    expect(
      Math.abs(
        angleDiffDeg(90, initialBearingDeg(turn.points[0]!, turn.points[1]!)),
      ),
    ).toBeLessThan(2);
    expect(
      Math.abs(
        angleDiffDeg(
          180,
          initialBearingDeg(turn.points.at(-2)!, turn.points.at(-1)!),
        ),
      ),
    ).toBeLessThan(2);
    expect(path.points.some((p) => distanceNm(p, corner) < 0.001)).toBe(false);
  },
);

test("left/right arcs mirror one another and retain endpoints", () => {
  const left = { ...right, ...destinationPoint(corner, 0, 10) };
  const a = flyByRoute([from, corner, right], { tasKt: 100 });
  const b = flyByRoute([from, corner, left], { tasKt: 100 });
  expect(a.points[0]).toEqual(from);
  expect(a.points.at(-1)).toEqual(right);
  expect(a.turns.get(1)!.entryNm).toBeCloseTo(b.turns.get(1)!.entryNm, 7);
  expect(a.turns.get(1)!.points[15]!.lat).toBeLessThan(corner.lat);
  expect(b.turns.get(1)!.points[15]!.lat).toBeGreaterThan(corner.lat);
});

test("constant wind produces separate tangent distances and matches both ground tracks", () => {
  const path = flyByRoute([from, corner, right], {
    tasKt: 100,
    windDirectionDeg: 270,
    windSpeedKt: 20,
  });
  const t = path.turns.get(1)!;
  expect(path.issues).toEqual([]);
  expect(Math.abs(t.entryNm - t.exitNm)).toBeGreaterThan(0.05);
  expect(
    Math.abs(angleDiffDeg(90, initialBearingDeg(t.points[0]!, t.points[1]!))),
  ).toBeLessThan(2);
  expect(
    Math.abs(
      angleDiffDeg(180, initialBearingDeg(t.points.at(-2)!, t.points.at(-1)!)),
    ),
  ).toBeLessThan(2);
});

test("conflicting turns are reported without shrinking the rate-one radius; slower turns fit", () => {
  const next = { ident: "C", ...destinationPoint(corner, 180, 0.75) };
  const end = { ident: "D", ...destinationPoint(next, 90, 5) };
  const route = [from, corner, next, end];
  const fast = flyByRoute(route, { tasKt: 100 });
  expect(fast.turns.size).toBe(0);
  expect(fast.issues).toEqual([
    { index: 1, reason: "space" },
    { index: 2, reason: "space" },
  ]);
  expect(fast.points).toEqual(route);
  const slow = flyByRoute(route, { tasKt: 60 });
  expect(slow.issues).toEqual([]);
  expect(slow.turns.size).toBe(2);
  expect(slow.turns.get(1)!.radiusNm).toBeCloseTo(60 / (60 * Math.PI), 9);
});

test("straight, zero length, reversal, strong wind and explicit fly-over do not produce invalid arcs", () => {
  const onward = { ...right, ...destinationPoint(corner, 90, 10) };
  expect(flyByRoute([from, corner, onward], { tasKt: 100 }).turns.size).toBe(0);
  expect(
    flyByRoute([from, { ...corner, flyOver: true }, right], { tasKt: 100 })
      .turns.size,
  ).toBe(0);
  expect(
    flyByRoute([from, corner, from], { tasKt: 100 }).issues[0]?.reason,
  ).toBe("reversal");
  expect(
    flyByRoute([from, corner, right], {
      tasKt: 100,
      windDirectionDeg: 0,
      windSpeedKt: 150,
    }).issues[0]?.reason,
  ).toBe("wind");
  expect(flyByRoute([corner, corner, right], { tasKt: 100 }).turns.size).toBe(
    0,
  );
  expect(
    flyByRoute([from, corner, right], { tasKt: NaN }).issues[0]?.reason,
  ).toBe("speed");
});

test("navigation sequences at tangent entry and follows the arc without returning to the virtual fix", () => {
  const route = [from, corner, right];
  const t = flyByRoute(route, { tasKt: 100 }).turns.get(1)!;
  const before = destinationPoint(corner, 270, t.entryNm + 0.1);
  expect(computeProgress(route, before, 0)!.activeLeg).toBe(0);
  const at = t.points[1]!;
  const progress = computeProgress(route, at, 0)!;
  expect(progress.activeLeg).toBe(1);
  expect(progress.next.ident).toBe("C");
  expect(Math.abs(progress.crossTrackNm)).toBeLessThan(0.001);
  expect(progress.desiredTrackDeg).toBeGreaterThan(90);
  expect(progress.desiredTrackDeg).toBeLessThan(100);
  expect(computeProgress(route, before, 1)!.activeLeg).toBe(1);
  const offTrack = destinationPoint(before, 0, 2);
  expect(computeProgress(route, offTrack, 0)!.activeLeg).toBe(0);
});

test("live TAS uses the ground vector minus wind and uses planned TAS if speed is absent", () => {
  expect(
    turnPerformance(
      120,
      { windDirection: 270, windSpeed: 20 },
      { groundSpeedKt: 100, trackDeg: 90 },
    ).tasKt,
  ).toBeCloseTo(80, 8);
  expect(
    turnPerformance(120, null, { groundSpeedKt: null, trackDeg: null }).tasKt,
  ).toBe(120);
});
